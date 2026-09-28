import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return null
  try {
    const parsed = new URL(rawUrl.trim())
    if (parsed.hostname.endsWith('.supabase.co')) return `${parsed.protocol}//${parsed.host}`
    return null
  } catch { return null }
}

function getServerSupabase(request) {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!url || !key || !token) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

const LANGUAGE_NAMES={en:'English',af:'Afrikaans',zu:'isiZulu',xh:'isiXhosa',st:'Sesotho',tn:'Setswana',nso:'Sepedi',ts:'XiTsonga',ss:'siSwati',de:'German',fr:'French',es:'Spanish',pt:'Portuguese'}
function outputLanguage(profile){return LANGUAGE_NAMES[profile?.language]||'English'}

const STOP_WORDS = new Set('the a an and or but is are was were be been being to of in on for from with without what why how when where which who does do did can could should would will this that these those it its as at by about into than then them they their you your i me my we our explain please give tell'.split(' '))

function termsFromQuestion(question) {
  return [...new Set((question.toLowerCase().match(/[a-z0-9]+/g) || []).filter(term => term.length > 2 && !STOP_WORDS.has(term)))]
}

function parseRequestedTopics(scope, subjectName) {
  const raw = String(scope || '').split(',').map(x => x.trim()).filter(Boolean)
  const topics = raw.length ? raw : [String(subjectName || 'General').trim()]
  return [...new Set(topics)].slice(0, 8)
}

function buildTopicContext(materials, topics) {
  const sections=[]
  for(const topic of topics){
    const terms=termsFromQuestion(topic)
    const candidates=[]
    for(const material of materials){
      const pages=Array.isArray(material.page_text)&&material.page_text.length?material.page_text.map(item=>({page:Number(item.page)||1,text:String(item.text||'')})):[{page:1,text:String(material.extracted_text||'')}]
      for(const pageItem of pages){
        const text=pageItem.text.trim()
        if(!text)continue
        const lower=text.toLowerCase()
        const chunkSize=2600,overlap=250
        for(let pos=0;pos<text.length;pos+=chunkSize-overlap){
          const chunk=text.slice(pos,pos+chunkSize),chunkLower=lower.slice(pos,pos+chunk.length)
          let score=0,matches=0
          for(const term of terms){
            const safe=term.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&')
            const hitCount=(chunkLower.match(new RegExp('\\\\b'+safe+'\\\\b','g'))||[]).length
            if(hitCount){matches+=hitCount;score+=Math.min(hitCount,8)}
          }
          if(matches)candidates.push({score,materialId:material.id,page:pageItem.page,title:material.title||material.file_name||'Study material',text:chunk})
        }
      }
    }
    candidates.sort((a,b)=>b.score-a.score)
    const selected=candidates.slice(0,4)
    sections.push('TOPIC: '+topic+'\\n'+(selected.length?selected.map((item,i)=>'SOURCE '+(i+1)+' — '+item.title+' — PAGE '+item.page+' — MATERIAL '+item.materialId+'\\n'+item.text).join('\\n\\n'):'NO DIRECT SOURCE MATCH WAS FOUND. Do not invent facts for this topic.'))
  }
  return sections.join('\\n\\n===== NEXT REQUESTED TOPIC =====\\n\\n')
}


function questionQualityIssues(questions, topics, count) {
  const issues=[]
  const topicWords=topics.flatMap(termsFromQuestion)
  const badPrompt=/which statement is supported by the supplied study material|this statement is not supported by the supplied study material|no conclusion can be drawn from the supplied study material|this option describes a different concept from the requested topic/i
  for(const [index,question] of questions.entries()){
    const prompt=String(question?.prompt||'').trim()
    const topic=String(question?.topic||'').trim()
    if(!prompt||prompt.length<20)issues.push('Question '+(index+1)+' has no specific question.')
    if(badPrompt.test(prompt))issues.push('Question '+(index+1)+' is generic filler.')
    if(topicWords.length&&!topicWords.some(word=>topic.toLowerCase().includes(word)))issues.push('Question '+(index+1)+' is not assigned to a requested topic.')
    if(question?.question_type==='multiple_choice'){
      const options=Array.isArray(question.options)?question.options:[]
      if(options.some(option=>String(option).length>320))issues.push('Question '+(index+1)+' has a raw source passage as an option.')
      if(String(question.correct_answer||'').length>320)issues.push('Question '+(index+1)+' has a raw source passage as the answer.')
    }
    if(question?.question_type==='short_answer'&&String(question.model_answer||'').length>900)issues.push('Question '+(index+1)+' has an oversized model answer.')
  }
  if(questions.length!==count)issues.push('The exam must contain exactly '+count+' questions.')
  return [...new Set(issues)]
}

