'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

const cards = [
  ['Subjects', 'Your subjects and learning material'],
  ['AI Tutor', 'Ask, understand and practise'],
  ['Mock Exams', 'Build exams from your own material'],
  ['Daily Tasks', 'Your personalised study plan'],
  ['Progress', 'Scores, weak areas and improvement'],
  ['Parent Portal', 'For students who require a linked guardian'],
]

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return setChecking(false)
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) window.location.href = '/login'
      else setUser(data.user)
      setChecking(false)
    })
  }, [])

  async function signOut() {
    const supabase = getSupabaseBrowserClient()
    await supabase?.auth.signOut()
    window.location.href = '/'
  }

  if (checking) return <main className="shell" style={{minHeight:'100vh',display:'grid',placeItems:'center'}}>Loading TIALO…</main>

  return <main className="shell" style={{minHeight:'100vh'}}>
    <nav className="nav">
      <div className="brand">TIA<span>LO</span></div>
      <div style={{display:'flex',alignItems:'center',gap:14}}><span className="muted" style={{fontSize:13}}>{user?.email}</span><button className="btn secondary" onClick={signOut}>Sign out</button></div>
    </nav>
    <section className="section" style={{paddingTop:60}}>
      <div className="eyebrow">Student Dashboard</div>
      <h1 style={{fontSize:48,margin:'18px 0 8px'}}>Your academic command centre.</h1>
      <p className="muted" style={{maxWidth:700,lineHeight:1.7}}>This is the clean foundation. The next build stages will connect every module to Supabase so accounts, subjects, materials, exams, tasks and progress persist securely per student.</p>
      <div className="grid" style={{marginTop:36}}>{cards.map(([title,text]) => <article className="card" key={title}><h3>{title}</h3><p>{text}</p><button className="btn secondary" style={{marginTop:8}}>Coming next</button></article>)}</div>
    </section>
  </main>
}
