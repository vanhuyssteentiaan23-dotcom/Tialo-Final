'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import {getSupabaseBrowserClient} from '../../lib/supabase'
import WorkspaceHeader from '../components/WorkspaceHeader'

let pdfjsPromise
async function getBrowserPdfJs(){
 if(!pdfjsPromise)pdfjsPromise=import('pdfjs-dist/legacy/build/pdf.mjs')
 const pdfjs=await pdfjsPromise
 pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.min.mjs'
 return pdfjs
}

function SourceSketch({material,page,caption}){
 const [image,setImage]=useState(''),[state,setState]=useState('Loading sketch…')
 useEffect(()=>{
  let cancelled=false
  async function render(){
   if(!material?.id||material.mime_type!=='application/pdf'){setState('Source sketch unavailable.');return}
   try{
    const s=getSupabaseBrowserClient(); if(!s)throw Error('Could not connect to your account.')
    let {data:{session}}=await s.auth.getSession()
    if(!session?.access_token){const refreshed=await s.auth.refreshSession();session=refreshed.data?.session||null}
    if(!session?.access_token)throw Error('Your login session has expired.')
    const response=await fetch('/api/materials/source?materialId='+encodeURIComponent(material.id),{headers:{Authorization:'Bearer '+session.access_token}})
    if(!response.ok)throw Error('Source PDF could not be loaded.')
    const pdfjs=await getBrowserPdfJs()
    const blob=await response.blob()
    const pdf=await pdfjs.getDocument({data:new Uint8Array(await blob.arrayBuffer())}).promise
    const pdfPage=await pdf.getPage(Number(page))
    const base=pdfPage.getViewport({scale:1})
    const scale=Math.min(1.35,900/base.width)
    const viewport=pdfPage.getViewport({scale})
    const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
    await pdfPage.render({canvasContext:canvas.getContext('2d',{alpha:false}),viewport}).promise
    if(!cancelled){setImage(canvas.toDataURL('image/jpeg',.84));setState('')}
    await pdf.destroy()
   }catch(e){if(!cancelled)setState(e?.message||'Could not render source sketch.')}
  }
  render()
  return()=>{cancelled=true}
 },[material?.id,page])
 return image?<figure className="mock-sketch"><img src={image} alt={caption||'Relevant source sketch'} loading="lazy"/><figcaption>{caption||'Relevant source sketch'} · Source page {page}</figcaption></figure>:<div className="mock-sketch-loading">{state}</div>
}
const nav=[['Overview','⌂','/dashboard'],['Subjects','▱','/subjects'],['Summaries','▤','/summaries'],['AI Tutor','✦','/ai-tutor'],['Mock Exams','□','/mock-exams'],['Daily Tasks','✓','/daily-tasks'],['Progress','↗','/progress']]