function buildMaterialContext(materials, question = '') {
  const terms = termsFromQuestion(question)
  const candidates = []
  for (const material of materials) {
    const pages = Array.isArray(material.page_text) && material.page_text.length ? material.page_text.map(item => ({ page: Number(item.page) || 1, text: String(item.text || '') })) : [{ page: 1, text: String(material.extracted_text || '') }]
    for (const pageItem of pages) {
      const text = pageItem.text.trim()
      if (!text) continue
      const lower = text.toLowerCase()
      const chunkSize = 3000, overlap = 300
      for (let start = 0; start < text.length; start += chunkSize - overlap) {
        const chunk = text.slice(start, start + chunkSize)
        const chunkLower = lower.slice(start, start + chunk.length)
        let score = terms.length ? 0 : 1, topicMatches = 0
        for (const term of terms) {
          const safe = term.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')
          const matches = chunkLower.match(new RegExp('\\b' + safe + '\\b', 'g'))
          if (matches) { topicMatches += matches.length; score += Math.min(matches.length, 10) }
        }
        const hasQuantitativeSignal = /\\d+(?:\\.\\d+)?\\s*(?:%|percent|cm|mm|m|km|g|kg|mg|ml|l|s|sec|min|hours?|hz|°c|degrees?)/i.test(chunk) || /\\b(?:table|graph|data|rate|frequency|concentration|temperature|mass|volume|distance|speed|percentage|increase|decrease)\\b/i.test(chunk)
        const hasVisualSignal = /\\b(?:figure|fig\\.?|diagram|sketch|illustration|illustrated|anatomy|structure|labelled|labeled|cross[- ]?section|schematic|parts)\\b/i.test(chunk)
        if (hasQuantitativeSignal && (!terms.length || topicMatches > 0)) score += 3
        if (hasVisualSignal && (!terms.length || topicMatches > 0)) score += 2
        candidates.push({score, topicMatches, page:pageItem.page, materialId:material.id, text:chunk, title:material.title || material.file_name || 'Study material'})
      }
    }
  }
  candidates.sort((a,b)=>b.score-a.score)
  const matched = terms.length ? candidates.filter(item=>item.topicMatches>0) : candidates
  return (matched.length ? matched : candidates).slice(0,8).map((item,index)=>'SOURCE '+(index+1)+' — '+item.title+' — PAGE '+item.page+' — MATERIAL '+item.materialId+'\n'+item.text).join('\n\n')
}

function buildVisualCandidates(materials, question = '') {
  const terms = termsFromQuestion(question), candidates = []
  for (const material of materials) {
    for (const item of (Array.isArray(material.page_text) ? material.page_text : [])) {
      const text = String(item?.text || '').trim(), lower = text.toLowerCase()
      if (!text) continue
      let topicMatches = 0
      for (const term of terms) if (lower.includes(term)) topicMatches += 1
      const visualMatches = (lower.match(/\b(?:figure|fig\.?|diagram|sketch|illustration|illustrated|anatomy|structure|labelled|labeled|cross[- ]?section|schematic|parts)\b/g)||[]).length
      // Prefer pages explicitly containing diagram language, but still allow a topic-matched source page as a visual candidate.
      // The page itself is rendered in the exam, so this keeps relevant textbook sketches available even when OCR missed the word "diagram".
      if (!visualMatches && topicMatches===0) continue
      candidates.push({score:topicMatches*8+visualMatches*2,materialId:material.id,page:Number(item.page)||1,excerpt:text.slice(0,900),title:material.title||material.file_name||'Study material'})
    }
  }
  candidates.sort((a,b)=>b.score-a.score)
  return candidates.slice(0,8)
}

function normalizeVisual(visual) {
  if (!visual || typeof visual !== 'object' || visual.type !== 'source_page') return {type:'none',material_id:'',page:0,caption:''}
  return {type:'source_page',material_id:String(visual.material_id||''),page:Math.max(1,Math.round(Number(visual.page)||1)),caption:String(visual.caption||'Study the labelled sketch / diagram on this source page.').slice(0,220)}
}
function graphMatchesScope(question, scope) {
  if (!scope || !scope.trim()) return true
  const terms = termsFromQuestion(scope)
  if (!terms.length) return true
  const chart = question?.chart_data || {}
  const haystack = [question?.topic, question?.prompt, chart.title, chart.x_label, chart.y_label, ...(chart.labels || [])].join(' ').toLowerCase()
  return terms.some(term => haystack.includes(term))
}

async function authenticate(request) {
  const supabase = getServerSupabase(request)
  if (!supabase) return { error: NextResponse.json({ error: 'Authentication is required.' }, { status: 401 }) }
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: NextResponse.json({ error: 'Your session is invalid or expired. Please log in again.' }, { status: 401 }) }
  return { supabase, user }
}

function extractModelText(result) {
  const geminiText = result?.candidates?.[0]?.content?.parts?.map(item => item.text || '').join('').trim()
  if (geminiText) return geminiText
  if (typeof result?.output_text === 'string' && result.output_text.trim()) return result.output_text.trim()
  const pieces = []
  for (const item of result?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string' && content.text.trim()) pieces.push(content.text.trim())
    }
  }
  return pieces.join('\n').trim()
}

function parseJsonText(raw) {
  if (!raw) return null
  const candidates = [raw]
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) candidates.push(fenced[1].trim())
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(raw.slice(firstBrace, lastBrace + 1))
  for (const candidate of candidates) {
    try { return JSON.parse(candidate) } catch {}
  }
  return null
}

function normalizeChart(chart) {
  if (!chart || typeof chart !== 'object') return { chart_type:'none', title:'', x_label:'', y_label:'', labels:[], values:[] }
  const type = ['none','bar','line'].includes(chart.chart_type) ? chart.chart_type : 'none'
  const title = String(chart.title || 'Graph').slice(0,160)
  const sourceType = ['source','illustrative'].includes(chart.source_type) ? chart.source_type : (/^illustrative\\b/i.test(title) ? 'illustrative' : 'source')
  const labels = Array.isArray(chart.labels) ? chart.labels.map(x=>String(x)).slice(0,12) : []
  const values = Array.isArray(chart.values) ? chart.values.map(Number).filter(Number.isFinite).slice(0,12) : []
  if (type === 'none' || labels.length < 2 || labels.length !== values.length) {
    return { chart_type:'none', title:'', x_label:'', y_label:'', labels:[], values:[], source_type:'source' }
  }
  return {
    chart_type:type,
    title,
    x_label:String(chart.x_label || '').slice(0,80),
    y_label:String(chart.y_label || '').slice(0,80),
    labels,
    values,
    source_type:sourceType,
  }
}

