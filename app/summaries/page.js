'use client'
import {useEffect,useMemo,useState} from 'react'
import {getSupabaseBrowserClient} from '../../lib/supabase'

const nav=[['Overview','/dashboard'],['Subjects','/subjects'],['Summaries','/summaries'],['AI Tutor','/ai-tutor'],['Mock Exams','/mock-exams'],['Daily Tasks','/daily-tasks'],['Progress','/progress']]

export default function Summaries(){
 const [subjects,setSubjects]=useState([]),[materials,setMaterials]=useState([]),[saved,setSaved]=useState([])
 const [subjectId,setSubjectId]=useState(''),[selected,setSelected]=useState([]),[request,setRequest]=useState(''),[instruction,setInstruction]=useState('')
 const [summary,setSummary]=useState(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('')
 const subjectMaterials=useMemo(()=>materials.filter(m=>m.subject_id===subjectId),[materials,subjectId])

 async function load(){
  const s=getSupabaseBrowserClient(); if(!s){location.href='/login';return}
  const {data:{user}}=await s.auth.getUser(); if(!user){location.href='/login';return}
  const [a,b,c]=await Promise.all([
   s.from('subjects').select('id,name').eq('user_id',user.id).order('created_at'),
   s.from('materials').select('id,subject_id,title,file_name,mime_type,processing_status').eq('user_id',user.id).order('uploaded_at',{ascending:false}),
   s.from('summaries').select('id,title,subject_id,chapter_request,summary_json,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)
  ])
  setSubjects(a.data||[]);setMaterials(b.data||[]);setSaved(c.data||[]);if(a.data?.[0])setSubjectId(a.data[0].id);setLoading(false)
 }
 useEffect(()=>{load()},[])
 function toggle(id){setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}
 async function createSummary(){
  if(!subjectId||!selected.length||!request.trim())return
  setBusy(true);setError('');setNotice('')
  try{
   const s=getSupabaseBrowserClient();const {data:{session}}=await s.auth.getSession()
   if(!session)throw new Error('Please log in again.')
   const res=await fetch('/api/summaries',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({subjectId,materialIds:selected,chapterRequest:request,instruction})})
   const data=await res.json();if(!res.ok)throw new Error(data.error||'Could not create the summary.')
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
    <div className="summary-hero"><div className="new-kicker">TIALO SUMMARIES</div><h1>Turn your notes into a study summary.</h1><p>Choose your subject, documents and chapters. TIALO creates a clear summary and keeps the source material connected to the topics it explains.</p></div>
    {error&&<div className="notice">{error}</div>}{notice&&<div className="notice">{notice}</div>}
    <section className="summary-builder panel print-hide">
     <div className="summary-field"><label>1 · Subject</label><select value={subjectId} onChange={e=>{setSubjectId(e.target.value);setSelected([])}}>{subjects.map(s=><option value={s.id} key={s.id}>{s.name}</option>)}</select></div>
     <div className="summary-field"><label>2 · Documents</label><div className="summary-materials">{subjectMaterials.length?subjectMaterials.map(m=><label className={'summary-material '+(selected.includes(m.id)?'selected':'')} key={m.id}><input type="checkbox" checked={selected.includes(m.id)} onChange={()=>toggle(m.id)}/><span><b>{m.title||m.file_name||'Untitled document'}</b><small>{m.mime_type||'Document'}</small></span></label>):<p>No documents uploaded to this subject yet.</p>}</div></div>
     <div className="summary-field"><label>3 · Chapters / sections</label><textarea value={request} onChange={e=>setRequest(e.target.value)} placeholder="Example: Chapters 3, 4 and 5. Focus on the important concepts and definitions." rows={4}/><textarea value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="Optional: Make it easy to study for my test…" rows={3}/></div>
     <button className="new-primary" disabled={busy||!selected.length||!request.trim()} onClick={createSummary}>{busy?'Creating summary…':'Create summary →'}</button>
    </section>
    {summary&&<article className="summary-document">
      <div className="summary-doc-head"><div className="new-kicker">STUDY SUMMARY</div><h2>{summary.title}</h2><p>{summary.subjectName}</p></div>
      {summary.overview&&<section><h3>Overview</h3><p>{summary.overview}</p></section>}
      {(summary.sections||[]).map((s,i)=><section key={i}><h3>{i+1}. {s.heading}</h3><p>{s.summary}</p>{s.keyPoints?.length&&<ul>{s.keyPoints.map((p,j)=><li key={j}>{p}</li>)}</ul>}</section>)}
      {summary.importantTerms?.length&&<section><h3>Important terms</h3>{summary.importantTerms.map((t,i)=><p key={i}><b>{t.term}:</b> {t.meaning}</p>)}</section>}
      <footer>Generated by TIALO · Source-linked study summary</footer>
    </article>}
    {summary&&<div className="summary-actions print-hide"><button className="new-primary" onClick={print}>Print / Save as PDF</button></div>}
    <section className="saved-summaries print-hide"><div className="new-kicker">MY SUMMARIES</div><h2>Saved study summaries</h2>{saved.length?saved.map(x=><button className="saved-summary" key={x.id} onClick={()=>openSaved(x)}><b>{x.title}</b><small>{new Date(x.created_at).toLocaleDateString()} · {x.chapter_request}</small></button>):<p>No summaries saved yet.</p>}</section>
   </div>
  </section>
 </main>
}
