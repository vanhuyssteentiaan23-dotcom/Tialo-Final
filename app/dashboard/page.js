'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

const quickActions = [
  { icon: '◈', title: 'AI Tutor', text: 'Learn from your uploaded material.', href: '/ai-tutor' },
  { icon: '□', title: 'Mock Exams', text: 'Test yourself with exam-style questions.', href: '/mock-exams' },
  { icon: '✓', title: 'Daily Tasks', text: 'Work through today’s study priorities.', href: '/daily-tasks' },
  { icon: '↗', title: 'Progress', text: 'Review scores, study time and growth.', href: '/progress' },
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
  const [aiTheme, setAiTheme] = useState(false)

  useEffect(() => {
    const savedTheme = window.localStorage.getItem('tialo-color-theme') === 'ai-default'
    setAiTheme(savedTheme)
    document.documentElement.classList.toggle('tialo-ai-default', savedTheme)

    async function load() {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) { window.location.href = '/login'; return }
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) { window.location.href = '/login'; return }
      const { data: currentProfile, error: profileError } = await supabase.from('profiles').select('full_name,date_of_birth,role').eq('id', currentUser.id).maybeSingle()
      if (profileError || !currentProfile?.full_name || !currentProfile?.date_of_birth || !currentProfile?.role) { window.location.href = '/onboarding'; return }
      const age = calculateAge(currentProfile.date_of_birth)
      if (currentProfile.role === 'parent' && age >= 18) { window.location.href = '/parent'; return }
      if (currentProfile.role === 'student' && age < 16) {
        const { data: activeLink, error: linkError } = await supabase.from('parent_child').select('id').eq('child_id', currentUser.id).eq('status', 'active').limit(1).maybeSingle()
        if (linkError || !activeLink) { window.location.href = '/parent-link'; return }
      }
      setUser(currentUser); setProfile(currentProfile)
      const { data: subjectRows, error: subjectsError } = await supabase.from('subjects').select('*').order('created_at', { ascending: true })
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

  function toggleTheme() {
    const next = !aiTheme
    setAiTheme(next)
    document.documentElement.classList.toggle('tialo-ai-default', next)
    window.localStorage.setItem('tialo-color-theme', next ? 'ai-default' : 'tialo-neon')
  }

  const firstName = useMemo(() => profile?.full_name?.trim().split(/\s+/)[0] || 'Student', [profile])

  if (loading) return <main className="shell dashboard-loading"><div className="loader-card"><div className="brand">TIA<span>LO</span></div><p>Loading your academic workspace…</p></div></main>

  return (
    <main className="shell dashboard-shell">
      <aside className="sidebar">
        <div className="brand">TIA<span>LO</span></div>
        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav">
          <a className="side-link active" href="/dashboard"><span>⌂</span> Overview</a>
          <a className="side-link" href="/subjects"><span>▣</span> Subjects</a>
          <a className="side-link" href="/ai-tutor"><span>◈</span> AI Tutor</a>
          <a className="side-link" href="/mock-exams"><span>□</span> Mock Exams</a>
          <a className="side-link" href="/daily-tasks"><span>✓</span> Daily Tasks</a>
          <a className="side-link" href="/progress"><span>↗</span> Progress</a>
          <a className="side-link" href="/billing"><span>R</span> Subscription</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="student-mini"><div className="avatar">{firstName.charAt(0).toUpperCase()}</div><div><strong>{firstName}</strong><span>Student account</span></div></div>
          <button className="side-signout" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-left"><span className="topbar-title">TIALO Workspace</span><span className="topbar-dot">●</span><span className="muted">Private & secure</span></div>
          <div className="topbar-right">
            <button className="theme-control" type="button" onClick={toggleTheme} aria-label="Change colour theme">
              <span className="theme-control-icon">✦</span>
              <span><strong>{aiTheme ? 'AI Default' : 'TIALO Neon'}</strong><small>Colour theme</small></span>
              <span className="theme-toggle">{aiTheme ? 'TIALO' : 'AI'}</span>
            </button>
            <div className="topbar-profile"><div className="topbar-avatar">{firstName.charAt(0).toUpperCase()}</div><div><strong>{firstName}</strong><span>{user?.email}</span></div></div>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-card">
            <div className="welcome-copy">
              <span className="section-kicker">YOUR ACADEMIC COACH</span>
              <h1>Ready when you are,<br /><span>{firstName}.</span></h1>
              <p>One intelligent workspace for your subjects, study material, practice exams and progress.</p>
              <div className="welcome-actions"><a className="btn primary" href="/ai-tutor">Open AI Tutor <span>→</span></a><a className="btn secondary" href="/daily-tasks">View today’s tasks</a></div>
            </div>
            <div className="welcome-orbit" aria-hidden="true"><div className="orbit-ring ring-one"></div><div className="orbit-ring ring-two"></div><div className="orbit-core"><span>AI</span><small>COACH</small></div></div>
          </section>

          <section className="dashboard-section dashboard-section-tight">
            <div className="section-heading"><div><span className="section-kicker">AT A GLANCE</span><h2>Your workspace</h2></div></div>
            <div className="stat-grid redesigned-stats">
              <a className="stat-card featured-stat" href="/subjects"><div className="stat-icon">▣</div><span>Subjects</span><strong>{subjects.length}</strong><small>In your workspace <b>→</b></small></a>
              <a className="stat-card" href="/daily-tasks"><div className="stat-icon">✓</div><span>Daily Tasks</span><strong>→</strong><small>Open your study plan <b>→</b></small></a>
              <a className="stat-card" href="/mock-exams"><div className="stat-icon">□</div><span>Mock Exams</span><strong>→</strong><small>Practice and review <b>→</b></small></a>
              <a className="stat-card" href="/progress"><div className="stat-icon">↗</div><span>Progress</span><strong>→</strong><small>Track your performance <b>→</b></small></a>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="section-heading"><div><span className="section-kicker">YOUR LEARNING</span><h2>Subjects</h2><p>Build your study workspace around the subjects you are taking.</p></div><a className="btn primary" href="/subjects">+ Add subject</a></div>
            {subjectError && <div className="notice">{subjectError}</div>}
            {subjects.length === 0 ? <div className="empty-state"><div className="empty-icon">▣</div><h3>Start with your first subject</h3><p>Add a subject, then upload your learning material so TIALO can build your academic tools around it.</p><a className="btn primary" href="/subjects" style={{ marginTop: 16 }}>Add your first subject</a></div> : <div className="subject-grid redesigned-subjects">{subjects.map((subject, index) => <a className="subject-card" href="/subjects" key={subject.id || index}><div className="subject-top"><span className="subject-number">{String(index + 1).padStart(2, '0')}</span><span className="subject-arrow">↗</span></div><h3>{subject.name || subject.title || `Subject ${index + 1}`}</h3><p>Open subject workspace</p></a>)}</div>}
          </section>

          <section className="dashboard-section">
            <div className="section-heading"><div><span className="section-kicker">STUDY TOOLS</span><h2>Go straight to what you need</h2><p>Everything connects back to your subjects and uploaded material.</p></div></div>
            <div className="tool-grid redesigned-tools">{quickActions.map(action => <a className="tool-card" href={action.href} key={action.title}><div className="tool-icon">{action.icon}</div><div><h3>{action.title}</h3><p>{action.text}</p></div><span className="tool-status">Open <b>→</b></span></a>)}</div>
          </section>

          <section className="privacy-strip redesigned-privacy"><div><div className="privacy-title"><span>✓</span> Your academic workspace is private</div><p>Your signed-in account keeps your subjects, material, results and study records separated from other students.</p></div><span>SECURE BY DESIGN</span></section>
        </div>
      </section>
    </main>
  )
}
