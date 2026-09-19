'use client'
import {useEffect,useState} from 'react'
import {getSupabaseBrowserClient} from '../../lib/supabase'

async function finish(supabase,userId){
 const {data:profile}=await supabase.from('profiles').select('full_name,date_of_birth,role').eq('id',userId).maybeSingle()
 if(!profile?.full_name||!profile?.date_of_birth||!profile?.role){location.href='/onboarding';return}
 if(profile.role==='parent'){location.href='/parent';return}
 if(profile.role==='student'){
  const d=new Date(profile.date_of_birth+'T00:00:00'),n=new Date()
  let a=n.getFullYear()-d.getFullYear()
  if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))a--
  if(a<16){const {data:l}=await supabase.from('parent_child').select('id').eq('child_id',userId).eq('status','active').limit(1).maybeSingle();if(!l){location.href='/parent-link';return}}
 }
 const {data:{session}}=await supabase.auth.getSession()
 const r=await fetch('/api/subscription/status',{headers:{Authorization:'Bearer '+(session?.access_token||'')}})
 const billing=await r.json().catch(()=>({}))
 location.href=r.ok&&billing.active?'/dashboard':'/billing'
}

export default function LoginPage(){
 const [email,setEmail]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[handoff,setHandoff]=useState(false),[cooldown,setCooldown]=useState(0)
 useEffect(()=>{setHandoff(localStorage.getItem('tialo_trusted_device')!=='1');const until=Number(localStorage.getItem('tialo_login_cooldown')||0);const tick=()=>setCooldown(Math.max(0,Math.ceil((until-Date.now())/1000)));tick();const id=setInterval(tick,1000);return()=>clearInterval(id)},[])
 async function submit(e){
  e.preventDefault()
  const value=email.trim().toLowerCase()
  if(!value)return
  if(cooldown>0){setMessage(`Please wait ${cooldown}s before requesting another sign-in email. If you already received one, use the latest TIALO email.`);return}
  const supabase=getSupabaseBrowserClient()
  if(!supabase){setMessage('TIALO authentication is not connected.');return}
  setBusy(true);setMessage('')
  try{
   const trusted=localStorage.getItem('tialo_trusted_device')==='1'
   const requestId=crypto.randomUUID()
   localStorage.setItem('tialo_login_email',value)
   if(trusted){
    const {error}=await supabase.auth.signInWithOtp({email:value,options:{emailRedirectTo:location.origin+'/login/complete?direct=1',shouldCreateUser:true}})
    if(error)throw error
    setSent(true);setHandoff(false);const until=Date.now()+10*60*1000;localStorage.setItem('tialo_login_cooldown',String(until));setCooldown(600);setMessage('Sign-in link sent. Open it on this computer and TIALO will take you straight into your workspace.')
    return
   }
   localStorage.setItem('tialo_login_request',requestId)
   const {error}=await supabase.auth.signInWithOtp({email:value,options:{emailRedirectTo:location.origin+'/login/approve?request='+encodeURIComponent(requestId),shouldCreateUser:true}})
   if(error)throw error
   setSent(true);setHandoff(true);const until=Date.now()+10*60*1000;localStorage.setItem('tialo_login_cooldown',String(until));setCooldown(600)
   setMessage('Open the TIALO email on your phone to approve this computer. This laptop will sign in automatically.')
   const started=Date.now()
   const poll=async()=>{
    if(Date.now()-started>10*60*1000)return
    try{
     const r=await fetch('/api/login/handoff?request='+encodeURIComponent(requestId)+'&email='+encodeURIComponent(value),{cache:'no-store'})
     const data=await r.json().catch(()=>({}))
     if(data.status==='approved'&&data.url){localStorage.setItem('tialo_trusted_device','1');localStorage.removeItem('tialo_login_request');location.href=data.url;return}
     if(data.status==='error'){setMessage(data.message||'The computer sign-in could not be completed. Please send a new link.');return}
    }catch{}
    setTimeout(poll,1500)
   }
   setTimeout(poll,1500)
  }catch(error){const raw=String(error?.message||'');if(/rate limit|too many|rate_limit/i.test(raw)){setMessage('Too many sign-in emails were requested. Use the latest TIALO email you already received, or wait for the email limit to reset before requesting another.')}else{setMessage(raw||'We could not send the sign-in link. Please try again.')}}finally{setBusy(false)}
 }
 return <main className="shell auth-shell"><div className="auth-frame"><a className="brand auth-brand" href="/">TIA<span>LO</span></a><div className="auth-layout"><div className="auth-copy"><div className="eyebrow">TIALO · FULL ACCESS</div><h1>Open your study space.</h1><p>No password to remember. Enter your email and we’ll send you a secure one-time link.</p><div className="auth-points"><span>● One secure link</span><span>● Your work stays saved</span><span>● R250 / 30 days</span></div></div><section className="auth-card panel"><div className="section-kicker">{sent?'CHECK YOUR INBOX':'WELCOME TO TIALO'}</div><h2>{sent?(handoff?'Approve this computer.':'Your link is on its way.'):'Enter your email.'}</h2><p>{sent?(handoff?'Open the latest TIALO email on your phone. After approval, this computer continues automatically.':'Open the latest TIALO email on this computer to sign in.'): 'Sign in or create your account with a secure email link.'}</p><form onSubmit={submit}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button className="btn primary" disabled={busy||cooldown>0}>{busy?'Sending…':cooldown>0?`Wait ${cooldown}s`:sent?'Send another link':'Email me a sign-in link'} <span>↗</span></button></form>{message&&<div className="notice">{message}</div>}<a className="text-link" href="/">← Back to TIALO</a></section></div><p className="auth-foot">Secure authentication powered by your account email. No card details are stored by TIALO.</p></div></main>
}