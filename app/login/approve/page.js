'use client'
import {useEffect,useState} from 'react'
import {getSupabaseBrowserClient} from '../../../lib/supabase'

export default function ApprovePage(){
 const [state,setState]=useState('checking'),[message,setMessage]=useState('')
 useEffect(()=>{
  let live=true
  ;(async()=>{
   const requestId=new URLSearchParams(location.search).get('request')
   if(!requestId){setState('error');setMessage('This approval link is invalid. Please request a new sign-in link.');return}
   const s=getSupabaseBrowserClient()
   if(!s){setState('error');setMessage('TIALO authentication is unavailable.');return}
   let session=null
   for(let i=0;i<20&&!session;i++){const {data}=await s.auth.getSession();session=data?.session||null;if(!session)await new Promise(r=>setTimeout(r,300))}
   if(!session){setState('error');setMessage('This sign-in link has expired. Please request a new one.');return}
   const r=await fetch('/api/login/approve',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({requestId})})
   const data=await r.json().catch(()=>({}))
   if(!r.ok){setState('error');setMessage(data.error||'We could not approve this computer.');return}
   if(live){setState('approved');setMessage('This computer is approved. Return to the laptop — TIALO will finish the sign-in automatically.')}
  })()
  return()=>{live=false}
 },[])
 return <main className="shell auth-shell"><div className="auth-frame"><a className="brand auth-brand" href="/">TIA<span>LO</span></a><section className="auth-card panel approval-card"><div className="section-kicker">{state==='approved'?'COMPUTER APPROVED':'TIALO SIGN-IN'}</div><h1>{state==='approved'?'You’re all set.':'Approve this computer.'}</h1><p>{state==='approved'?message:'TIALO is securely connecting this phone to the computer that requested the sign-in.'}</p>{state==='checking'&&<div className="notice">Checking your secure sign-in…</div>}{state==='error'&&<div className="notice">{message}</div>}<a className="text-link" href="/">← Back to TIALO</a></section></div></main>
}
