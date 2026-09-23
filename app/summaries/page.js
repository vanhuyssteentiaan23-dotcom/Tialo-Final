'use client'

import {useEffect,useMemo,useRef,useState} from 'react'
import {getSupabaseBrowserClient} from '../../lib/supabase'

const nav=[['Overview','/dashboard'],['Subjects','/subjects'],['Summaries','/summaries'],['AI Tutor','/ai-tutor'],['Mock Exams','/mock-exams'],['Daily Tasks','/daily-tasks'],['Progress','/progress']]
const IMAGE_TYPES=['image/png','image/jpeg','image/webp']

export default function Summaries(){
 const [subjects,setSubjects]=useState([]),[materials,setMaterials]=useState([]),[saved,setSaved]=useState([])
 const [subjectId,setSubjectId]=useState(''),[selected,setSelected]=useState([]),[request,setRequest]=useState(''),[instruction,setInstruction]=useState('')
 const [rubric,setRubric]=useState(null),[rubricPreview,setRubricPreview]=useState('')
 const [summary,setSummary]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const rubricInput=useRef(null)
 const subjectMaterials=useMemo(()=>materials.filter(m=>m.subject_id===subjectId),[materials,subjectId])

 async function load(){
  const s=getSupabaseBrowserClient();if(!s){location.href='/login';return}
  const {data:{user}}=await s.auth.getUser();if(!user){location.href='/login';return}
  const [a,b,c]=await Promise.all([
   s.from('subjects').select('id,name').eq('user_id',user.id).order('created_at'),
   s.from('materials').select('id,subject_id,title,file_name,mime_type,processing_status').eq('user_id',user.id).order('uploaded_at',{ascending:false}),
   s.from('summaries').select('id,title,subject_id,chapter_request,summary_json,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)
  ])
  if(a.error||b.error||c.error)setError(a.error?.message||b.error?.message||c.error?.message||'Could not load your study library.')
  setSubjects(a.data||[]);setMaterials(b.data||[]);setSaved(c.data||[])
  if(!subjectId&&a.data?.[0])setSubjectId(a.data[0].id)
  setLoading(false)
 }

 useEffect(()=>{load()},[])

 function toggle(id){setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}

 async function prepareRubric(file){
  setError('');setNotice('')
  if(!file||!IMAGE_TYPES.includes(file.type)){setError('Please upload a PNG, JPG or WEBP picture of the rubric.');return}
  if(file.size>8*1024*1024){setError('That rubric photo is too large. Please choose an image under 8 MB.');return}
  const dataUrl=await new Promise((resolve,reject)=>{
   const reader=new FileReader()
   reader.onload=()=>resolve(reader.result)
   reader.onerror=()=>reject(new Error('Could not read that image.'))
   reader.readAsDataURL(file)
  })
  const img=new Image()
  img.onload=()=>{
   const max=1600
   const scale=Math.min(1,max/Math.max(img.width,img.height))
   const canvas=document.createElement('canvas')
   canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale))
   const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height)
   const compressed=canvas.toDataURL('image/jpeg',.78)
   if(compressed.length>3000000){setError('That rubric photo is still too large. Please use a clearer, tighter photo of the rubric.');return}
   setRubric(file);setRubricPreview(compressed)
  }
  img.onerror=()=>setError('That image could not be read. Please try another photo.')
  img.src=dataUrl
 }

 async function createSummary(event){
  event?.preventDefault()
  setNotice('Starting your summary…')
  if(!subjectId||!selected.length||(!request.trim()&&!rubricPreview)){
   setError('Choose a subject, select at least one document, then type what you need summarised or upload a rubric photo.')
   return
  }
  setBusy(true);setError('');setNotice('')
  try{
   const s=getSupabaseBrowserClient()
   if(!s)throw new Error('TIALO could not connect to your account. Please refresh the page.')
   let {data:{session}}=await s.auth.getSession()
   if(!session?.access_token){
    const refreshed=await s.auth.refreshSession()
    session=refreshed.data?.session||null
   }
   if(!session?.access_token)throw new Error('Your login session has expired. Please refresh the page and log in again.')
   const payload={subjectId,materialIds:selected,chapterRequest:request,instruction,rubricImage:rubricPreview}
   let res=await fetch('/api/summaries',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify(payload)})
   let responseText=await res.text();let data={};try{data=JSON.parse(responseText)}catch{}
   if(res.status===401){
    const refreshed=await s.auth.refreshSession()
    const freshToken=refreshed.data?.session?.access_token
    if(freshToken){
     setNotice('Refreshing your secure session…')
     res=await fetch('/api/summaries',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${freshToken}`},body:JSON.stringify(payload)})
     responseText=await res.text();try{data=JSON.parse(responseText)}catch{data={}}
    }
   }
   if(!res.ok)throw new Error(data.error||responseText||`Summary request failed (${res.status}).`)
   const subject=subjects.find(x=>x.id===subjectId)
   setSummary({...data.summary,subjectName:subject?.name||'Subject'});setNotice('Summary created and saved.');await load()
  }catch(e){setError(e.message||'Could not create the summary.')}finally{setBusy(false)}
 }

 function openSaved(item){const subject=subjects.find(x=>x.id===item.subject_id);setSubjectId(item.subject_id);setSummary({...item.summary_json,id:item.id,title:item.title,subjectName:subject?.name||'Subject'});setRequest(item.chapter_request||'')}
 function print(){window.print()}

 if(loading)return <main className="new-loading"><div className="new-logo">TIA<span>LO</span></div><span>Opening Summaries…</span></main>
 return <main className="tialo-new-shell summaries-page">
  <aside className="new-sidebar print-hide"><div className="new-sidebar-top"><a className="new-logo" href="/dashboard">TIA<span>LO</span></a></div><div className="new-nav-label">Workspace</div><nav>{nav.map(([label,href])=><a className={href==='/summaries'?'selected':''} href={href} key={href}><span>{label}</span></a>)}</nav></aside>
  <section className="new-main">
   <header className="new-header print-hide"><div><strong>Summaries</strong><span> / Study documents</span></div></header>
   <div className="new-content">
    <div className="summary-hero"><div className="new-kicker">TIALO SUMMARIES</div><h1>Turn your notes into a study summary.</h1><p>Tell TIALO exactly what you need to learn — or upload a photo of your teacher’s rubric — and it will build the summary from your selected study material.</p></div>
    {error&&<div className="notice">{error}</div>}{notice&&<div className="notice">{notice}</div>}
    <section className="summary-builder panel print-hide">
     <div className="summary-field full"><label>1 · Subject</label><select value={subjectId} onChange={e=>{setSubjectId(e.target.value);setSelected([])}}>{subjects.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></div>
     <div className="summary-field full"><label>2 · Study documents</label><div className="summary-materials">{subjectMaterials.length?subjectMaterials.map(m=><label className={'summary-material '+(selected.includes(m.id)?'selected':'')} key={m.id}><input type="checkbox" checked={selected.includes(m.id)} onChange={()=>toggle(m.id)}/><span><b>{m.title||m.file_name||'Untitled document'}</b><small>{m.processing_status==='ready'?'Ready for summaries':m.processing_status||'Uploaded'}</small></span></label>):<p>No documents uploaded to this subject yet. <a href="/materials">Upload study material</a>.</p>}</div></div>
     <div className="summary-field full"><label>3 · What do you need summarised?</label><textarea className="summary-request" value={request} onChange={e=>setRequest(e.target.value)} placeholder="Example: Summarise photosynthesis, cellular respiration and the diagrams I need to know for my test." rows={5}/></div>
     <div className="summary-rubric-grid">
      <div><label className="summary-rubric-label">Or upload a picture of your rubric</label><p>Take a clear photo or upload a screenshot. TIALO will read the rubric and use it to decide what the summary must cover.</p><input ref={rubricInput} type="file" accept="image/png,image/jpeg,image/webp" capture="environment" hidden onChange={e=>e.target.files?.[0]&&prepareRubric(e.target.files[0])}/><button type="button" className="rubric-upload" onClick={()=>rubricInput.current?.click()}>＋ Upload rubric photo</button>{rubric&&<div className="rubric-file"><img src={rubricPreview} alt="Rubric preview"/><div><b>{rubric.name}</b><small>Rubric attached to this summary</small></div><button type="button" onClick={()=>{setRubric(null);setRubricPreview('');if(rubricInput.current)rubricInput.current.value=''}}>Remove</button></div>}</div>
      <div><label className="summary-rubric-label">Optional study style</label><textarea value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="e.g. Keep it simple, focus on definitions, include exam-style facts…" rows={5}/></div>
     </div>
     <button type="button" className="new-primary summary-create" disabled={busy} onClick={createSummary}>{busy?'Creating your study summary…':'Create summary →'}</button>
    </section>
    {summary&&<article className="summary-document">
      <div className="summary-doc-head"><div className="new-kicker">STUDY SUMMARY</div><h2>{summary.title}</h2><p>{summary.subjectName}</p></div>
      {summary.overview&&<section><h3>Overview</h3><p>{summary.overview}</p></section>}
      {(summary.sections||[]).map((s,i)=><section key={i}><h3>{i+1}. {s.heading}</h3><p>{s.summary}</p>{s.keyPoints?.length?<ul>{s.keyPoints.map((p,j)=><li key={j}>{p}</li>)}</ul>:null}</section>)}
      {summary.importantTerms?.length?<section><h3>Important terms</h3>{summary.importantTerms.map((t,i)=><p key={i}><b>{t.term}:</b> {t.meaning}</p>)}</section>:null}
      <footer>Generated by TIALO · Source-linked study summary</footer>
    </article>}
    {summary&&<div className="summary-actions print-hide"><button className="new-primary" onClick={print}>Print / Save as PDF</button></div>}
    <section className="saved-summaries print-hide"><div className="new-kicker">MY SUMMARIES</div><h2>Saved study summaries</h2>{saved.length?saved.map(x=><button className="saved-summary" key={x.id} onClick={()=>openSaved(x)}><b>{x.title}</b><small>{new Date(x.created_at).toLocaleDateString()} · {x.chapter_request}</small></button>):<p>No summaries saved yet.</p>}</section>
   </div>
  </section>
 </main>
}
