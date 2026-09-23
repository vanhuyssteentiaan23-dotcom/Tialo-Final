import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
export const runtime='nodejs'
export const maxDuration=60
function normalizeSupabaseUrl(raw){try{const u=new URL(raw?.trim());return u.hostname.endsWith('.supabase.co')?u.origin:null}catch{return null}}
function getServerSupabase(request){const url=normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);const key=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;const h=request.headers.get('authorization')||'';const token=h.startsWith('Bearer ')?h.slice(7).trim():'';if(!url||!key||!token)return null;return createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:`Bearer ${token}`}}})}
const LANGUAGE_NAMES={en:'English',af:'Afrikaans',zu:'isiZulu',xh:'isiXhosa',st:'Sesotho',tn:'Setswana',nso:'Sepedi',ts:'XiTsonga',ss:'siSwati',de:'German',fr:'French',es:'Spanish',pt:'Portuguese'}

async function findStudyImages(query){
  const terms=query.toLowerCase().replace(/[^a-z0-9\\s-]/g,' ').replace(/\\b(give|show|me|some|images?|pictures?|photos?|of|please|can|you|find)\\b/g,' ').replace(/\\s+/g,' ').trim();
  const search=terms||'RNA structure';
  const url='https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch='+encodeURIComponent(search)+'&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json&origin=*';
  try{
    const r=await fetch(url,{headers:{'User-Agent':'TIALO/1.0 study app'}});if(!r.ok)return [];
    const j=await r.json();
    return Object.values(j?.query?.pages||{}).map(p=>({title:String(p.title||'').replace(/^File:/,''),url:p.imageinfo?.[0]?.thumburl||p.imageinfo?.[0]?.url||'',source:'Wikimedia Commons'})).filter(x=>x.url).slice(0,4);
  }catch(e){console.error('Study image search failed:',e);return []}
}
function wantsImages(q){return /\\b(show|give|find|display|send|provide|see)\\b.*\\b(image|images|picture|pictures|diagram|diagrams|photo|photos)\\b|\\b(images?|pictures?|diagrams?)\\s+(of|for)\\b/i.test(q)}
const STOP_WORDS=new Set('the a an and or but is are was were be been being to of in on for from with without what why how when where which who does do did can could should would will this that these those it its as at by about into than then them they their you your i me my we our explain please give tell'.split(' '))
function terms(q){return[...new Set((q.toLowerCase().match(/[a-z0-9]+/g)||[]).filter(x=>x.length>2&&!STOP_WORDS.has(x)))]}
function context(materials,q){const ts=terms(q),out=[];for(const m of materials){const text=m.extracted_text||'';const low=text.toLowerCase();for(let start=0;start<text.length;start+=6100){const chunk=text.slice(start,start+7000),cl=low.slice(start,start+chunk.length);let score=0;for(const t of ts){const n=cl.split(t).length-1;score+=Math.min(n,8)}if(score)out.push({score,text:chunk,title:m.title||m.file_name||'Study material'})}}out.sort((a,b)=>b.score-a.score);return out.slice(0,8).map((x,i)=>`SOURCE ${i+1} — ${x.title}\n${x.text}`).join('\n\n')}
export async function POST(request){
 const supabase=getServerSupabase(request);if(!supabase)return NextResponse.json({error:'Authentication is required.'},{status:401})
 const {data:{user},error:authError}=await supabase.auth.getUser();if(authError||!user)return NextResponse.json({error:'Your session is invalid or expired. Please log in again.'},{status:401})
 const apiKey=process.env.GEMINI_API_KEY;if(!apiKey)return NextResponse.json({error:'The AI Tutor needs GEMINI_API_KEY configured in Vercel.'},{status:503})
 let body;try{body=await request.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
 const question=typeof body?.question==='string'?body.question.trim():'';const subjectId=body?.subjectId;const history=Array.isArray(body?.history)?body.history.slice(-8):[]
 if(!question)return NextResponse.json({error:'Please enter a question.'},{status:400});if(!subjectId)return NextResponse.json({error:'Please choose a subject.'},{status:400})
 const {data:profile}=await supabase.from('profiles').select('language').eq('id',user.id).maybeSingle()
 const {data:materials,error:me}=await supabase.from('materials').select('id,title,file_name,extracted_text,processing_status').eq('user_id',user.id).eq('subject_id',subjectId).eq('processing_status','ready').not('extracted_text','is',null)
 if(me)return NextResponse.json({error:me.message},{status:400});if(!materials?.length)return NextResponse.json({error:'This subject has no processed study material yet. Upload and read a PDF first.'},{status:400})
 const source=context(materials,question);if(!source)return NextResponse.json({answer:'I could not find enough relevant information in your uploaded material to answer that confidently.'})
 const imageResults=wantsImages(question)?await findStudyImages(question):[]
 const language=LANGUAGE_NAMES[profile?.language]||'English'
 const contents=history.filter(x=>x&&(x.role==='user'||x.role==='assistant')&&typeof x.content==='string').map(x=>({role:x.role==='assistant'?'model':'user',parts:[{text:x.content}]}));contents.push({role:'user',parts:[{text:question}]})
 const response=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_TUTOR_MODEL||'gemini-3.5-flash-lite'}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify({systemInstruction:{parts:[{text:`You are TIALO AI Tutor. Answer entirely in ${language}. Use ONLY the supplied study material. Do not invent facts. Teach clearly and step by step.\n\nSUPPLIED STUDY MATERIAL:\n${source}`}]},contents,generationConfig:{temperature:.2}})})
 const result=await response.json().catch(()=>({}));if(!response.ok){console.error('Gemini Tutor error:',result);return NextResponse.json({error:result?.error?.message||'The AI Tutor could not answer right now.'},{status:502})}
 const answer=result?.candidates?.[0]?.content?.parts?.map(x=>x.text||'').join('')||'';if(!answer.trim())return NextResponse.json({error:'The AI Tutor returned an empty answer.'},{status:502});return NextResponse.json({answer,images:imageResults})
}
