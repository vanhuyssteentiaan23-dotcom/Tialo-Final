'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

export default function BillingPage() {
  const [user, setUser] = useState(null)
  const [billing, setBilling] = useState(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  async function load() {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) { window.location.href = '/login'; return }
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) { window.location.href = '/login'; return }
    setUser(currentUser)

    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/subscription/status', {
      headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok) setError(data.error || 'Could not load your subscription.')
    else setBilling(data)
    setLoading(false)
  }

  useEffect(() => {
    const payment = new URLSearchParams(window.location.search).get('payment')
    if (payment === 'cancelled') setNotice('Payment was cancelled. Your account and data are unchanged.')
    if (payment === 'failed') setError('The payment did not complete. Your account and data are unchanged.')
    load()
  }, [])

  async function pay() {
    setError(''); setNotice(''); setPaying(true)
    const supabase = getSupabaseBrowserClient()
    const { data: { session } } = await supabase.auth.getSession()
    const response = await fetch('/api/yoco/create-checkout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session?.access_token || ''}` },
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || !data.redirectUrl) {
      setError(data.error || 'Could not start the Yoco payment.')
      setPaying(false)
      return
    }
    window.location.href = data.redirectUrl
  }

  if (loading) return <main className="shell dashboard-loading"><div className="loader-card"><div className="brand">TIA<span>LO</span></div><p>Loading billing…</p></div></main>

  const active = billing?.active
  const accessDate = billing?.accessUntil ? new Date(billing.accessUntil).toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' }) : null

  return (
    <main className="shell dashboard-shell">
      <aside className="sidebar">
        <div className="brand">TIA<span>LO</span></div>
        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav">
          <a className="side-link" href="/dashboard"><span>⌂</span> Overview</a>
          <a className="side-link" href="/subjects"><span>▣</span> Subjects</a>
          <a className="side-link" href="/ai-tutor"><span>◈</span> AI Tutor</a>
          <a className="side-link" href="/mock-exams"><span>□</span> Mock Exams</a>
          <a className="side-link" href="/daily-tasks"><span>✓</span> Daily Tasks</a>
          <a className="side-link" href="/progress"><span>↗</span> Progress</a>
          <a className="side-link active" href="/billing"><span>R</span> Subscription</a>
        </nav>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar"><div><span className="topbar-title">Subscription</span><span className="topbar-dot">●</span><span className="muted">Secure billing</span></div><span className="top-email">{user?.email}</span></header>
        <div className="dashboard-content">
          <div className="dashboard-hero"><div><div className="eyebrow">TIALO FULL</div><h1>Keep your academic workspace active.</h1><p>R250 gives you 30 days of full TIALO access. Renew manually each month.</p></div><div className="hero-badge"><span>●</span> {active ? 'Active' : 'Renewal required'}</div></div>

          {notice && <div className="notice">{notice}</div>}
          {error && <div className="notice">{error}</div>}

          <section className="dashboard-section">
            <div className="panel" style={{ maxWidth: 720 }}>
              <div className="section-kicker">ONE PLAN ONLY</div>
              <h2 style={{ fontSize: 34, margin: '10px 0 4px' }}>TIALO Full</h2>
              <div style={{ fontSize: 46, fontWeight: 900, letterSpacing: '-.04em' }}>R250 <span style={{ fontSize: 15, color: '#7f8da0', fontWeight: 600 }}>/ 30 days</span></div>
              <p style={{ color: '#93a0b2', lineHeight: 1.7 }}>Full access to your AI Tutor, study materials, mock exams, Daily Tasks, progress tracking and academic workspace.</p>
              <div style={{ display: 'grid', gap: 10, margin: '24px 0' }}>
                {['Your uploaded files stay in your account', 'Your exams, scores and progress stay saved', 'No student data is deleted when access expires', 'Renew manually whenever you are ready'].map(item => <div key={item} style={{ color: '#c7d0dc', fontSize: 13 }}>✓ {item}</div>)}
              </div>
              {active && <div className="notice" style={{ borderColor: 'rgba(69,230,161,.2)', background: 'rgba(69,230,161,.05)' }}>Active until <strong>{accessDate}</strong>.</div>}
              {!active && <div className="notice">Your academic data remains safe even when your paid access expires.</div>}
              <button className="btn primary" onClick={pay} disabled={paying}>{paying ? 'Opening secure payment…' : active ? 'Renew for R250' : 'Pay R250 with Yoco'}</button>
              <p style={{ color: '#68768a', fontSize: 11, marginTop: 14 }}>Payments are processed securely on Yoco's hosted checkout. TIALO never stores your card details.</p>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