function normalizeQuestion(question) {
  const type = question?.question_type === 'short_answer' ? 'short_answer' : 'multiple_choice'
  const marks = Math.min(10, Math.max(1, Math.round(Number(question?.marks) || 1)))
  const options = type === 'multiple_choice' && Array.isArray(question?.options)
    ? question.options.map(x=>String(x)).slice(0,4)
    : []
  return {
    question_type:type,
    prompt:String(question?.prompt || '').trim(),
    options,
    correct_answer:String(question?.correct_answer || '').trim(),
    model_answer:String(question?.model_answer || question?.correct_answer || '').trim(),
    grading_rubric:String(question?.grading_rubric || question?.model_answer || '').trim(),
    explanation:String(question?.explanation || '').trim(),
    topic:String(question?.topic || 'General').trim(),
    marks,
    chart_data:normalizeChart(question?.chart_data),
    visual_data:normalizeVisual(question?.visual_data),
  }
}

function buildFallbackQuestions({count,scope,subjectName,context,visualCandidates}) {
  const sourceBlocks=context.split(/\n\n(?=SOURCE )/).map(x=>x.trim()).filter(Boolean)
  const snippets=[]
  for(const block of sourceBlocks){
    const body=block.split('\n').slice(1).join(' ').replace(/\s+/g,' ').trim()
    if(body) snippets.push(body.slice(0,420))
  }
  const unique=[...new Set(snippets)].slice(0,12)
  const topics=(scope||subjectName).split(',').map(x=>x.trim()).filter(Boolean)
  const topic=(i)=>topics[i%Math.max(1,topics.length)]||subjectName
  const questions=[]
  const pushMC=(i)=>{
    const correct=unique[i%Math.max(1,unique.length)]||'The supplied study material covers this topic.'
    const distractors=[
      'This statement is not supported by the supplied study material.',
      'This option describes a different concept from the requested topic.',
      'No conclusion can be drawn from the supplied study material.'
    ]
    questions.push({question_type:'multiple_choice',prompt:'Which statement is supported by the supplied study material about '+topic(i)+'?',options:[correct,...distractors].slice(0,4),correct_answer:correct,model_answer:correct,grading_rubric:correct,explanation:'Use the connected study material to identify the statement that is directly supported.',topic:topic(i),marks:i%3===0?2:1,chart_data:{chart_type:'none',title:'',x_label:'',y_label:'',labels:[],values:[],source_type:'source'},visual_data:{type:'none',material_id:'',page:0,caption:''}})
  }
  // Always include a short-answer question.
  const shortSnippet=unique[0]||'an important concept from the supplied study material'
  questions.push({question_type:'short_answer',prompt:'State and explain one important point from the study material about '+topic(0)+'.',options:[],correct_answer:'',model_answer:shortSnippet,grading_rubric:'Award full marks when the response accurately states a relevant point from the connected study material and explains it clearly.',explanation:'Answer using the connected study material.',topic:topic(0),marks:4,chart_data:{chart_type:'none',title:'',x_label:'',y_label:'',labels:[],values:[],source_type:'source'},visual_data:{type:'none',material_id:'',page:0,caption:''}})

  // A guaranteed topic-labelled line graph for every exam. Values are explicitly illustrative so no source data is invented.
  const lineLabels=['1','2','3','4','5'], lineValues=[2,5,3,7,6]
  questions.push({question_type:'short_answer',prompt:'Study the illustrative line graph. Which point has the highest value, and what overall trend do you observe?',options:[],correct_answer:'',model_answer:'The highest value is at point 4. The values rise overall with one dip at point 3.',grading_rubric:'Award marks for identifying point 4 as the highest and describing the overall rise with the dip at point 3.',explanation:'This is an illustrative practice graph for reading trends, not a measurement from the source.',topic:topic(1),marks:5,chart_data:{chart_type:'line',title:'Illustrative '+topic(1)+' trend',x_label:'Observation',y_label:'Illustrative value',labels:lineLabels,values:lineValues,source_type:'illustrative'},visual_data:{type:'none',material_id:'',page:0,caption:''}})

  if(count>=10){
    const barLabels=(topics.length>=3?topics.slice(0,4):['A','B','C','D']), barValues=[3,7,5,8].slice(0,barLabels.length)
    questions.push({question_type:'multiple_choice',prompt:'Study the illustrative bar graph. Which category has the highest value?',options:[barLabels[barValues.indexOf(Math.max(...barValues))],...barLabels.filter((_,i)=>i!==barValues.indexOf(Math.max(...barValues))).slice(0,3)],correct_answer:barLabels[barValues.indexOf(Math.max(...barValues))],model_answer:barLabels[barValues.indexOf(Math.max(...barValues))],grading_rubric:'Identify the bar with the greatest height.',explanation:'This is an illustrative practice graph for comparing categories.',topic:topic(2),marks:3,chart_data:{chart_type:'bar',title:'Illustrative '+topic(2)+' comparison',x_label:'Category',y_label:'Illustrative value',labels:barLabels,values:barValues,source_type:'illustrative'},visual_data:{type:'none',material_id:'',page:0,caption:''}})
  }
  if(visualCandidates?.length){
    const v=visualCandidates[0]
    questions.push({question_type:'short_answer',prompt:'Study the relevant source-page sketch/diagram shown with this question. Identify one labelled structure or feature you can see and state its function or role if it is given in the study material.',options:[],correct_answer:'',model_answer:'Any correctly identified labelled structure/feature supported by the connected study material.',grading_rubric:'Award marks for correctly identifying a relevant labelled structure/feature and accurately stating its supported role or function.',explanation:'The displayed page comes directly from the connected study material.',topic:topic(0),marks:4,chart_data:{chart_type:'none',title:'',x_label:'',y_label:'',labels:[],values:[],source_type:'source'},visual_data:{type:'source_page',material_id:v.materialId,page:v.page,caption:'Relevant source-page sketch / diagram'}})
  }
  while(questions.length<count) pushMC(questions.length)
  return questions.slice(0,count)
}

