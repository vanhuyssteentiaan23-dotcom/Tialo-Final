'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

const quickActions = [
  { icon: '◈', title: 'AI Tutor', text: 'Ask questions and learn step by step.', status: 'Ready', href: '/ai-tutor' },
  { icon: '▣', title: 'Mock Exams', text: 'Create practice exams from your own material.', status: 'Coming next', href: '#' },
  { icon: '✓', title: 'Daily Tasks', text: 'Stay on top of today’s study priorities.', status: 'Coming next', href: '#' },
  { icon: '↗', title: 'Progress', text: 'See scores, study time and weak areas.', status: 'Coming next', href: '#' },
]

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null
  const today = new Date()
  const birth = new Date(`${dateOfBirth}T00:00:00`)
  let age = today.getFullYear() - birth.getFullYear()
  const month = today.getMonth() - birth.getMonth()
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [subjectError, setSubjectError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) {
        window.location.href = '/login'
        return
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      const { data: currentProfile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name,date_of_birth,role')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (profileError || !currentProfile?.full_name || !currentProfile?.date_of_birth || !currentProfile?.role) {
        window.location.href = '/onboarding'
        return
      }

      const age = calculateAge(currentProfile.date_of_birth)
      if (age < 16) {
        window.location.href = '/onboarding'
        return
      }

      setUser(currentUser)
      setProfile(currentProfile)

      const { data: subjectRows, error: subjectsError } = await supabase
        .from('subjects')
        .select('*')
        .order('created_at', { ascending: true })

      if (subjectsError) setSubjectError('Your subjects could not be loaded yet.')
      else setSubjects(subjectRows || [])

      setLoading(false)
    }

    load()
  }, [])

  async function signOut() {
    const supabase = getSupabaseBrowserClient()
    await supabase?.auth.signOut()
    window.location.href = '/'
  }

  const firstName = useMemo(() => profile?.full_name?.trim().split(/\s+/)[0] || 'Student', [profile])

  if (loading) {
    return <main className="shell dashboard-loading"><div className="loader-card"><div className="brand">TIA<span>LO</span></div><p>Loading your academic workspace…</p></div></main>
  }

  return (
    <main className="shell dashboard-shell">
      <aside className="sidebar">
        <div className="brand">TIA<span>LO</span></div>
        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav">
          <a className="side-link active" href="/dashboard"><span>⌂</span> Overview</a>
          <a className="side-link" href="/subjects"><span>▣</span> Subjects</a>
          <a className="side-link" href="/ai-tutor"><span>◈</span> AI Tutor</a>
          <a className="side-link" href="#exams"><span>□</span> Mock Exams</a>
          <a className="side-link" href="#tasks"><span>✓</span> Daily Tasks</a>
          <a className="side-link" href="#progress"><span>↗</span> Progress</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="student-mini">
            <div className="avatar">{firstName.charAt(0).toUpperCase()}</div>
            <div><strong>{firstName}</strong><span>Student account</span></div>
          </div>
          <button className="side-signout" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div><span className="topbar-title">Academic workspace</span><span className="topbar-dot">●</span><span className="muted">Private & secure</span></div>
          <span className="top-email">{user?.email}</span>
        </header>

        <div className="dashboard-content">
          <div className="dashboard-hero">
            <div>
              <div className="eyebrow">Student Dashboard</div>
              <h1>Good to see you, {firstName}.</h1>
              <p>Everything you need to learn, practise and improve — in one place.</p>
            </div>
            <div className="hero-badge"><span>●</span> Ready to learn</div>
          </div>

          <section className="stat-grid">
            <article className="stat-card"><span>Subjects</span><strong>{subjects.length}</strong><small>Added to your workspace</small></article>
            <article className="stat-card"><span>Daily tasks</span><strong>0</strong><small>Your plan will appear here</small></article>
            <article className="stat-card"><span>Mock exams</span><strong>0</strong><small>Your completed exams</small></article>
            <article className="stat-card"><span>Study streak</span><strong>0</strong><small>Days in a row</small></article>
          </section>

          <section id="subjects" className="dashboard-section">
            <div className="section-heading"><div><span className="section-kicker">YOUR LEARNING</span><h2>Subjects</h2><p>Add and manage the subjects you are currently studying.</p></div><a className="btn primary" href="/subjects">+ Add subject</a></div>
            {subjectError && <div className="notice">{subjectError}</div>}
            {subjects.length === 0 ? (
              <div className="empty-state"><div className="empty-icon">▣</div><h3>Your subjects will appear here</h3><p>Add your first subject to start organising learning material, AI tutor context, mock exams and progress.</p><a className="btn primary" href="/subjects" style={{ marginTop: 12 }}>Add your first subject</a></div>
            ) : (
              <div className="subject-grid">{subjects.map((subject, index) => <article className="subject-card" key={subject.id || index}><div className="subject-number">{String(index + 1).padStart(2, '0')}</div><h3>{subject.name || subject.title || `Subject ${index + 1}`}</h3><p>Materials and progress for this subject.</p><a className="btn secondary" href="/subjects" style={{ marginTop: 8 }}>Manage subjects</a></article>)}</div>
            )}
          </section>

          <section className="dashboard-section" id="ai-tutor">
            <div className="section-heading"><div><span className="section-kicker">TIALO TOOLS</span><h2>Your academic tools</h2><p>Built around your subjects and your own learning material.</p></div></div>
            <div className="tool-grid">{quickActions.map(action => <a className="tool-card" href={action.href} key={action.title}><div className="tool-icon">{action.icon}</div><div><h3>{action.title}</h3><p>{action.text}</p></div><span className="tool-status">{action.status}</span></a>)}</div>
          </section>

          <section className="privacy-strip"><div><strong>Your data belongs to your account.</strong><p>TIALO keeps your academic records separated using your signed-in account and database access rules.</p></div><span>SECURE WORKSPACE</span></section>
        </div>
      </section>
    </main>
  )
}
