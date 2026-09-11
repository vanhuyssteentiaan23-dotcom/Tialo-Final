'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

export default function ParentPage() {
  const [profile, setProfile] = useState(null)
  const [children, setChildren] = useState([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return (window.location.href = '/login')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return (window.location.href = '/login')
    const { data: parentProfile } = await supabase.from('profiles').select('full_name,date_of_birth,role').eq('id', user.id).maybeSingle()
    if (!parentProfile || parentProfile.role !== 'parent') return (window.location.href = '/dashboard')
    setProfile(parentProfile)
    await loadChildren(supabase, user.id)
    setLoading(false)
  }

  async function loadChildren(supabase, parentId) {
    const { data: links, error: linkError } = await supabase.from('parent_child').select('id,child_id,status,created_at,accepted_at').eq('parent_id', parentId).order('created_at', { ascending: false })
    if (linkError) { setError(linkError.message); return }
    const active = (links || []).filter(link => link.status === 'active')
    const childIds = active.map(link => link.child_id)
    if (!childIds.length) { setChildren([]); return }
    const { data: profiles, error: profileError } = await supabase.from('profiles').select('id,full_name,email,date_of_birth').in('id', childIds)
    if (profileError) { setError(profileError.message); return }
    const rows = []
    for (const child of profiles || []) {
      const { data: exams } = await supabase.from('exam_attempts').select('id,subject_id,score,total_marks,question_count,created_at,completed_at,subjects(name)').eq('user_id', child.id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(50)
      const { data: tasks } = await supabase.from('daily_study_tasks').select('id,estimated_minutes,completed,completed_at,task_date,subjects(name)').eq('user_id', child.id).eq('completed', true).order('completed_at', { ascending: false }).limit(100)
      const examScores = (exams || []).map(exam => exam.total_marks ? (Number(exam.score || 0) / Number(exam.total_marks)) * 100 : 0)
      const average = examScores.length ? Math.round(examScores.reduce((a, b) => a + b, 0) / examScores.length) : 0
      rows.push({ ...child, exams: exams || [], tasks: tasks || [], average, studyMinutes: (tasks || []).reduce((sum, task) => sum + Number(task.estimated_minutes || 0), 0) })
    }
    setChildren(rows)
  }

  useEffect(() => { load() }, [])

  async function requestLink(event) {
    event.preventDefault()
    if (!email.trim() || working) return
    setWorking(true); setError(''); setMessage('')
    const supabase = getSupabaseBrowserClient()
    const { error: rpcError } = await supabase.rpc('request_parent_link', { child_email: email.trim() })
    if (rpcError) setError(rpcError.message)
    else { setMessage('Link request sent. The student must sign in and accept the parent link.'); setEmail('') }
    setWorking(false)
  }

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'Parent'

  if (loading) return <main className="shell dashboard-loading"><div className="loader-card"><div className="brand">TIA<span>LO</span></div><p>Loading your parent workspace…</p></div></main>

  return <main className="shell dashboard-shell">
    <aside className="sidebar">
      <a className="brand" href="/parent">TIA<span>LO</span></a>
      <div className="sidebar-label">Parent workspace</div>
      <nav className="sidebar-nav">
        <a className="side-link active" href="/parent"><span>⌂</span> Overview</a>
        <a className="side-link" href="/dashboard"><span>↗</span> Student view</a>
      </nav>
    </aside>
    <section className="dashboard-main">
      <header className="dashboard-topbar"><div><span className="topbar-title">Parent Portal</span><span className="topbar-dot">●</span><span className="muted">Academic progress</span></div><span className="top-email">{profile?.full_name}</span></header>
      <div className="dashboard-content">
        <div className="dashboard-hero"><div><div className="eyebrow">TIALO PARENT PORTAL</div><h1>Welcome, {firstName}.</h1><p>Follow your child’s academic progress, study activity and mock-exam performance in one private view.</p></div><div className="hero-badge"><span>●</span> {children.length} linked {children.length === 1 ? 'student' : 'students'}</div></div>

        <section className="dashboard-section">
          <div className="panel" style={{ padding: 24 }}>
            <div className="section-heading" style={{ marginBottom: 18 }}><div><div className="eyebrow">LINK A STUDENT</div><h2>Add your child</h2><p>Enter the email address used for the student’s TIALO account.</p></div></div>
            <form onSubmit={requestLink} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="student@email.com" required />
              <button className="btn primary" disabled={working}>{working ? 'Sending…' : 'Send link request'}</button>
            </form>
            {message && <div className="notice" style={{ marginTop: 14 }}>{message}</div>}
            {error && <div className="notice" style={{ marginTop: 14 }}>{error}</div>}
          </div>
        </section>

        <section className="dashboard-section">
          <div className="section-heading"><div><div className="eyebrow">YOUR STUDENTS</div><h2>Academic overview</h2><p>Only information needed to support learning is shown here. Private AI Tutor conversations are not displayed.</p></div></div>
          {children.length === 0 ? <div className="empty-state"><div className="empty-icon">⌂</div><h3>No active student links yet</h3><p>Send a link request above. The student must accept it before their academic progress appears here.</p></div> : <div style={{ display: 'grid', gap: 20 }}>{children.map(child => <article className="panel" key={child.id} style={{ padding: 24 }}><div style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'start', flexWrap: 'wrap' }}><div><div className="eyebrow">STUDENT</div><h2 style={{ margin: '8px 0 4px' }}>{child.full_name}</h2><p className="muted" style={{ margin: 0 }}>{child.email}</p></div><div className="hero-badge"><span>●</span> {child.average}% exam average</div></div><div className="stat-grid" style={{ marginTop: 20 }}><article className="stat-card"><span>Mock exams</span><strong>{child.exams.length}</strong><small>Completed</small></article><article className="stat-card"><span>Average score</span><strong>{child.average}%</strong><small>Across completed exams</small></article><article className="stat-card"><span>Tasks completed</span><strong>{child.tasks.length}</strong><small>Study actions finished</small></article><article className="stat-card"><span>Study time</span><strong>{child.studyMinutes}m</strong><small>Estimated completed-task time</small></article></div><div style={{ marginTop: 24 }}><h3>Recent mock exams</h3>{child.exams.length === 0 ? <p className="muted">No completed mock exams yet.</p> : <div style={{ display: 'grid', gap: 8 }}>{child.exams.slice(0, 5).map(exam => <div key={exam.id} className="panel" style={{ padding: 14, display: 'flex', justifyContent: 'space-between', gap: 12 }}><span>{exam.subjects?.name || 'Subject'} · {exam.title}</span><strong>{exam.total_marks ? Math.round(Number(exam.score || 0) / Number(exam.total_marks) * 100) : 0}%</strong></div>)}</div>}</div></article>)}</div>}
        </section>
      </div>
    </section>
  </main>
}
