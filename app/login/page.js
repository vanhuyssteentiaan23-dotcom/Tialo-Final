'use client'

import { useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

async function routeAfterLogin(supabase, userId) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name,date_of_birth,role')
    .eq('id', userId)
    .maybeSingle()

  if (!profile?.full_name || !profile?.date_of_birth || !profile?.role) {
    window.location.href = '/onboarding'
    return
  }

  window.location.href = '/dashboard'
}

export default function LoginPage() {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setMessage('')
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return setMessage('Supabase is not connected in Vercel yet.')
    setBusy(true)

    if (mode === 'login') {
      const result = await supabase.auth.signInWithPassword({ email, password })
      setBusy(false)
      if (result.error) return setMessage(result.error.message)
      await routeAfterLogin(supabase, result.data.user.id)
      return
    }

    const result = await supabase.auth.signUp({ email, password })
    setBusy(false)
    if (result.error) return setMessage(result.error.message)

    if (result.data.session) {
      await routeAfterLogin(supabase, result.data.user.id)
    } else {
      setMessage('Account created. Check your email to confirm your account, then sign in.')
    }
  }

  return <main className="shell" style={{minHeight:'100vh',display:'grid',placeItems:'center',padding:24}}>
    <div className="panel" style={{width:'100%',maxWidth:460}}>
      <div className="brand">TIA<span>LO</span></div>
      <h1 style={{fontSize:36,marginBottom:8}}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <p className="muted">Your TIALO account keeps your learning data separate from every other student.</p>
      <form onSubmit={submit} style={{display:'grid',gap:14,marginTop:28}}>
        <input aria-label="Email" type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" style={inputStyle}/>
        <input aria-label="Password" type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (8+ characters)" style={inputStyle}/>
        <button className="btn primary" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
      {message && <p className="muted" style={{marginTop:16}}>{message}</p>}
      <button className="btn secondary" style={{width:'100%',marginTop:14}} onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode === 'login' ? 'Create a new account' : 'I already have an account'}</button>
      <button className="btn secondary" style={{width:'100%',marginTop:10}} onClick={()=>window.location.href='/'}>Back</button>
    </div>
  </main>
}

const inputStyle = {width:'100%',padding:'14px 15px',borderRadius:12,border:'1px solid rgba(255,255,255,.12)',background:'rgba(255,255,255,.06)',color:'#fff',outline:'none'}
