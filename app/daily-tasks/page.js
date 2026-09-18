'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

function todayLocal() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

export default function DailyTasksPage() {
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const date = useMemo(() => todayLocal(), [])

  async function token() {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getSession()
    let value = data?.session?.access_token
    if (!value) value = (await supabase.auth.refreshSession()).data?.session?.access_token
    if (!value) throw new Error('Your login session has expired. Please log in again.')
    return value
  }

  async function load() {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) { window.location.href = '/login'; return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }
    const { data: subjectRows, error: subjectError } = await supabase.from('subjects').select('id,name').eq('user_id', user.id).order('created_at', { ascending: true })
    if (subjectError) setError(subjectError.message)
    else { setSubjects(subjectRows || []); if (subjectRows?.[0]) setSubjectId(subjectRows[0].id) }
    try {
      const response = await fetch(`/api/daily-tasks?date=${date}`, { headers: { Authorization: `Bearer ${await token()}` } })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not load daily tasks.')
      setTasks(result.tasks || [])
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load daily tasks.') }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function generate() {
    if (!subjectId || working) return
    setWorking(true); setError('')
    try {
      const response = await fetch('/api/daily-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ subjectId, date }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not generate your study plan.')
      setTasks(result.tasks || [])
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not generate your study plan.') }
    finally { setWorking(false) }
  }

  async function toggle(task) {
    try {
      const response = await fetch('/api/daily-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await token()}` }, body: JSON.stringify({ action: 'toggle', id: task.id, completed: !task.completed }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not update task.')
      setTasks(current => current.map(item => item.id === task.id ? { ...item, ...result.task } : item))
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not update task.') }
  }

  const completed = tasks.filter(task => task.completed).length
  const minutes = tasks.reduce((sum, task) => sum + Number(task.estimated_minutes || 0), 0)

  if (loading) return <main className="shell dashboard-loading"><div className="loader-card"><div className="brand">TIA<span>LO</span></div><p>Loading your study plan…</p></div></main>

  return <main className="shell dashboard-shell">
    <aside className="sidebar">
      <a className="brand" href="/dashboard">TIA<span>LO</span></a>
      <div className="sidebar-label">Workspace</div>
      <nav className="sidebar-nav">
        <a className="side-link" href="/dashboard"><span>⌂</span> Overview</a>
        <a className="side-link" href="/subjects"><span>▣</span> Subjects</a>
        <a className="side-link" href="/ai-tutor"><span>◈</span> AI Tutor</a>
        <a className="side-link" href="/mock-exams"><span>□</span> Mock Exams</a>
        <a className="side-link active" href="/daily-tasks"><span>✓</span> Daily Tasks</a>
        <a className="side-link" href="/progress"><span>↗</span> Progress</a>
      </nav>
    </aside>
    <section className="dashboard-main">
      <header className="dashboard-topbar"><div><span className="topbar-title">Daily Tasks</span><span className="topbar-dot">●</span><span className="muted">Your study plan</span></div><a className="btn secondary" href="/dashboard">Dashboard</a></header>
      <div className="dashboard-content">
        <div className="dashboard-hero"><div><div className="eyebrow">TIALO DAILY PLAN</div><h1>Make today count.</h1><p>Get a focused study plan built around your own subject material.</p></div><div className="hero-badge"><span>●</span> {completed}/{tasks.length} complete</div></div>
        {error && <div className="notice" style={{ marginTop: 24 }}>{error}</div>}
        <section className="stat-grid"><article className="stat-card"><span>Tasks today</span><strong>{tasks.length}</strong><small>Focused study actions</small></article><article className="stat-card"><span>Completed</span><strong>{completed}</strong><small>Keep going</small></article><article className="stat-card"><span>Study time</span><strong>{minutes}</strong><small>Estimated minutes</small></article><article className="stat-card"><span>Progress</span><strong>{tasks.length ? Math.round(completed / tasks.length * 100) : 0}%</strong><small>Today's completion</small></article></section>
        <section className="dashboard-section">
          <div className="panel" style={{ padding: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'end' }}>
              <div><label style={{ display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Study subject</label><select value={subjectId} onChange={e => setSubjectId(e.target.value)} disabled={!subjects.length} style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: '#0c1a2b', color: '#fff' }}>{!subjects.length && <option>No subjects yet</option>}{subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></div>
              <button className="btn primary" onClick={generate} disabled={!subjectId || working}>{working ? 'Building plan…' : 'Generate Today’s Plan'}</button>
            </div>
            <p className="muted" style={{ fontSize: 12, margin: '14px 0 0' }}>TIALO uses only processed material from the selected subject to choose what you should study.</p>
          </div>
        </section>
        <section className="dashboard-section">
          <div className="section-heading"><div><div className="eyebrow">TODAY</div><h2>Your tasks</h2></div></div>
          {tasks.length === 0 ? <div className="empty-state"><div className="empty-icon">✓</div><h3>No tasks yet</h3><p>Choose a subject and generate today's personalised study plan.</p></div> : <div style={{ display: 'grid', gap: 12 }}>{tasks.map((task, index) => <article className="panel" key={task.id} style={{ padding: 20, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'center', opacity: task.completed ? .62 : 1 }}><button onClick={() => toggle(task)} aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'} style={{ width: 30, height: 30, borderRadius: 9, border: `1px solid ${task.completed ? 'rgba(69,230,161,.7)' : 'rgba(255,255,255,.16)'}`, background: task.completed ? 'rgba(69,230,161,.12)' : 'transparent', color: '#45e6a1', cursor: 'pointer', fontWeight: 900 }}>{task.completed ? '✓' : index + 1}</button><div><h3 style={{ margin: '0 0 5px', textDecoration: task.completed ? 'line-through' : 'none' }}>{task.title}</h3><p className="muted" style={{ margin: 0, fontSize: 12, lineHeight: 1.55 }}>{task.description}</p><div style={{ marginTop: 9, display: 'flex', gap: 8, flexWrap: 'wrap' }}><span className="tool-status">{task.estimated_minutes} min</span><span className="tool-status">{task.priority} priority</span></div></div><span className="muted" style={{ fontSize: 11 }}>{task.subjects?.name || ''}</span></article>)}</div>}
        </section>
      </div>
    </section>
  </main>
}
