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
  const [profile, setProfile] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) {
        setChecking(false)
        return
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      const { data: currentProfile } = await supabase
        .from('profiles')
        .select('full_name,date_of_birth,role')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (!currentProfile?.full_name || !currentProfile?.date_of_birth || !currentProfile?.role) {
        window.location.href = '/onboarding'
        return
      }

      setUser(currentUser)
      setProfile(currentProfile)
      setChecking(false)
    }

    load()
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
      <h1 style={{fontSize:48,margin:'18px 0 8px'}}>Welcome, {profile?.full_name?.split(' ')[0]}.</h1>
      <p className="muted" style={{maxWidth:700,lineHeight:1.7}}>Your academic command centre. Subjects, materials, AI tutoring, mock exams, daily tasks and progress will all live here.</p>
      <div className="grid" style={{marginTop:36}}>{cards.map(([title,text]) => <article className="card" key={title}><h3>{title}</h3><p>{text}</p><button className="btn secondary" style={{marginTop:8}}>Coming next</button></article>)}</div>
    </section>
  </main>
}