function ExamGraph({chart}) {
 if(!chart || !['bar','line'].includes(chart.chart_type) || !Array.isArray(chart.labels) || !Array.isArray(chart.values) || chart.labels.length<2 || chart.labels.length!==chart.values.length)return null
 const width=760,height=320,left=58,right=24,top=44,bottom=64
 const plotW=width-left-right,plotH=height-top-bottom
 const max=Math.max(...chart.values,0),min=Math.min(...chart.values,0),range=max-min||1
 const y=v=>top+((max-v)/range)*plotH
 const step=chart.labels.length>1?plotW/(chart.labels.length-1):plotW
 const barW=Math.min(54,plotW/chart.labels.length*.62)
 const points=chart.values.map((v,i)=>({x:left+i*step,y:y(v),v}))
 const ticks=[0,1,2,3,4].map(i=>max-(range*i/4))
 return <div className="graph-wrap">
  <div className="graph-title">{chart.title}</div>
  <svg className="exam-graph" viewBox={'0 0 '+width+' '+height} role="img" aria-label={chart.title}>
   {ticks.map((v,i)=><g key={i}><line x1={left} x2={width-right} y1={y(v)} y2={y(v)} className="graph-grid"/><text x={left-10} y={y(v)+4} textAnchor="end" className="graph-axis">{Number.isInteger(v)?v:v.toFixed(1)}</text></g>)}
   <line x1={left} x2={width-right} y1={top+plotH} y2={top+plotH} className="graph-axis-line"/>
   {chart.chart_type==='bar' ? chart.values.map((v,i)=>{
    const zero=y(Math.max(0,min)),yy=v>=0?y(v):zero,hh=Math.abs(zero-y(v)),x=left+(plotW/chart.labels.length)*i+(plotW/chart.labels.length-barW)/2
    return <g key={i}><rect x={x} y={yy} width={barW} height={Math.max(2,hh)} rx="5" className="graph-bar"/><text x={x+barW/2} y={yy-7} textAnchor="middle" className="graph-value">{v}</text></g>
   }) : <><polyline points={points.map(p=>p.x+','+p.y).join(' ')} className="graph-line" fill="none"/>{points.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="5" className="graph-point"/>)}</>}
   {chart.labels.map((label,i)=>{
    const x=chart.chart_type==='bar'?left+(plotW/chart.labels.length)*i+(plotW/chart.labels.length)/2:left+i*step
    return <text key={i} x={x} y={height-32} textAnchor="middle" className="graph-label">{String(label).slice(0,22)}</text>
   })}
   <text x={left+plotW/2} y={height-8} textAnchor="middle" className="graph-axis-label">{chart.x_label}</text>
   <text x="15" y={top+plotH/2} transform={'rotate(-90 15 '+(top+plotH/2)+')'} textAnchor="middle" className="graph-axis-label">{chart.y_label}</text>
  </svg>
  <div className="graph-source">{chart.source_type==='illustrative' || /^illustrative\b/i.test(String(chart.title||'')) ? 'Illustrative practice graph based on the requested topic.' : 'Graph values taken from the connected study material.'}</div>
 </div>
}

