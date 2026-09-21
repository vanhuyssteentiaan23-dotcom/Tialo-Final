'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

const nav=[['Overview','⌂','/dashboard'],['Subjects','▱','/subjects'],['Summaries','▤','/summaries'],['AI Tutor','✦','/ai-tutor'],['Mock Exams','□','/mock-exams'],['Daily Tasks','✓','/daily-tasks'],['Progress','↗','/progress']]

function cleanText(value){return String(value||'').replace(/\s+/g,' ').trim()}

export default function SummariesPage(){
 const [subjects,setSubjects]=useState([])
 const [materials,setMaterials]=useState([])
 const [saved,setSaved]=useState([])
 const [subjectId,setSubjectId]=useState('')
 const [selected,setSelected]=useState([])
 const [chapterRequest,setChapterRequest]=useState('')
 const [instruction,setInstruction]=useState('')
 const [summary,setSummary]=useState(null)
 const [loading,setLoading]=useState(true)
 const [generating,setGenerating]=useState(false)
 const [error,setError]=useState('')
 const [notice,setNotice]=useState('')
 const [pageImages,setPageImages]=useState({})
 const [renderingPages,setRenderingPages]=useState(false)
 const documentRef=useRef(null)

 async function load(){
  const s=getSupabaseBrowserClient(); if(!s)return
  const {data:{user}}=await s.auth.getUser()
  if(!user){location.href='/login';return}
  const [a,b,c]=await Promise.all([
   s.from('subjects').select('id,name').eq('user_id',user.id).order('created_at',{ascending:true}),
   s.from('materials').select('id,subject_id,title,file_name,mime_type,file_size,storage_path,processing_status,extracted_at,page_text').eq('user_id',user.id).order('uploaded_at',{ascending:false}),
   s.from('summaries').select('id,title,subject_id,chapter_request,summary_json,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(20)
  ])
  if(a.error||b.error||c.error)setError(a.error?.message||b.error?.message||c.error?.message||'Could not load summaries.')
  setSubjects(a.data||[]);setMaterials(b.data||[]);setSaved(c.data||[])
  if(a.data?.[0])setSubjectId(a.data[0].id)
  setLoading(false)
 }
 useEffect(()=>{load()},[])

 const subjectMaterials=useMemo(()=>materials.filter(m=>m.subject_id===subjectId),[materials,subjectId])

 useEffect(()=>{setSelected([]);setSummary(null);setError('')},[subjectId])

 function toggleMaterial(id){setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}

 async function getToken(){
  const s=getSupabaseBrowserClient();const {data,error}=await s.auth.refreshSession()
  if(error||!data?.session?.access_token)throw new Error('Your login session has expired. Please log in again.')
  return data.session.access_token
 }

 async function generate(){
  if(!subjectId||!selected.length||!chapterRequest.trim())return
  setGenerating(true);setError('');setNotice('');setPageImages({})
  try{
   const token=await getToken()
   const response=await fetch('/api/summaries',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({subjectId,materialIds:selected,chapterRequest,instruction})})
   const result=await response.json()
   if(!response.ok)throw new Error(result.error||'Could not create the summary.')
   setSummary(result.summary);setNotice('Summary created and saved to My Summaries.');await load()
  }catch(e){setError(e instanceof Error?e.message:'Could not create the summary.')}finally{setGenerating(false)}
 }

 async function renderSourcePages(currentSummary){
  if(!currentSummary?.sections?.length)return
  const refs=[]
  for(const section of currentSummary.sections||[])for(const ref of section.sourcePages||[])refs.push(ref)
  const unique=[...new Map(refs.map(ref=>[`${ref.materialId}:${ref.page}`,ref])).values()]
  if(!unique.length)return
  setRenderingPages(true)
  try{
   const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs')
   pdfjs.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/6.3.289/pdf.worker.min.mjs'
   const next={}
   for(const ref of unique){
    if(next[`${ref.materialId}:${ref.page}`]||pageImages[`${ref.materialId}:${ref.page}`])continue
    const material=materials.find(m=>m.id===ref.materialId)
    if(!material?.storage_path||material.mime_type!=='application/pdf')continue
    const s=getSupabaseBrowserClient()
    const {data,error:signedError}=await s.storage.from('study-materials').createSignedUrl(material.storage_path,300)
    if(signedError||!data?.signedUrl)continue
    const pdf=await pdfjs.getDocument({url:data.signedUrl}).promise
    if(ref.page>pdf.numPages)continue
    const page=await pdf.getPage(ref.page)
    const viewport=page.getViewport({scale:1.25})
    const canvas=document.createElement('canvas');const ctx=canvas.getContext('2d')
    canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height)
    await page.render({canvasContext:ctx,viewport}).promise
    next[`${ref.materialId}:${ref.page}`]=canvas.toDataURL('image/jpeg',0.88)
   }
   setPageImages(v=>({...v,...next}))
  }catch(e){setError('The summary was created, but one or more source pages could not be rendered. You can still print the text summary.')}finally{setRenderingPages(false)}
 }

 useEffect(()=>{if(summary)renderSourcePages(summary)},[summary?.id])

 function openSaved(item){
  const subject=subjects.find(s=>s.id===item.subject_id);if(subject)setSubjectId(subject.id)
  setSummary({...item.summary_json,id:item.id,title:item.title,createdAt:item.created_at,subjectName:subject?.name||'Subject'})
  setChapterRequest(item.chapter_request||'')
  setSelected(item.summary_json?.materialIds||[])
  setPageImages({})
 }

 async function downloadPdf(){
  if(!documentRef.current||!summary)return
  setNotice('Preparing your PDF…')
  try{
   const mod=await import('jspdf-html2canvas')
   const html2PDF=mod.default||mod
   await html2PDF(documentRef.current,{jsPDF:{format:'a4',orientation:'portrait',unit:'pt'},imageType:'image/jpeg',imageQuality:.96,output:`${summary.title||'TIALO-summary'}.pdf`,html2canvas:{scale:1.5,useCORS:true,scrollX:0,scrollY:-window.scrollY}})
   setNotice('PDF saved. You can print it from the same study document.')
  }catch(e){setError('PDF download failed in this browser. Use Print / Save PDF instead.')}
 }

 function printSummary(){window.print()}

 if(loading)return <main className="new-loading"><div className="new-logo">TIA<span>LO</span></div><span>Opening Summaries…</span></main>

 return <main className="dashboard-shell tialo-workspace summaries-page">
  <aside className="sidebar print-hide"><a className="brand" href="/dashboard">TIA<span>LO</span></a><div className="sidebar-label">Workspace</div><nav className="sidebar-nav">{nav.map(([n,i,h])=><a className={'side-link '+(h==='/summaries'?'active':'')} href={h} key={h}><span>{i}</span>{n}</a>)}</nav><div className="sidebar-bottom"><a className="side-settings" href="/settings">⚙ Settings</a></div></aside>
  <section className="dashboard-main">
   <header className="dashboard-header print-hide"><div><div className="eyebrow">TIALO · SUMMARIES</div><h1>Turn your material into a study summary.</h1><p>Choose the subject, documents and chapters. TIALO keeps relevant original source pages with the concepts they explain.</p></div></header>
   <div className="dashboard-content">
    {error&&<div className="notice">{error}</div>}{notice&&<div className="notice" style={{borderColor:'rgba(69,230,161,.25)',background:'rgba(69,230,161,.05)'}}>{notice}</div>}
    <section className="summary-builder panel print-hide">
     <div className="summary-step"><span>01</span><div><strong>Choose a subject</strong><select value={subjectId} onChange={e=>setSubjectId(e.target.value)}>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div>
     <div className="summary-step"><span>02</span><div><strong>Choose your documents</strong><p>Select the notes or PDFs TIALO should use.</p><div className="summary-materials">{subjectMaterials.length?subjectMaterials.map(m=><label className={'summary-material '+(selected.includes(m.id)?'selected':'')} key={m.id}><input type="checkbox" checked={selected.includes(m.id)} onChange={()=>toggleMaterial(m.id)}/><div><b>{m.title||m.file_name||'Untitled material'}</b><small>{m.mime_type==='application/pdf'?'PDF':'File'} · {m.extracted_at?'ready':'needs processing'}</small></div></label>):<div className="material-empty">No material in this subject yet. Upload it under Subjects → Manage material.</div>}</div></div></div>
     <div className="summary-step"><span>03</span><div><strong>What should TIALO summarise?</strong><textarea value={chapterRequest} onChange={e=>setChapterRequest(e.target.value)} placeholder="Example: Chapters 3, 4 and 5 — focus on the important concepts and definitions." rows={4}/><textarea value={instruction} onChange={e=>setInstruction(e.target.value)} placeholder="Optional: Make it easy to study for my test…" rows={3}/><button className="btn primary" onClick={generate} disabled={generating||!selected.length||!chapterRequest.trim()}>{generating?'Creating summary…':'Create summary →'}</button></div></div>
    </section>

    {summary&&<article className="summary-document" ref={documentRef}>
      <div className="summary-cover"><div className="summary-brand">TIA<span>LO</span></div><div className="eyebrow">STUDY SUMMARY</div><h2>{summary.title}</h2><p>{summary.subjectName} · {chapterRequest||'Selected material'}</p><div className="summary-rule"/></div>
      {summary.overview&&<section className="summary-section"><h3>Overview</h3><p>{summary.overview}</p></section>}
      {(summary.sections||[]).map((section,index)=>{
       const refs=Array.isArray(section.sourcePages)?section.sourcePages:[]
       return <section className="summary-section" key={index}><div className="summary-section-heading"><span>{String(index+1).padStart(2,'0')}</span><h3>{section.heading}</h3></div><p>{section.summary}</p>{section.keyPoints?.length?<ul>{section.keyPoints.map((p,i)=><li key={i}>{p}</li>)}</ul>:null}
        {refs.map((ref,i)=>{const key=`${ref.materialId}:${ref.page}`;const img=pageImages[key];return <figure className="source-visual" key={key+i}><figcaption>Original source page {ref.page} — directly relevant to this section</figcaption>{img?<img src={img} alt={`Relevant source page ${ref.page}`}/>:<div className="source-placeholder">{renderingPages?'Loading relevant source page…':'Relevant source page could not be rendered.'}</div>}</figure>})}
       </section>
      })}
      {summary.importantTerms?.length?<section className="summary-section"><h3>Important terms</h3><div className="term-grid">{summary.importantTerms.map((t,i)=><div className="term" key={i}><strong>{t.term}</strong><span>{t.meaning}</span></div>)}</div></section>:null}
      <footer className="summary-footer">Generated by TIALO · Use your original material as the final source of truth.</footer>
    </article>}

    <section className="saved-summaries print-hide"><div className="block-head"><div><div className="new-kicker">MY SUMMARIES</div><h2>Saved study summaries</h2></div></div>{saved.length?<div className="summary-saved-grid">{saved.map(item=><button className="saved-summary" key={item.id} onClick={()=>openSaved(item)}><span>{subjects.find(s=>s.id===item.subject_id)?.name||'Subject'}</span><strong>{item.title}</strong><small>{new Date(item.created_at).toLocaleDateString()} · {item.chapter_request}</small></button>)}</div>:<div className="new-empty">Your saved summaries will appear here.</div>}</section>

    {summary&&<div className="summary-actions print-hide"><button className="btn primary" onClick={downloadPdf}>Download PDF</button><button className="btn secondary" onClick={printSummary}>Print / Save as PDF</button></div>}
   </div>
  </section>
 </main>
}
