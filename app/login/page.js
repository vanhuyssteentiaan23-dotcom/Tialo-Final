'use client'
import {useState} from 'react'
import {getSupabaseBrowserClient} from '../../lib/supabase'

async function routeAfterLogin(supabase,userId){
 const {data:profile}=await supabase.from('profiles').select('full_name,date_of_birth,role').eq('id',userId).maybeSingle()
 if(!profile?.full_name||!profile?.date_of_birth||!profile?.role){window.location.href='/onboarding';return}
 if(profile.role==='parent'){window.location.href='/parent';return}
 if(profile.role==='student'){
  const age=(()=>{const d=new Date(profile.date_of_birth+'T00:00:00'),n=new Date();let a=n.getFullYear()-d.getFullYear();if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))a--;return a})()
  if(age<16){const {data:l}=await supabase.from('parent_child').select('id').eq('child_id',userId).eq('status','active').limit(1).maybeSingle();if(!l){window.location.href='/parent-link';return}}
 }
 const {data:{session}}=await supabase.auth.getSession()
 const response=await fetch('/api/subscription/status',{headers:{Authorization:'Bearer '+(session?.access_token||'')}})
 const billing=await response.json().catch(()=>({}))
 window.location.href=response.ok&&billing.active?'/dashboard':'/billing'
}

export default function LoginPage(){
 const [email,setEmail]=useState(''),[sent,setSent]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function submit(e){
  e.preventDefault();const value=email.trim();if(!value)return
  const supabase=getSupabaseBrowserClient();if(!supabase){setMessage('TIALO is not connected to Supabase in this environment.');return}
  setBusy(true);setMessage('')
  try{
   const {error}=await supabase.auth.signInWithOtp({email:value,options:{emailRedirectTo:window.location.origin+'/onboarding',shouldCreateUser:true}})
   if(error)throw error
   setSent(true);setMessage('Magic link sent. Check your email and tap the link to enter TIALO.')
  }catch(error){setMessage(error?.message||'We could not send the sign-in link. Please try again.')}finally{setBusy(false)}
 }
 return <main className="shell auth-shell"><div className="auth-frame"><a className="brand auth-brand" href="/">TIA<span>LO</span></a><div className="auth-layout"><div className="auth-copy"><div className="eyebrow">TIALO · FULL ACCESS</div><h1>Open your study space.</h1><p>No password to remember. Enter your email and we’ll send you a secure one-time link.</p><div className="auth-points"><span>● One secure link</span><span>● Your work stays saved</span><span>● R250 / 30 days</span></div></div><section className="auth-card panel"><div className="section-kicker">{sent?'CHECK YOUR INBOX':'WELCOME TO TIALO'}</div><h2>{sent?'Your link is on its way.':'Enter your email.'}</h2><p>{sent?'Open the latest TIALO email on this device. You’ll be taken straight back into your workspace.':'Sign in or create your account with a magic link. No password required.'}</p><form onSubmit={submit}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><button className="btn primary" disabled={busy}>{busy?'Sending…':sent?'Send another link':'Email me a sign-in link'} <span>↗</span></button></form>{message&&<div className="notice">{message}</div>}<a className="text-link" href="/">← Back to TIALO</a></section></div><p className="auth-foot">Secure authentication powered by your account email. No card details are stored by TIALO.</p></div></main>
}