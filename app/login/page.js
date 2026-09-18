'use client'

import { useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

async function routeAfterLogin(supabase, userId) {
  const { data: profile } = await supabase.from('profiles').select('full_name,date_of_birth,role').eq('id', userId).maybeSingle()
  window.location.href = profile?.full_name && profile?.date_of_birth && profile?.role ? '/dashboard' : '/onboarding'
}

export default function LoginPage() {
  const [mode,setMode]=useState('login'),[email,setEmail]=useState(''),[password,setPassword]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
  async function submit(e){
    e.preventDefault(); setMessage(''); const supabase=getSupabaseBrowserClient(); if(!supabase)return setMessage('TIALO is not connected to Supabase in this environment.'); setBusy(true)
    try{
      if(mode==='login'){
        const result=await supabase.auth.signInWithPassword({email:email.trim(),password}); if(result.error)throw result.error; await routeAfterLogin(supabase,result.data.user.id); return
      }
      const result=await supabase.auth.signUp({email:email.trim(),password,options:{emailRedirectTo:`${window.location.origin}/onboarding`}}); if(result.error)throw result.error
      if(result.data.session) await routeAfterLogin(supabase,result.data.user.id); else setMessage('Account created. Check your email to confirm your account, then sign in.')
    }catch(error){setMessage(error?.message||'Something went wrong. Please try again.')}finally{setBusy(false)}
  }
  return <main className="shell" style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:22}}>
    <div style={{width:'100%',maxWidth:460}}><a className="brand" href="/" style={{marginBottom:26}}>TIA<span>LO</span></a><div className="panel" style={{padding:32}}>
      <div className="eyebrow">{mode==='login'?'Welcome back':'Start your workspace'}</div><h1 style={{fontSize:40,letterSpacing:'-.055em',margin:'12px 0 8px'}}>{mode==='login'?'Continue learning.':'Make TIALO yours.'}</h1><p className="muted" style={{fontSize:13,lineHeight:1.65,margin:0}}>{mode==='login'?'Sign in to return to your subjects, study history and tools.':'Create a private academic workspace for your subjects, material and progress.'}</p>
      <form onSubmit={submit} style={{display:'grid',gap:11,marginTop:26}}><label style={{fontSize:11,fontWeight:700}}>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" style={{width:'100%',marginTop:6}}/></label><label style={{fontSize:11,fontWeight:700}}>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="8+ characters" style={{width:'100%',marginTop:6}}/></label><button className="btn primary" disabled={busy} style={{marginTop:5}}>{busy?'Please wait…':mode==='login'?'Sign in':'Create account'} <span>↗</span></button></form>
      {message&&<div className="notice" style={{marginTop:15,marginBottom:0}}>{message}</div>}
      <div style={{display:'grid',gap:8,marginTop:13}}><button className="btn secondary" onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Create a new account':'I already have an account'}</button><a className="btn secondary" href="/">Back to TIALO</a></div>
    </div><p className="muted" style={{fontSize:10,textAlign:'center',marginTop:14}}>Your learning data stays associated with your account.</p></div>
  </main>
}