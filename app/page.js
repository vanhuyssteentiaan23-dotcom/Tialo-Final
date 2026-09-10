'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabase'

const features = [
  ['AI Tutor', 'Ask questions and get guided explanations connected to your academic context.'],
  ['Material-based exams', 'Generate practice and mock exams from the student’s own subject material.'],
  ['Progress intelligence', 'Track results, weak areas, study sessions and improvement over time.'],
]

export default function Home() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) {
      setConfigured(false)
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  return (
    <main className="shell">
      <nav className="nav">
        <div className="brand">TIA<span>LO</span></div>
        <div className="navlinks"><span>AI Tutor</span><span>Study</span><span>Progress</span><span>Parent Portal</span></div>
      </nav>

      <section className="hero">
        <div>
          <div className="eyebrow">AI Academic Coach</div>
          <h1>Study smarter.<br/>Know more.</h1>
          <p>TIALO is being built as a structured academic platform where every student has their own secure account, subjects, learning material, AI tutor, exams and permanent progress history.</p>
          <div className="actions">
            <button className="btn primary" onClick={() => { window.location.href = '/login' }}>Get started</button>
            <button className="btn secondary" onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}>See what’s included</button>
          </div>
          {!configured && <p className="muted" style={{fontSize:13,marginTop:18}}>Supabase environment variables still need to be added in Vercel.</p>}
          {!loading && session && <p style={{fontSize:13,marginTop:18,color:'#45e6a1'}}>Signed in as {session.user.email}</p>}
        </div>

        <div className="panel">
          <div className="stat"><span className="muted">Basic</span><span className="value">R100 / month</span></div>
          <div className="stat"><span className="muted">Full</span><span className="value">R250 / month</span></div>
          <div className="stat"><span className="muted">Account</span><span className="value">Private & secure</span></div>
          <div className="stat"><span className="muted">Learning</span><span className="value">Material-grounded AI</span></div>
        </div>
      </section>

      <section className="section" id="features">
        <div className="grid">
          {features.map(([title, text]) => <article className="card" key={title}><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <footer className="footer">TIALO AI Academic Coach · Built for structured learning</footer>
    </main>
  )
}