export default function MockExamsPage(){
 const [subjects,setSubjects]=useState([]),[materials,setMaterials]=useState([]),[subjectId,setSubjectId]=useState(''),[count,setCount]=useState(10),[difficulty,setDifficulty]=useState('mixed'),[scope,setScope]=useState(''),[timeLimit,setTimeLimit]=useState(0),[exam,setExam]=useState(null),[questions,setQuestions]=useState([]),[answers,setAnswers]=useState({}),[current,setCurrent]=useState(0),[review,setReview]=useState(null),[history,setHistory]=useState([]),[loading,setLoading]=useState(true),[working,setWorking]=useState(false),[error,setError]=useState(''),[secondsLeft,setSecondsLeft]=useState(0),[openReviews,setOpenReviews]=useState({})
 const selected=useMemo(()=>subjects.find(x=>x.id===subjectId),[subjects,subjectId])
 const examActiveSecondsRef=useRef(0)
 const examActiveSinceRef=useRef(null)
 const examIdRef=useRef(null)
 function startExamTime(examId){
  examIdRef.current=examId||null
  examActiveSecondsRef.current=0
  examActiveSinceRef.current=examId?Date.now():null
 }
 function pauseExamTime(){
  if(examActiveSinceRef.current){
   examActiveSecondsRef.current+=Math.max(0,Math.floor((Date.now()-examActiveSinceRef.current)/1000))
   examActiveSinceRef.current=null
  }
 }
 function getExamTimeSeconds(){
  if(examActiveSinceRef.current){
   examActiveSecondsRef.current+=Math.max(0,Math.floor((Date.now()-examActiveSinceRef.current)/1000))
   examActiveSinceRef.current=Date.now()
  }
  return Math.max(0,examActiveSecondsRef.current)
 }
 useEffect(()=>{
  const onVisibility=()=>document.hidden?pauseExamTime(): (exam&& !review && examIdRef.current===exam?.id && !examActiveSinceRef.current ? examActiveSinceRef.current=Date.now() : null)
  document.addEventListener('visibilitychange',onVisibility)
  return()=>document.removeEventListener('visibilitychange',onVisibility)
 },[exam,review])
 async function token(s){const {data}=await s.auth.getSession();if(data?.session?.access_token)return data.session.access_token;const r=await s.auth.refreshSession();if(!r.data?.session?.access_token)throw Error('Your login session has expired.');return r.data.session.access_token}
 useEffect(()=>{async function load(){const s=getSupabaseBrowserClient();if(!s){location.href='/login';return}const {data:{user}}=await s.auth.getUser();if(!user){location.href='/login';return}const a=await s.from('subjects').select('id,name').eq('user_id',user.id).order('created_at',{ascending:true});const m=await s.from('materials').select('id,subject_id,title,file_name,mime_type,storage_path,processing_status').eq('user_id',user.id).eq('processing_status','ready');if(a.error)setError(a.error.message);else{setSubjects(a.data||[]);if(a.data?.[0])setSubjectId(a.data[0].id)}if(!m.error)setMaterials(m.data||[]);try{const t=await token(s),r=await fetch('/api/mock-exams',{headers:{Authorization:'Bearer '+t}}),j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Could not load history.');setHistory(j.exams||[])}catch(e){setError(e.message)}setLoading(false)}load()},[])
 async function generate(){if(!subjectId||working)return;setWorking(true);setError('');setReview(null);setExam(null);setAnswers({});try{const s=getSupabaseBrowserClient(),t=await token(s),r=await fetch('/api/mock-exams',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({subjectId,count,difficulty,scope,timeLimit})}),j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Could not generate the exam.');setExam(j.exam);setQuestions(j.questions||[]);setCurrent(0);setSecondsLeft(j.exam?.time_limit_seconds||0);startExamTime(j.exam?.id);scrollTo(0,0)}catch(e){setError(e.message)}finally{setWorking(false)}}
 async function openPreviousExam(examId){
  if(!examId||working)return
  setWorking(true);setError('')
  try{
    const s=getSupabaseBrowserClient(),t=await token(s)
    const r=await fetch('/api/mock-exams?examId='+encodeURIComponent(examId),{headers:{Authorization:'Bearer '+t}})
    const j=await r.json().catch(()=>({}))
    if(!r.ok)throw Error(j.error||'Could not open this exam.')
    const previous=j.exam
    setExam(previous)
    if(previous?.status==='in_progress')startExamTime(previous.id);else startExamTime(null)
    setQuestions(j.questions||[])
    setCurrent(0)
    setSecondsLeft(previous?.time_limit_seconds||0)
    setAnswers(Object.fromEntries((j.questions||[]).map(q=>[q.position,q.student_answer||'']).filter(([,v])=>v)))
    setOpenReviews({})
    if(previous.status==='completed')setReview(j.review||[])
    else setReview(null)
    const previousSubjectId=previous.subject_id
    if(previousSubjectId)setSubjectId(previousSubjectId)
    scrollTo(0,0)
  }catch(e){setError(e.message)}
  finally{setWorking(false)}
 }
 async function submit(e){e.preventDefault();if(!exam||working)return;setWorking(true);setError('');try{const s=getSupabaseBrowserClient(),t=await token(s),payload=questions.map(q=>({position:q.position,answer:answers[q.position]||''})),r=await fetch('/api/mock-exams',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({action:'submit',examId:exam.id,answers:payload,durationSeconds:getExamTimeSeconds()})}),j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Could not submit the exam.');setReview(j.review||[]);setExam(j.exam);setCurrent(0);setSecondsLeft(0);const h=await fetch('/api/mock-exams',{headers:{Authorization:'Bearer '+t}}),hj=await h.json().catch(()=>({}));if(h.ok)setHistory(hj.exams||[]);scrollTo(0,0)}catch(e){setError(e.message)}finally{setWorking(false)}}
 const reset=()=>{pauseExamTime();startExamTime(null);setExam(null);setQuestions([]);setAnswers({});setReview(null);setOpenReviews({});setCurrent(0);setError('');setSecondsLeft(0);scrollTo(0,0)}
 const toggleReview=(position)=>setOpenReviews(v=>({...v,[position]:!v[position]}))
 const submitExam=async()=>{if(!exam||working)return;setWorking(true);setError('');try{const s=getSupabaseBrowserClient(),t=await token(s),payload=questions.map(q=>({position:q.position,answer:answers[q.position]||''})),r=await fetch('/api/mock-exams',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({action:'submit',examId:exam.id,answers:payload,durationSeconds:getExamTimeSeconds()})}),j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Could not submit the exam.');setReview(j.review||[]);pauseExamTime();setExam(j.exam);setSecondsLeft(0);const h=await fetch('/api/mock-exams',{headers:{Authorization:'Bearer '+t}}),hj=await h.json().catch(()=>({}));if(h.ok)setHistory(hj.exams||[]);scrollTo(0,0)}catch(e){setError(e.message)}finally{setWorking(false)}}
 const createRevision=async()=>{if(!exam||working)return;setWorking(true);setError('');try{const s=getSupabaseBrowserClient(),t=await token(s),r=await fetch('/api/mock-exams',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+t},body:JSON.stringify({action:'revision',examId:exam.id})}),j=await r.json().catch(()=>({}));if(!r.ok)throw Error(j.error||'Could not create revision exam.');setExam(j.exam);setQuestions(j.questions||[]);setAnswers({});setReview(null);setCurrent(0);scrollTo(0,0)}catch(e){setError(e.message)}finally{setWorking(false)}}
 useEffect(()=>{if(!exam||review||!exam.time_limit_seconds)return;const started=new Date(exam.created_at).getTime();const tick=()=>{const left=Math.max(0,Math.ceil((exam.time_limit_seconds*1000-(Date.now()-started))/1000));setSecondsLeft(left);if(left===0&&!working)submitExam()};tick();const id=setInterval(tick,1000);return()=>clearInterval(id)},[exam,review,working])
 if(loading)return <main className="shell dashboard-loading"><div className="loader-card"><div className="brand">TIA<span>LO</span></div><p>Loading your exams…</p></div></main>
 return <main className="dashboard-shell tialo-workspace"><aside className="sidebar"><a className="brand" href="/dashboard">TIA<span>LO</span></a><div className="sidebar-label">Workspace</div><nav className="sidebar-nav">{nav.map(([n,i,h])=><a className={'side-link '+(h==='/mock-exams'?'active':'')} href={h} key={h}><span>{i}</span>{n}</a>)}</nav><div className="sidebar-bottom"><a className="side-settings" href="/settings">⚙ Settings</a></div></aside><section className="dashboard-main"><WorkspaceHeader title="Mock Exams" subtitle="Practice from your material" active="/mock-exams"/><div className="dashboard-content mock-page">
 {!exam&&<><div className="workspace-intro"><div><div className="eyebrow">TIALO · MOCK EXAMS</div><h1>Practice with purpose.</h1><p>Build an exam from your study material with multiple-choice, short-answer and graph-reading questions. Marks vary from 1–10 based on the question.</p></div><div className="workspace-chip"><span>●</span> Material grounded</div></div>{error&&<div className="notice">{error}</div>}<section className="exam-builder panel"><div className="builder-copy"><div className="section-kicker">BUILD YOUR EXAM</div><h2>Set the session.</h2><p>Choose the subject, chapter, difficulty, length and time limit. TIALO will vary the question types and marks automatically.</p></div><div className="builder-controls"><label>Subject<select value={subjectId} onChange={e=>setSubjectId(e.target.value)} disabled={!subjects.length}>{!subjects.length&&<option>No subjects yet</option>}{subjects.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></label><label>Chapters / topics<textarea className="topic-input" value={scope} onChange={e=>setScope(e.target.value)} placeholder="e.g. DNA, RNA, cell division" rows={2}/><small>Enter multiple chapters or topics, separated by commas.</small></label><label>Difficulty<select value={difficulty} onChange={e=>setDifficulty(e.target.value)}><option value="mixed">Mixed</option><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select></label><label>Questions<select value={count} onChange={e=>setCount(Number(e.target.value))}><option value={5}>5</option><option value={10}>10</option><option value={15}>15</option><option value={20}>20</option></select></label><label>Time limit<select value={timeLimit} onChange={e=>setTimeLimit(Number(e.target.value))}><option value={0}>No limit</option><option value={300}>5 minutes</option><option value={600}>10 minutes</option><option value={1200}>20 minutes</option><option value={1800}>30 minutes</option><option value={3600}>60 minutes</option></select></label><button className="btn primary" onClick={generate} disabled={!subjectId||working}>{working?'Building…':'Start exam'} <span>↗</span></button></div></section><section className="dashboard-section"><div className="section-heading"><div><div className="section-kicker">HISTORY</div><h2>Recent practice</h2><p>Every completed exam becomes part of your progress history.</p></div></div>{history.length?<div className="exam-history">{history.map(item=>{const pct=item.score==null?null:Math.round(item.score/item.total_marks*100);return <button type="button" className="history-row history-row-button" key={item.id} onClick={()=>openPreviousExam(item.id)} disabled={working}><div className="history-index">□</div><div><strong>{item.title}</strong><span>{item.subjects?.name||'Subject'} · {new Date(item.created_at).toLocaleDateString()}</span></div><div className="history-score">{pct==null?'—':pct+'%'}<small>{item.score==null?'In progress':'Open exam · '+item.score+'/'+item.total_marks}</small></div><div className="history-open">Open ↗</div></button>})}</div>:<div className="empty-state"><div className="empty-icon">□</div><h3>Your exam history starts here.</h3><p>Generate an exam above and your completed result will stay in this workspace.</p></div>}</section></>}
 {exam&&!review&&<section className="exam-session"><div className="exam-topbar"><div><div className="eyebrow">{selected?.name||'MOCK EXAM'}</div><h1>{exam.title}</h1><p>{current+1} of {questions.length} · {questions.filter(q=>answers[q.position]).length} answered</p></div><div className="exam-timer">{exam.time_limit_seconds?<><small>TIME LEFT</small><strong>{Math.floor(secondsLeft/60)}:{String(secondsLeft%60).padStart(2,'0')}</strong></>:<><small>QUESTION</small><strong>{current+1}/{questions.length}</strong></>}</div></div><div className="exam-progress"><div style={{width:((current+1)/questions.length*100)+'%'}}/></div>{error&&<div className="notice">{error}</div>}{questions[current]&&<article className="question-card panel"><div className="question-meta"><span>QUESTION {questions[current].position} OF {questions.length}</span><span>{questions[current].question_type==='short_answer'?'SHORT ANSWER':'MULTIPLE CHOICE'} · {questions[current].marks} {questions[current].marks===1?'mark':'marks'}</span></div>{questions[current].chart_data?.chart_type!=='none'&&<ExamGraph chart={questions[current].chart_data}/>} {questions[current].visual_data?.type==='source_page'&&(()=>{const m=materials.find(x=>x.id===questions[current].visual_data.material_id);return <SourceSketch material={m} page={questions[current].visual_data.page} caption={questions[current].visual_data.caption}/>})()}<h2>{questions[current].prompt}</h2>{questions[current].question_type==='short_answer'?<div className="short-answer-box"><label htmlFor={'short'+questions[current].position}>Your answer</label><textarea id={'short'+questions[current].position} value={answers[questions[current].position]||''} onChange={e=>setAnswers(a=>({...a,[questions[current].position]:e.target.value}))} placeholder="Type your answer here…" rows={7}/><div className="answer-help">This question is marked out of {questions[current].marks}.</div></div>:<div className="options">{questions[current].options.map((o,i)=>{const chosen=answers[questions[current].position]===o;return <label className={'option '+(chosen?'chosen':'')} key={o}><input type="radio" name={'q'+questions[current].position} checked={chosen} onChange={()=>setAnswers(a=>({...a,[questions[current].position]:o}))}/><span className="option-letter">{String.fromCharCode(65+i)}</span><span>{o}</span></label>})}</div>}</article>}<div className="question-nav"><button className="btn secondary" onClick={()=>setCurrent(Math.max(0,current-1))} disabled={current===0}>← Previous</button><div className="question-dots">{questions.map((q,i)=><button key={q.id} className={(i===current?'active ':'')+(answers[q.position]?'done':'')} onClick={()=>setCurrent(i)}>{i+1}</button>)}</div>{current<questions.length-1?<button className="btn primary" onClick={()=>setCurrent(current+1)}>Next →</button>:<button className="btn primary" onClick={submitExam} disabled={working}>{working?'Submitting…':'Submit exam'} ↗</button>}</div><button className="exam-cancel" onClick={reset}>Leave exam</button></section>}
 {exam&&review&&<section className="exam-session"><div className="result-hero panel"><div><div className="eyebrow">EXAM COMPLETE</div><h1>{exam.title}</h1><p>Your result has been saved to your progress history.</p></div><div className="result-score"><strong>{exam.score}/{exam.total_marks}</strong><span>{Math.round(exam.score/exam.total_marks*100)}%</span></div></div>{error&&<div className="notice">{error}</div>}<div className="review-summary panel"><div><strong>Review your mistakes</strong><span>{review.filter(x=>!x.correct).length} questions need attention. Short answers are marked against their model answer and marking guide.</span></div><button className="btn primary" onClick={createRevision} disabled={!review.some(x=>!x.correct)||working}>{working?'Building…':'Create revision exam ↗'}</button></div><div className="review-list">{review.map(item=>{const expanded=!!openReviews[item.position];return <article className={'review-card panel '+(expanded?'expanded':'collapsed')} key={item.id}><div className="question-meta"><span>QUESTION {item.position} · {item.topic||'General'}</span><span className="review-mark-badge">WORTH {item.marks} {item.marks===1?'MARK':'MARKS'}</span><b className={item.correct?'correct':'incorrect'}>{item.correct?'CORRECT':'REVIEW'}</b></div><h2>{item.prompt}</h2><div className="review-actions"><span className="review-status-copy">{item.correct?'This question was answered correctly.':'This question needs review. '+(item.awarded_marks||0)+'/'+item.marks+' marks awarded.'}</span><button type="button" className="review-question-btn" onClick={()=>toggleReview(item.position)}>{expanded?'Hide review':'Review question'} ↗</button></div>{expanded&&<div className="review-details">{item.chart_data?.chart_type!=='none'&&<ExamGraph chart={item.chart_data}/>} {item.visual_data?.type==='source_page'&&(()=>{const m=materials.find(x=>x.id===item.visual_data.material_id);return <SourceSketch material={m} page={item.visual_data.page} caption={item.visual_data.caption}/>})()}<p>Your answer <strong>{item.student_answer||'Not answered'}</strong></p>{item.question_type==='short_answer'?<><p>Marks awarded <strong>{item.awarded_marks}/{item.marks}</strong></p>{item.feedback&&<div className="explanation"><span>FEEDBACK</span>{item.feedback}</div>}<p>Model answer <strong>{item.model_answer||item.correct_answer}</strong></p>{item.grading_rubric&&<div className="explanation"><span>MARKING GUIDE</span>{item.grading_rubric}</div>}</>:!item.correct&&<p>Correct answer <strong>{item.correct_answer}</strong></p>}{item.explanation&&<div className="explanation"><span>WHY</span>{item.explanation}</div>}</div>}</article>})}</div><button className="btn primary" onClick={reset}>Take another exam ↗</button></section>}
 </div></section>
<style jsx>{`.mock-sketch{margin:16px 0 20px;border:1px solid #e1e7e2;border-radius:16px;background:#fbfcfb;padding:12px}.mock-sketch img{display:block;width:100%;max-height:620px;object-fit:contain;border-radius:10px;background:#fff}.mock-sketch figcaption{font-size:11px;color:#68736c;margin-top:9px}.mock-sketch-loading{border:1px solid #e1e7e2;border-radius:16px;padding:18px;color:#68736c;margin:16px 0}.short-answer-box{display:grid;gap:8px}.short-answer-box label{font-size:11px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:#59655d}.short-answer-box textarea{width:100%;box-sizing:border-box;border:1px solid #dce4dc;border-radius:13px;padding:14px;font:inherit;line-height:1.55;resize:vertical;min-height:150px;background:#fff}.answer-help{font-size:11px;color:#778279}.graph-wrap{border:1px solid #e1e7e2;border-radius:16px;background:#fbfcfb;padding:14px 14px 10px;margin:4px 0 18px}.graph-title{font-weight:900;font-size:14px;margin:0 0 4px}.exam-graph{display:block;width:100%;height:auto;overflow:visible}.graph-grid{stroke:#e5eae6;stroke-width:1}.graph-axis-line{stroke:#aeb8b1;stroke-width:1.2}.graph-axis{font-size:10px;fill:#748078}.graph-label{font-size:10px;fill:#536057}.graph-axis-label{font-size:10px;fill:#6b766e;font-weight:700}.graph-value{font-size:10px;fill:#344039;font-weight:800}.graph-bar{fill:#78d986}.graph-line{stroke:#1b6f3b;stroke-width:3;stroke-linejoin:round;stroke-linecap:round}.graph-point{fill:#1b6f3b}.graph-source{font-size:10px;color:#7a847d;margin-top:3px}.builder-controls{display:grid;grid-template-columns:1.2fr 1.5fr .9fr .7fr 1fr auto;gap:12px;align-items:end}.builder-controls label{display:grid;gap:7px;font-size:11px;font-weight:800;color:#4f5b53}.builder-controls input,.builder-controls select,.builder-controls textarea{width:100%;box-sizing:border-box;border:1px solid #dce4dc;border-radius:11px;background:#fff;padding:12px 11px;font:inherit;color:#111}.builder-controls textarea{resize:vertical;min-height:44px;line-height:1.35}.builder-controls small{font-size:9px;color:#7a857d;font-weight:600;margin-top:-2px}.exam-topbar{display:flex;justify-content:space-between;align-items:center;gap:20px;margin-bottom:12px}.exam-topbar h1{margin:4px 0;font-size:30px}.exam-topbar p{font-size:12px;color:#6d786f}.exam-timer{min-width:110px;text-align:center;border:1px solid #dce4dc;border-radius:14px;padding:12px 16px;background:#fff}.exam-timer small{display:block;font-size:9px;letter-spacing:.14em;color:#718078;font-weight:900}.exam-timer strong{display:block;font-size:24px;margin-top:2px}.exam-progress{height:7px;background:#e9eee9;border-radius:99px;overflow:hidden;margin:0 0 18px}.exam-progress div{height:100%;background:#69dc79;border-radius:99px}.question-card{max-width:850px;margin:0 auto}.question-card h2{font-size:25px;line-height:1.35;margin:14px 0 22px}.question-nav{max-width:850px;margin:16px auto 0;display:flex;align-items:center;gap:10px}.question-dots{display:flex;gap:5px;flex:1;justify-content:center;flex-wrap:wrap}.question-dots button{width:30px;height:30px;border-radius:50%;border:1px solid #dce4dc;background:#fff;font-size:10px;cursor:pointer}.question-dots button.active{background:#101512;color:#fff;border-color:#101512}.question-dots button.done:not(.active){background:#e0f7e2;border-color:#9be0a2}.exam-cancel{display:block;margin:14px auto;background:transparent;border:0;color:#777;font-size:11px;cursor:pointer}.review-summary{display:flex;justify-content:space-between;align-items:center;gap:20px;margin:0 0 16px}.review-summary strong,.review-summary span{display:block}.review-summary span{font-size:12px;color:#6d786f;margin-top:4px}.review-card.collapsed{padding-bottom:16px}.review-mark-badge{font-size:10px;font-weight:900;letter-spacing:.08em;color:#3f5b48;background:#eef8ef;border:1px solid #d7ecd9;border-radius:999px;padding:5px 8px}.review-actions{display:flex;align-items:center;justify-content:space-between;gap:14px;margin-top:10px}.review-status-copy{font-size:12px;color:#6d786f}.review-question-btn{border:1px solid #d5dfd7;background:#fff;border-radius:10px;padding:9px 12px;font:inherit;font-size:11px;font-weight:900;cursor:pointer}.history-row-button{width:100%;text-align:left;border:0;border-bottom:1px solid #e5ebe6;background:#fff;cursor:pointer;font:inherit;position:relative}.history-row-button:hover{background:#f7faf7}.history-row-button:disabled{opacity:.6;cursor:wait}.history-open{font-size:11px;font-weight:900;color:#244f31;margin-left:12px;white-space:nowrap}.review-question-btn:hover{background:#f2f7f2}.review-details{margin-top:16px;border-top:1px solid #e5ebe6;padding-top:14px}.review-details p{line-height:1.55}@media(max-width:600px){.review-actions{align-items:flex-start;flex-direction:column}.review-question-btn{width:100%}}@media(max-width:1000px){.builder-controls{grid-template-columns:1fr 1fr}.builder-controls button{grid-column:1/-1}}@media(max-width:600px){.builder-controls{grid-template-columns:1fr}.exam-topbar{align-items:flex-start}.exam-topbar h1{font-size:24px}.question-card h2{font-size:20px}.review-summary{align-items:flex-start;flex-direction:column}}`}</style></main>
}