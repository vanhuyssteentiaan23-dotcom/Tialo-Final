'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../lib/supabase'

const pillars = [
  ['Learn with context', 'TIALO works around the subjects and material that matter to you.'],
  ['Practise deliberately', 'Turn your own material into focused questions and mock exams.'],
  ['See your progress', 'Keep your study history, scores and momentum in one calm workspace.'],
]

export default function Home() {
  const [session, setSession] = useState(null)
  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => listener.subscription.unsubscribe()
  }, [])

  return <main className="shell">
    <nav className="nav">
      <a className="brand" href="/">TIA<span>LO</span></a>
      <div className="navlinks"><a href="#method">Method</a><a href="#workspace">Workspace</a><a href="#pricing">Pricing</a></div>
      <a className="btn secondary" href={session ? '/dashboard' : '/login'}>{session ? 'Open workspace' : 'Sign in'}</a>
    </nav>

    <section className="hero">
      <div>
        <div className="eyebrow">AI academic workspace</div>
        <h1>A calmer way to <em>study.</em></h1>
        <p>TIALO brings your subjects, learning material, AI help, practice exams and progress into one focused place — designed to feel more like a premium workspace than another noisy school app.</p>
        <div className="actions"><a className="btn primary" href={session ? '/dashboard' : '/login'}>{session ? 'Continue learning' : 'Create your workspace'} <span>↗</span></a><a className="btn secondary" href="#method">See the approach</a></div>
      </div>
      <div className="panel hero-panel">
        <div className="eyebrow">Inside your workspace</div>
        <div className="stat"><span className="muted">Subjects</span><span className="value">Your curriculum</span></div>
        <div className="stat"><span className="muted">AI Tutor</span><span className="value">Material-aware</span></div>
        <div className="stat"><span className="muted">Mock Exams</span><span className="value">On demand</span></div>
        <div className="stat"><span className="muted">Progress</span><span className="value">Always saved</span></div>
        <p className="muted" style={{fontSize:12,lineHeight:1.6,margin:'18px 0 0'}}>Private account. Structured study. Less clutter.</p>
      </div>
    </section>

    <section className="section" id="method"><div className="section-heading"><div><div className="eyebrow">The TIALO method</div><h2 style={{fontSize:34,letterSpacing:'-.045em',margin:'9px 0'}}>One place. A better rhythm.</h2></div></div><div className="grid">{pillars.map(([title,text],i)=><article className="card" key={title}><div style={{fontSize:11,fontWeight:800,color:'#78b957',letterSpacing:'.12em'}}>0{i+1}</div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
    <section className="section" id="pricing"><div className="panel pricing-panel"><div><div className="eyebrow">SIMPLE PRICING</div><h2 style={{fontSize:32,letterSpacing:"-.04em",margin:"9px 0 6px"}}>One plan. No clutter.</h2><p className="muted" style={{maxWidth:650,lineHeight:1.7,fontSize:13,margin:0}}>R250 gives you 30 days of full TIALO access. Pay when you’re ready, then use your workspace without juggling plans or complicated account screens.</p></div><div className="price-lockup"><strong>R250</strong><span>30 days</span><a className="btn primary" href={session?'/billing':'/login'}>{session?'Manage access':'Get started'} ↗</a></div></div></section>
    <section className="section" id="workspace"><div className="panel" style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:25,flexWrap:'wrap'}}><div><div className="eyebrow">Built for the long game</div><h2 style={{fontSize:32,letterSpacing:'-.04em',margin:'9px 0 6px'}}>Your academic history stays with you.</h2><p className="muted" style={{maxWidth:650,lineHeight:1.7,fontSize:13,margin:0}}>Use the workspace as your study home now, then connect the deeper academic tools as you grow.</p></div><a className="btn primary" href={session ? '/dashboard' : '/login'}>Enter TIALO ↗</a></div></section>
    <footer className="footer">TIALO · AI academic workspace · Private by design</footer>
  </main>
}