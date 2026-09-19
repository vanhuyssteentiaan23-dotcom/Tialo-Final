'use client'
import {useState} from 'react'
import {getSupabaseBrowserClient} from '../../lib/supabase'

async function finish(supabase,userId){
 const {data:profile}=await supabase.from('profiles').select('full_name,date_of_birth,role').eq('id',userId).maybeSingle()
 if(!profile?.full_name||!profile?.date_of_birth||!profile?.role){location.href='/onboarding';return}
 if(profile.role==='parent'){location.href='/parent';return}
 if(profile.role==='student'){
  const d=new Date(profile.date_of_birth+'T00:00:00'),n=new Date()
  let a=n.getFullYear()-d.getFullYear()
  if(n.getMonth()<d.getMonth()||(n.getMonth()===d.getMonth()&&n.getDate()<d.getDate()))a--
  if(a<16){
   const {data:l}=await supabase.from('parent_child').select('id').eq('child_id',userId).eq('status','active').limit(1).maybeSingle()
   if(!l){location.href='/parent-link';return}
  }
 }
 const {data:{session}}=await supabase.auth.getSession()
 const r=await fetch('/api/subscription/status',{headers:{Authorization:'Bearer '+(session?.access_token||'')}})
 const billing=await r.json().catch(()=>({}))
 location.href=r.ok&&billing.active?'/dashboard':'/billing'
}

export default function LoginPage(){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState('')
 const [mode,setMode]=useState('signin'),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function submit(e){
  e.preventDefault()
  const value=email.trim().toLowerCase()
  if(!value||!password)return
  const supabase=getSupabaseBrowserClient()
  if(!supabase){setMessage('TIALO authentication is not connected.');return}
  setBusy(true);setMessage('')
  try{
   if(mode==='signup'){
    if(password!==confirm)throw new Error('The passwords do not match.')
    if(password.length<8)throw new Error('Your password must be at least 8 characters.')
    const created=await fetch('/api/auth/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:value,password})})
    const result=await created.json().catch(()=>({}))
    if(!created.ok)throw new Error(result.error||'Could not create your account.')
   }
   const {data,error}=await supabase.auth.signInWithPassword({email:value,password})
   if(error)throw error
   if(!data.user)throw new Error('We could not start your TIALO session.')
   await finish(supabase,data.user.id)
  }catch(error){
   const raw=String(error?.message||'')
   if(/invalid login credentials/i.test(raw))setMessage('Email or password is incorrect.')
   else setMessage(raw||'We could not sign you in. Please try again.')
  }finally{setBusy(false)}
 }
 return <main className="shell auth-shell"><div className="auth-frame">
  <a className="brand auth-brand" href="/">TIA<span>LO</span></a>
  <div className="auth-layout">
   <div className="auth-copy"><div className="eyebrow">TIALO · FULL ACCESS</div><h1>Open your study space.</h1><p>Sign in securely with your email and password. No sign-in email limits and no approval from TIALO.</p><div className="auth-points"><span>● Sign in whenever you need</span><span>● Your work stays saved</span><span>● R250 / 30 days</span></div></div>
   <section className="auth-card panel"><div className="section-kicker">{mode==='signup'?'CREATE YOUR ACCOUNT':'WELCOME BACK'}</div><h2>{mode==='signup'?'Create your TIALO account.':'Sign in to TIALO.'}</h2><p>{mode==='signup'?'Create your account once, then sign in whenever you want. Your subscription controls access to the workspace.':'Use the email and password you created for TIALO.'}</p>
    <form onSubmit={submit}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength={8} autoComplete={mode==='signup'?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 8 characters"/></label>{mode==='signup'&&<label>Confirm password<input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} placeholder="Repeat your password"/></label>}<button className="btn primary" disabled={busy}>{busy?(mode==='signup'?'Creating account…':'Signing in…'):(mode==='signup'?'Create account':'Sign in')} <span>↗</span></button></form>
    {message&&<div className="notice">{message}</div>}
    <button type="button" className="text-link" style={{background:'none',border:0,padding:0,cursor:'pointer'}} onClick={()=>{setMode(mode==='signup'?'signin':'signup');setMessage('');setPassword('');setConfirm('')}}>{mode==='signup'?'Already have an account? Sign in':'New to TIALO? Create an account'}</button>
    <a className="text-link" href="/">← Back to TIALO</a>
   </section>
  </div>
  <p className="auth-foot">Secure account authentication. TIALO checks your subscription before opening the study workspace.</p>
 </div></main>
}