async function generateExam({ supabase, user, subjectId, count, difficulty = 'mixed', scope = '', timeLimit = 0, revisionContext = '' }) {
  const { data: profile } = await supabase.from('profiles').select('language').eq('id', user.id).maybeSingle()
  const { data: subject, error: subjectError } = await supabase.from('subjects').select('id,name').eq('id', subjectId).eq('user_id', user.id).maybeSingle()
  if (subjectError) return NextResponse.json({ error: subjectError.message }, { status: 400 })
  if (!subject) return NextResponse.json({ error: 'Subject not found.' }, { status: 404 })

  const { data: materials, error: materialError } = await supabase.from('materials').select('id,title,file_name,extracted_text,page_text,processing_status').eq('user_id', user.id).eq('subject_id', subjectId).eq('processing_status', 'ready').not('extracted_text', 'is', null)
  if (materialError) return NextResponse.json({ error: materialError.message }, { status: 400 })
  if (!materials?.length) return NextResponse.json({ error: 'This subject has no processed study material yet. Upload and read your material first.' }, { status: 400 })

  const context = buildMaterialContext(materials, scope)
  const visualCandidates = buildVisualCandidates(materials, scope)
  if (!context) return NextResponse.json({ error: 'I could not find enough extracted text to create an exam.' }, { status: 400 })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'The Mock Exam system is not connected yet. Add GEMINI_API_KEY to Vercel.' }, { status: 503 })

  // Gemini JSON mode is used instead of a nested responseSchema.
  const language = outputLanguage(profile)
  const difficultyText = difficulty === 'mixed' ? 'a balanced mix of easy, medium and hard' : difficulty
  const scopeText = scope ? `Cover ALL of these requested chapters/topics where the supplied material supports them: ${scope}. Spread questions across the requested topics instead of concentrating on only the first topic.` : 'Cover the most important examinable material from the supplied sources.'
  const revisionText = revisionContext ? `Create fresh questions that target the student’s mistakes below. Do not simply repeat the old questions.\nMISTAKES:\n${revisionContext}` : ''
  const graphDataLikely = /\d+(?:\.\d+)?\s*(?:%|percent|cm|mm|m|km|g|kg|mg|ml|l|s|sec|min|hours?|hz|°c|degrees?)/i.test(context) || /\b(?:table|graph|data|rate|frequency|concentration|temperature|mass|volume|distance|speed|percentage|increase|decrease)\b/i.test(context)
  const graphRequirement = graphDataLikely ? 'The supplied material contains quantitative/comparison signals, so MUST include at least 1 graph question and at least 1 of those graphs MUST be a LINE graph. For 10+ questions include both a line graph and a bar graph.' : 'Include a LINE graph when the supplied material contains suitable quantitative/comparison data.'

  // Keep generation fast and resilient. Current Gemini 3 models are the supported production models.
  // If capacity is unavailable, the local-material fallback below creates a usable exam instead of failing the student.
  const modelCandidates = ['gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash-lite']
  const visualCandidateText = visualCandidates.length ? visualCandidates.map((v,i)=>'VISUAL CANDIDATE '+(i+1)+': material_id='+v.materialId+', page='+v.page+', title='+v.title+'\n'+v.excerpt).join('\n\n') : 'No labelled source-page sketch candidates were detected.'
  const baseInstruction = `You are TIALO Mock Exam Generator for ${subject.name}. Write all student-facing text in ${language}. Use ONLY the supplied study material for factual content. Never invent subject facts or claim invented measurements came from the source.

Create exactly ${count} questions. Question mix is mandatory: for exams of 5 or more questions include at least 1 short-answer question and at least 1 graph-reading question. Use multiple choice for most remaining questions. Multiple-choice questions must have exactly four options. Short-answer questions must have no options and must include a concise model_answer plus grading_rubric describing the key points needed for full marks.

Every question is worth 1–10 marks. Use lower marks for simple recall and higher marks for explanations, comparisons, processes or multi-step reasoning. Do not make every question worth 1 mark.

GRAPH REQUIREMENT: Every exam must contain at least one graph-based question, and the graph MUST be about one of the requested chapters/topics. If the supplied material contains numerical/table data relevant to that topic, use those exact source values and set source_type to "source". If relevant source data does not exist, create an explicitly titled "Illustrative practice graph" tied directly to the requested topic, set source_type to "illustrative", and make clear that the numbers are an illustrative index for practice, NOT measurements from the source. The prompt must ask the student to read, compare, calculate from, or interpret the displayed graph. Never use a graph merely as decoration. Use chart_type "line" for at least one graph question in every exam. Use chart_type "bar" for an additional graph question when appropriate, especially in exams of 10+ questions. Every graph must have at least 3 labels and matching numeric values. For non-graph questions use chart_type "none" with empty labels and values.

SKETCH / DIAGRAM REQUIREMENT: When VISUAL CANDIDATES are available, include at least one question that displays a relevant source-page sketch/diagram. Set visual_data.type to source_page and use the exact material_id and page from a VISUAL CANDIDATE. The question must explicitly tell the student to study the sketch/diagram and ask a question that can be answered from that sketch plus the supplied study material. Do not use an unrelated page. If no relevant visual candidate exists, set visual_data.type to none.

If multiple chapters/topics are requested, distribute questions across ALL requested topics where the material supports them; do not concentrate on only the first topic. Label every question with its topic/chapter. Difficulty: ${difficultyText}. ${scopeText} ${revisionText}
${graphRequirement}

VISUAL CANDIDATES (use these exact IDs/pages when adding a sketch question):
${visualCandidateText}

SUPPLIED STUDY MATERIAL:
${context}`
  const userInstruction = `Generate a ${count}-question ${difficultyText} mock exam for ${subject.name}. Include varied 1–10 mark questions, at least one short-answer question, at least one LINE graph-reading question, and at least one relevant source-page sketch/diagram question when VISUAL CANDIDATES are available.`

  async function requestGeneration(extraInstruction='') {
    let lastResponse = null
    let lastResult = {}
    for (const modelName of modelCandidates) {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 9000)
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`, {
          method:'POST',
          headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},
          signal:controller.signal,
          body:JSON.stringify({
            systemInstruction:{parts:[{text:baseInstruction + (extraInstruction ? '\\n\\nMANDATORY REPAIR: ' + extraInstruction : '')}]},
            contents:[{role:'user',parts:[{text:userInstruction}]}],
            generationConfig:{responseMimeType:'application/json',maxOutputTokens:12000,thinkingConfig:{thinkingLevel:'low'}}
          }),
        })
        const result = await response.json().catch(()=>({}))
        if (response.ok) return { response, result, modelName }
        lastResponse = response
        lastResult = result
      } catch (error) {
        lastResponse = new Response(null,{status:503})
        lastResult = {error:{message:error?.name==='AbortError'?'Gemini generation timed out.':String(error?.message||error),status:'UNAVAILABLE'}}
      } finally {
        clearTimeout(timeout)
      }
    }
    return { response:lastResponse || new Response(null,{status:503}), result:lastResult, modelName:null }
  }

  let {response, result, modelName} = await requestGeneration()
  if (!response.ok) {
    console.error('Gemini Mock Exam error:', result)
    const fallbackQuestions=buildFallbackQuestions({count,scope,subjectName:subject.name,context,visualCandidates})
    const fallbackTitle=`${subject.name} Mock Exam`
    const fallbackData={title:fallbackTitle,questions:fallbackQuestions}
    response=new Response(JSON.stringify({ok:true}),{status:200,headers:{'content-type':'application/json'}})
    result={}
    modelName='local-material-fallback'
    let examData=fallbackData
    let questions=fallbackQuestions.map(normalizeQuestion)
    // Continue through the normal validation and persistence path below.
    const totalMarks=questions.reduce((sum,q)=>sum+q.marks,0)
    const { data: exam, error: examError } = await supabase.from('exam_attempts').insert({
      user_id:user.id,subject_id:subject.id,title:fallbackTitle,question_count:count,total_marks:totalMarks,status:'in_progress',difficulty,scope:scope||null,time_limit_seconds:timeLimit
    }).select('id,title,question_count,total_marks,status,created_at,difficulty,scope,time_limit_seconds,subject_id').single()
    if(examError)return NextResponse.json({error:examError.message},{status:400})
    const rows=questions.map((question,index)=>({exam_id:exam.id,position:index+1,prompt:question.prompt,options:question.options,correct_answer:question.correct_answer,student_answer:null,marks:question.marks,explanation:question.explanation||null,topic:question.topic||scope||'General',question_type:question.question_type,model_answer:question.model_answer||question.correct_answer,grading_rubric:question.grading_rubric||question.model_answer||question.correct_answer,chart_data:question.chart_data,visual_data:question.visual_data}))
    const {data:savedQuestions,error:questionsError}=await supabase.from('exam_questions').insert(rows).select('id,position,prompt,options,marks,topic,question_type,chart_data,visual_data')
    if(questionsError){await supabase.from('exam_attempts').delete().eq('id',exam.id).eq('user_id',user.id);return NextResponse.json({error:questionsError.message},{status:400})}
    return NextResponse.json({exam,questions:savedQuestions})
  }

  let examData = parseJsonText(extractModelText(result))
  let questions = Array.isArray(examData?.questions) ? examData.questions.slice(0,count).map(normalizeQuestion) : []

  const hasGraph = questions.some(q => q.chart_data.chart_type !== 'none' && q.chart_data.labels.length >= 3 && q.chart_data.labels.length === q.chart_data.values.length && graphMatchesScope(q, scope))
  const hasLineGraph = questions.some(q => q.chart_data.chart_type === 'line' && q.chart_data.labels.length >= 3 && q.chart_data.labels.length === q.chart_data.values.length && graphMatchesScope(q, scope))
  const hasBarGraph = questions.some(q => q.chart_data.chart_type === 'bar' && q.chart_data.labels.length >= 3 && q.chart_data.labels.length === q.chart_data.values.length && graphMatchesScope(q, scope))
  const hasVisualQuestion = questions.some(q => q.visual_data.type === 'source_page' && visualCandidates.some(v=>v.materialId===q.visual_data.material_id && v.page===q.visual_data.page))
  const hasShortAnswer = questions.some(q => q.question_type === 'short_answer')
  if (questions.length === count && (!hasGraph || !hasLineGraph || (count >= 10 && !hasBarGraph) || (count >= 5 && !hasShortAnswer) || (visualCandidates.length && !hasVisualQuestion))) {
    const missing = [!hasGraph ? 'at least one graph question about the requested topic(s)' : '', !hasLineGraph ? 'at least one LINE graph question' : '', (count >= 10 && !hasBarGraph) ? 'at least one BAR graph question' : '', (count >= 5 && !hasShortAnswer) ? 'at least one short-answer question' : '', (visualCandidates.length && !hasVisualQuestion) ? 'at least one relevant source-page sketch/diagram question using a listed VISUAL CANDIDATE' : ''].filter(Boolean).join(' and ')
    ({response, result, modelName} = await requestGeneration(`The previous output did not satisfy the exam requirements. You MUST include ${missing}. The graph must match the requested topic(s) and must not switch to an unrelated chapter. If relevant source data is unavailable, use an explicitly titled "Illustrative practice graph" tied to the requested topic and set source_type to "illustrative".`))
    if (response.ok) {
      examData = parseJsonText(extractModelText(result))
      questions = Array.isArray(examData?.questions) ? examData.questions.slice(0,count).map(normalizeQuestion) : []
    }
  }

  if (!response.ok) {
    console.error('Gemini Mock Exam repair error:', result)
    return NextResponse.json({ error: result?.error?.message || 'The mock exam could not be generated right now.' }, { status: response.status === 429 ? 429 : 502 })
  }

  if (!examData || !Array.isArray(examData.questions)) {
    console.error('Mock exam invalid JSON payload:', JSON.stringify({ hasCandidates:Array.isArray(result?.candidates), finishReason:result?.candidates?.[0]?.finishReason, promptFeedback:result?.promptFeedback, raw:extractModelText(result)?.slice(0,1000) }))
    return NextResponse.json({ error:'The AI returned an invalid exam format. Please try again.' }, { status:502 })
  }
  if (questions.length !== count) return NextResponse.json({ error:'The AI did not generate the required number of questions. Please try again.' }, { status:502 })

  for (const question of questions) {
    if (!question.prompt || question.marks < 1 || question.marks > 10) return NextResponse.json({ error:'The generated exam failed validation. Please try again.' }, { status:502 })
    if (question.question_type === 'multiple_choice' && (!question.correct_answer || question.options.length !== 4)) return NextResponse.json({ error:'The generated multiple-choice question format was invalid. Please try again.' }, { status:502 })
    if (question.question_type === 'multiple_choice' && !question.options.includes(question.correct_answer)) return NextResponse.json({ error:'The generated multiple-choice answer did not match an option. Please try again.' }, { status:502 })
    if (question.question_type === 'short_answer' && !question.grading_rubric) return NextResponse.json({ error:'The generated short-answer marking guide was invalid. Please try again.' }, { status:502 })
    if (question.chart_data.chart_type !== 'none' && question.chart_data.labels.length !== question.chart_data.values.length) return NextResponse.json({ error:'The generated graph data was invalid. Please try again.' }, { status:502 })
    if (question.visual_data.type === 'source_page' && !visualCandidates.some(v=>v.materialId===question.visual_data.material_id && v.page===question.visual_data.page)) return NextResponse.json({ error:'The generated sketch reference was invalid. Please try again.' }, { status:502 })
  }

  const graphCount = questions.filter(q => q.chart_data.chart_type !== 'none' && q.chart_data.labels.length >= 3 && q.chart_data.labels.length === q.chart_data.values.length && graphMatchesScope(q, scope)).length
  const lineGraphCount = questions.filter(q=>q.chart_data.chart_type==='line' && q.chart_data.labels.length>=3 && q.chart_data.labels.length===q.chart_data.values.length && graphMatchesScope(q,scope)).length
  const barGraphCount = questions.filter(q=>q.chart_data.chart_type==='bar' && q.chart_data.labels.length>=3 && q.chart_data.labels.length===q.chart_data.values.length && graphMatchesScope(q,scope)).length
  const visualCount = questions.filter(q=>q.visual_data.type==='source_page').length
  const shortAnswerCount = questions.filter(q => q.question_type === 'short_answer').length
  if (graphCount < 1 || lineGraphCount < 1 || (count >= 10 && barGraphCount < 1)) return NextResponse.json({ error:'The generated exam did not include the required line/bar graph questions. Please try again.' }, { status:502 })
  if (visualCandidates.length && visualCount < 1) return NextResponse.json({ error:'The generated exam did not include the required relevant sketch question. Please try again.' }, { status:502 })
  if (count >= 5 && shortAnswerCount < 1) return NextResponse.json({ error:'The generated exam did not include a short-answer question. Please try again.' }, { status:502 })

  const totalMarks = questions.reduce((sum,q)=>sum+q.marks,0)
  const { data: exam, error: examError } = await supabase.from('exam_attempts').insert({
    user_id:user.id,
    subject_id:subject.id,
    title:examData.title || `${subject.name} Mock Exam`,
    question_count:count,
    total_marks:totalMarks,
    status:'in_progress',
    difficulty,
    scope:scope || null,
    time_limit_seconds:timeLimit
  }).select('id,title,question_count,total_marks,status,created_at,difficulty,scope,time_limit_seconds,subject_id').single()
  if (examError) return NextResponse.json({ error:examError.message }, { status:400 })

  const rows = questions.map((question,index)=>({
    exam_id:exam.id,
    position:index+1,
    prompt:question.prompt,
    options:question.options,
    correct_answer:question.correct_answer,
    student_answer:null,
    marks:question.marks,
    explanation:question.explanation || null,
    topic:question.topic || scope || 'General',
    question_type:question.question_type,
    model_answer:question.model_answer || question.correct_answer,
    grading_rubric:question.grading_rubric || question.model_answer || question.correct_answer,
    chart_data:question.chart_data,
    visual_data:question.visual_data,
  }))
  const { data:savedQuestions, error:questionsError } = await supabase.from('exam_questions').insert(rows).select('id,position,prompt,options,marks,topic,question_type,chart_data,visual_data')
  if (questionsError) {
    await supabase.from('exam_attempts').delete().eq('id',exam.id).eq('user_id',user.id)
    return NextResponse.json({ error:questionsError.message }, { status:400 })
  }
  return NextResponse.json({ exam, questions:savedQuestions })
}

function gradeShortAnswersLocally(items) {
  const stop = new Set('the a an and or but is are was were be been being to of in on for from with without what why how when where which who does do did can could should would will this that these those it its as at by about into than then them they their you your i me my we our explain state describe name give tell one two three four five six'.split(' '))
  const words = text => [...new Set((String(text||'').toLowerCase().match(/[a-z0-9]+/g)||[]).filter(w=>w.length>2 && !stop.has(w)))]
  const grade = item => {
    const answer = String(item.student_answer||'').trim()
    const marks = Math.max(1, Number(item.marks)||1)
    if (!answer) return {awarded_marks:0,feedback:'No answer was provided.'}

    const reference = String(item.model_answer||'')+' '+String(item.grading_rubric||'')
    const refWords = words(reference)
    const answerWords = new Set(words(answer))
    const overlap = refWords.filter(w=>answerWords.has(w)).length
    const coverage = refWords.length ? overlap/refWords.length : 0
    const phrase = String(item.model_answer||'').trim().toLowerCase()
    const answerLower = answer.toLowerCase()
    const phraseMatch = phrase.length >= 18 && answerLower.includes(phrase.slice(0, Math.min(80, phrase.length))) ? 1 : 0
    const conceptScore = Math.max(coverage, phraseMatch)
    let awarded
    if (conceptScore >= 0.75) awarded = marks
    else if (conceptScore >= 0.55) awarded = Math.max(1, Math.ceil(marks*0.75))
    else if (conceptScore >= 0.35) awarded = Math.max(1, Math.ceil(marks*0.5))
    else if (conceptScore >= 0.15) awarded = Math.max(0, Math.floor(marks*0.25))
    else awarded = 0

    const feedback = awarded===marks
      ? 'Your answer covers the main points required by the marking guide.'
      : awarded>0
        ? `You included some of the required points. Add the key concepts from the model answer/marking guide for full marks.`
        : 'Your answer does not contain enough of the key points in the marking guide. Review the model answer and try again.'
    return {awarded_marks:awarded,feedback}
  }
  return new Map(items.map(item=>[item.position,grade(item)]))
}

async function submitExam({supabase,user,examId,answers}) {
  if (!examId || !Array.isArray(answers)) return NextResponse.json({error:'Exam ID and answers are required.'},{status:400})
  const {data:exam,error:examError}=await supabase.from('exam_attempts').select('id,user_id,question_count,total_marks,status,subject_id,title,created_at,time_limit_seconds,difficulty,scope').eq('id',examId).eq('user_id',user.id).maybeSingle()
  if (examError) return NextResponse.json({error:examError.message},{status:400})
  if (!exam) return NextResponse.json({error:'Exam not found.'},{status:404})
  if (exam.status==='completed') return NextResponse.json({error:'This exam has already been submitted.'},{status:400})
  const timedOut=exam.time_limit_seconds>0 && (Date.now()-new Date(exam.created_at).getTime())>exam.time_limit_seconds*1000
  const {data:questions,error:questionError}=await supabase.from('exam_questions').select('id,position,prompt,options,correct_answer,marks,explanation,topic,question_type,model_answer,grading_rubric,chart_data,visual_data').eq('exam_id',exam.id).order('position',{ascending:true})
  if (questionError) return NextResponse.json({error:questionError.message},{status:400})

  const answerMap=new Map(answers.map(item=>[Number(item.position),typeof item.answer==='string'?item.answer.slice(0,5000):'']))
  const shortItems=(questions||[]).filter(q=>q.question_type==='short_answer').map(q=>({...q,student_answer:answerMap.get(q.position)||''})).filter(q=>q.student_answer.trim())
  // Short answers are graded locally against the saved model answer + marking rubric.
  // This keeps submission reliable even when Gemini is busy or unavailable.
  let shortGrades=new Map()
  if (!timedOut && shortItems.length) {
    shortGrades=gradeShortAnswersLocally(shortItems)
  }

  let score=0
  const review=[]
  for (const question of questions||[]) {
    const answer=answerMap.get(question.position)||''
    let awarded=0
    let correct=false
    let feedback=''
    if (!timedOut) {
      if (question.question_type==='short_answer') {
        const grade=shortGrades.get(question.position)
        awarded=grade?.awarded_marks||0
        feedback=grade?.feedback||''
        correct=awarded===question.marks
      } else {
        correct=answer===question.correct_answer
        awarded=correct?(question.marks||1):0
      }
    }
    score+=awarded
    await supabase.from('exam_questions').update({student_answer:answer||null}).eq('id',question.id)
    review.push({
      id:question.id,
      position:question.position,
      prompt:question.prompt,
      options:question.options,
      student_answer:answer,
      correct_answer:question.correct_answer,
      correct,
      awarded_marks:awarded,
      marks:question.marks,
      explanation:question.explanation,
      topic:question.topic,
      question_type:question.question_type,
      chart_data:question.chart_data,
      visual_data:question.visual_data,
      feedback,
      model_answer:question.model_answer,
      grading_rubric:question.grading_rubric,
    })
  }
  const {error:updateError}=await supabase.from('exam_attempts').update({score,status:'completed',completed_at:new Date().toISOString()}).eq('id',exam.id).eq('user_id',user.id)
  if (updateError) return NextResponse.json({error:updateError.message},{status:400})
  return NextResponse.json({exam:{...exam,score,status:'completed',timed_out:timedOut},review})
}

export async function GET(request) {
  const auth=await authenticate(request); if(auth.error)return auth.error
  const {supabase,user}=auth
  const examId=new URL(request.url).searchParams.get('examId')

  if (examId) {
    const {data:exam,error:examError}=await supabase.from('exam_attempts')
      .select('id,title,subject_id,question_count,score,total_marks,status,created_at,completed_at,difficulty,scope,time_limit_seconds,subjects(name)')
      .eq('id',examId).eq('user_id',user.id).maybeSingle()
    if(examError)return NextResponse.json({error:examError.message},{status:400})
    if(!exam)return NextResponse.json({error:'Exam not found.'},{status:404})

    const {data:questions,error:questionError}=await supabase.from('exam_questions')
      .select('id,position,prompt,options,correct_answer,student_answer,marks,explanation,topic,question_type,model_answer,grading_rubric,chart_data,visual_data')
      .eq('exam_id',exam.id).order('position',{ascending:true})
    if(questionError)return NextResponse.json({error:questionError.message},{status:400})

    const shortItems=(questions||[]).filter(q=>q.question_type==='short_answer').map(q=>({...q,student_answer:q.student_answer||''})).filter(q=>q.student_answer.trim())
    const shortGrades=gradeShortAnswersLocally(shortItems)
    const review=(questions||[]).map(question=>{
      const answer=question.student_answer||''
      const shortGrade=question.question_type==='short_answer' ? shortGrades.get(question.position) : null
      const awarded=question.question_type==='short_answer'
        ? (shortGrade?.awarded_marks||0)
        : (answer===question.correct_answer ? question.marks : 0)
      return {
        id:question.id,
        position:question.position,
        prompt:question.prompt,
        options:question.options,
        student_answer:answer,
        correct_answer:question.correct_answer,
        correct:awarded===question.marks,
        awarded_marks:awarded,
        marks:question.marks,
        explanation:question.explanation,
        topic:question.topic,
        question_type:question.question_type,
        model_answer:question.model_answer,
        grading_rubric:question.grading_rubric,
        chart_data:question.chart_data,
        visual_data:question.visual_data,
        feedback:shortGrade?.feedback||'',
      }
    })

    return NextResponse.json({exam,questions:questions||[],review})
  }

  const {data,error}=await supabase.from('exam_attempts').select('id,title,subject_id,question_count,score,total_marks,status,created_at,completed_at,difficulty,scope,time_limit_seconds,subjects(name)').eq('user_id',user.id).order('created_at',{ascending:false}).limit(50)
  if(error)return NextResponse.json({error:error.message},{status:400})
  return NextResponse.json({exams:data||[]})
}

export async function POST(request) {
  const auth=await authenticate(request); if(auth.error)return auth.error
  const {supabase,user}=auth
  let body
  try{body=await request.json()}catch{return NextResponse.json({error:'Invalid request.'},{status:400})}
  if(body?.action==='submit')return submitExam({supabase,user,examId:body.examId,answers:body.answers})
  if(body?.action==='revision'){
    const {data:sourceExam}=await supabase.from('exam_attempts').select('subject_id').eq('id',body.examId).eq('user_id',user.id).maybeSingle()
    if(!sourceExam)return NextResponse.json({error:'Completed exam not found.'},{status:404})
    const {data:wrong}=await supabase.from('exam_questions').select('prompt,correct_answer,student_answer,explanation,topic,question_type,marks').eq('exam_id',body.examId)
    const mistakes=(wrong||[]).filter(q=>(q.student_answer||'')!==q.correct_answer)
    if(!mistakes.length)return NextResponse.json({error:'You have no mistakes to revise from this exam.'},{status:400})
    const revisionContext=mistakes.slice(0,12).map((q,i)=>`${i+1}. Topic: ${q.topic||'General'} | Type: ${q.question_type||'multiple_choice'} | Marks: ${q.marks||1} | Question: ${q.prompt} | Student answer: ${q.student_answer||'Not answered'} | Correct/model answer: ${q.correct_answer} | Explanation: ${q.explanation||''}`).join('\n')
    return generateExam({supabase,user,subjectId:sourceExam.subject_id,count:Math.min(10,Math.max(5,mistakes.length)),difficulty:'targeted',scope:mistakes.map(q=>q.topic).filter(Boolean).join(', '),timeLimit:0,revisionContext})
  }
  const subjectId=body?.subjectId
  const count=Math.min(Math.max(Number(body?.count)||10,5),20)
  const difficulty=['easy','medium','hard','mixed'].includes(body?.difficulty)?body.difficulty:'mixed'
  const scope=typeof body?.scope==='string'?body.scope.trim().slice(0,600):''
  const timeLimit=Math.min(Math.max(Number(body?.timeLimit)||0,0),10800)
  if(!subjectId)return NextResponse.json({error:'Please choose a subject.'},{status:400})
  return generateExam({supabase,user,subjectId,count,difficulty,scope,timeLimit})
}
