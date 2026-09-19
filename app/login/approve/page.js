'use client'
import {useEffect,useState} from 'react'
import {getSupabaseBrowserClient} from '../../../lib/supabase'

export default function ApproveLogin(){
 const [status,setStatus]=useState('checking'),[message,setMessage]=useState('')
 useEffect(()=>{
  let active=true
  const run=async()=>{
   const requestId=new URLSearchParams(window.location.search).get('request')
   if(!requestId){setStatus('error');setMessage('This approval link is missing its request. Please send a new sign-in link.');return}
   const supabase=getSupabaseBrowserClient()
   if(!supabase){setStatus('error');setMessage('TIALO could not connect to authentication.');return}
   let session=null
   for(let i=0;i<12&&!session;i++){
    const {data}=await supabase.auth.getSession();session=data?.session||null
    if(!session) await new Promise(r=>setTimeout(r,500))
   }
   if(!session){setStatus('error');setMessage('The sign-in link could not be completed on this device. Open the latest link again.');return}
   const response=await fetch('/api/login/approve',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({requestId})})
   const data=await response.json().catch(()=>({}))
   if(!response.ok){setStatus('error');setMessage(data.error||'We could not approve the computer.');return}
   if(active){setStatus('approved');setMessage('This computer is approved. You can return to it now — TIALO will finish signing you in automatically.')}
  }
  run()
  return()=>{active=false}
 },[])
 return <main className="shell auth-shell"><div className="auth-frame"><a className="brand auth-brand" href="/">TIA<span>LO</span></a><section className="auth-card panel approval-card"><div className="section-kicker">{status==='approved'?'COMPUTER APPROVED':'TIALO SIGN-IN'}</div><h1>{status==='approved'?'You’re all set.':'Approve this computer.'}</h1><p>{status==='approved'?message:'TIALO is checking this secure sign-in link and will approve the computer that requested it.'}</p>{status==='checking'&&<div className="notice">Please keep this page open for a moment.</div>}{status==='error'&&<div className="notice">{message}</div>}<a className="text-link" href="/">← Back to TIALO</a></section></div></main>
}
