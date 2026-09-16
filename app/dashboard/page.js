'use client'

import './dashboard-futuristic.css'
import './dashboard-reference.css'
import './dashboard-reference-finish.css'
import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

const quickActions = [
  { icon: '✦', title: 'AI Tutor', text: 'Ask questions, get explanations, learn faster.', href: '/ai-tutor' },
  { icon: '▤', title: 'Mock Exams', text: 'Practice with real exam questions.', href: '/mock-exams' },
  { icon: '✓', title: 'Daily Tasks', text: 'Stay consistent and stay on track.', href: '/daily-tasks' },
  { icon: '▥', title: 'Progress', text: 'Track your results and improvement.', href: '/progress' },
]

const themes = [
  { id: 'tialo-neon', name: 'TIALO Neon', description: 'Futuristic dark with neon accents', color: 'linear-gradient(135deg,#00f6ff,#00ffb3)' },
  { id: 'ai-default', name: 'AI Default', description: 'Clean blue/purple AI theme', color: 'linear-gradient(135deg,#65a7ff,#9b6cff)' },
  { id: 'midnight', name: 'Midnight', description: 'Deep dark minimal', color: 'linear-gradient(135deg,#dbe7f7,#667892)' },
  { id: 'emerald', name: 'Emerald', description: 'Green futuristic', color: 'linear-gradient(135deg,#00ff9d,#00c98b)' },
  { id: 'sunset', name: 'Sunset', description: 'Orange/pink accents', color: 'linear-gradient(135deg,#ffb347,#ff4f9a)' },
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
  const [theme, setTheme] = useState('tialo-neon')
  const [themeOpen, setThemeOpen] = useState(false)

  useEffect(() => {
    const saved = window.localStorage.getItem('tialo-color-theme') || 'tialo-neon'
    setTheme(saved)
    document.documentElement.classList.remove('tialo-ai-default', 'tialo-midnight', 'tialo-emerald', 'tialo-sunset')
    if (saved !== 'tialo-neon') document.documentElement.classList.add(`tialo-${saved.replace('tialo-', '')}`)

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

  function chooseTheme(next) {
    setTheme(next)
    setThemeOpen(false)
    window.localStorage.setItem('tialo-color-theme', next)
    document.documentElement.classList.remove('tialo-ai-default', 'tialo-midnight', 'tialo-emerald', 'tialo-sunset')
    if (next !== 'tialo-neon') document.documentElement.classList.add(`tialo-${next.replace('tialo-', '')}`)
  }

  async function signOut() {
    const supabase = getSupabaseBrowserClient()
    await supabase?.auth.signOut()
    window.location.href = '/'
  }

  const firstName = useMemo(() => profile?.full_name?.trim().split(/\s+/)[0] || 'Student', [profile])
  const activeTheme = themes.find(item => item.id === theme) || themes[0]

  if (loading) return <main className="shell dashboard-loading"><div className="loader-card"><div className="brand">TIA<span>LO</span></div><p>Loading your academic workspace…</p></div></main>

  return (
    <main className="shell dashboard-shell">
      <aside className="sidebar">
        <div className="brand">TIA<span>LO</span></div>
        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav">
          <a className="side-link active" href="/dashboard"><span>⌂</span> Overview</a>
          <a className="side-link" href="/subjects"><span>▱</span> Subjects</a>
          <a className="side-link" href="/ai-tutor"><span>✦</span> AI Tutor</a>
          <a className="side-link" href="/mock-exams"><span>▤</span> Mock Exams</a>
          <a className="side-link" href="/daily-tasks"><span>✓</span> Daily Tasks</a>
          <a className="side-link" href="/progress"><span>▥</span> Progress</a>
          <a className="side-link" href="/billing"><span>R</span> Subscription</a>
        </nav>
        <div className="sidebar-quote"><span>DISCIPLINE<br />CREATES<br />FREEDOM.</span><i></i></div>
        <div className="sidebar-bottom">
          <div className="student-mini"><div className="avatar">{firstName.charAt(0).toUpperCase()}</div><div><strong>{firstName}</strong><span>Student account</span></div></div>
          <button className="side-settings" type="button">⚙ <span>Settings</span></button>
          <button className="side-signout" onClick={signOut}>⇥ &nbsp; Sign out</button>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="topbar-left"><span className="topbar-title">TIALO Workspace</span><span className="topbar-dot">●</span><span className="muted">Private & secure</span></div>
          <div className="topbar-right">
            <div className="topbar-search"><span className="search-icon">⌕</span><span>Search subjects, notes, or ask anything...</span><span className="search-key">⌘ K</span></div>
            <div className="theme-wrap">
              <button className="theme-control" type="button" onClick={() => setThemeOpen(value => !value)} aria-expanded={themeOpen}><span className="theme-control-icon">✦</span><span><strong>{activeTheme.name}</strong></span><span className="theme-toggle">⌄</span></button>
              {themeOpen && <div className="theme-menu"><div className="theme-menu-title">Choose theme</div>{themes.map(item => <button key={item.id} className={`theme-option ${theme === item.id ? 'selected' : ''}`} type="button" onClick={() => chooseTheme(item.id)}><span className="theme-swatch" style={{ background: item.color }}></span><span><strong>{item.name}</strong><small>{item.description}</small></span><b>{theme === item.id ? '✓' : ''}</b></button>)}</div>}
            </div>
            <button className="topbar-icon" type="button" aria-label="Dark mode">☾</button>
            <button className="topbar-icon notification" type="button" aria-label="Notifications">♧<i></i></button>
            <div className="topbar-profile"><div className="topbar-avatar">{firstName.charAt(0).toUpperCase()}</div><div><strong>{firstName}</strong><span>{user?.email}</span></div></div>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-card">
            <div className="welcome-copy"><span className="section-kicker">WELCOME BACK, {firstName.toUpperCase()}</span><h1>Smarter study.<br /><span>Brighter future.</span></h1><p>Your AI academic coach is here to help you learn, practise and improve.</p><div className="welcome-actions"><a className="btn primary" href="/ai-tutor">✦ &nbsp; Open AI Tutor <span>→</span></a><a className="btn secondary" href="/daily-tasks">☷ &nbsp; Today’s Tasks</a></div></div>
            <div className="welcome-orbit" aria-hidden="true"><div className="orbit-ring ring-one"></div><div className="orbit-ring ring-two"></div><div className="orbit-core"><span>AI</span><small>COACH</small></div></div><div className="hero-quote">“A MORE<br />CONFIDENT YOU<br />STARTS HERE.”<i></i></div>
          </section>

          <section className="dashboard-section dashboard-section-tight"><div className="section-heading"><div><span className="section-kicker">AT A GLANCE</span></div></div><div className="stat-grid redesigned-stats"><a className="stat-card" href="/subjects"><div className="stat-icon">▱</div><span>Subjects</span><strong>{subjects.length}</strong><small>In your workspace <b>→</b></small></a><a className="stat-card" href="/daily-tasks"><div className="stat-icon">✓</div><span>Daily tasks</span><strong>0</strong><small>Tasks remaining <b>→</b></small></a><a className="stat-card" href="/mock-exams"><div className="stat-icon">▤</div><span>Mock exams</span><strong>0</strong><small>Completed <b>→</b></small></a><a className="stat-card" href="/progress"><div className="stat-icon">▥</div><span>Progress</span><strong>Get started</strong><small>Track your performance <b>→</b></small></a></div></section>

          <section className="dashboard-section"><div className="section-heading"><div><span className="section-kicker">YOUR SUBJECTS</span><h2>Continue learning</h2><p>Manage your subjects, upload material and start studying.</p></div><a className="btn primary add-subject" href="/subjects">＋ &nbsp; Add subject</a></div>{subjectError && <div className="notice">{subjectError}</div>}{subjects.length === 0 ? <div className="empty-state"><div className="empty-icon">▱</div><h3>Start with your first subject</h3><p>Add a subject, then upload your learning material so TIALO can build your academic tools around it.</p><a className="btn primary" href="/subjects" style={{ marginTop: 16 }}>Add your first subject</a></div> : <div className="subject-grid redesigned-subjects">{subjects.map((subject, index) => <a className="subject-card" href="/subjects" key={subject.id || index}><div className="subject-art"><span></span><span></span><span></span></div><div className="subject-body"><div className="subject-top"><span className="subject-icon">▱</span><span className="subject-arrow">→</span></div><h3>{subject.name || subject.title || `Subject ${index + 1}`}</h3><p>0 materials</p><div className="subject-progress"><span></span></div><small>0%</small></div></a>)}</div>}</section>

          <section className="dashboard-section"><div className="section-heading"><div><span className="section-kicker">STUDY TOOLS</span><p>Everything you need in one place.</p></div></div><div className="tool-grid redesigned-tools">{quickActions.map(action => <a className="tool-card" href={action.href} key={action.title}><div className="tool-icon">{action.icon}</div><div><h3>{action.title}</h3><p>{action.text}</p></div><span className="tool-status">→</span></a>)}</div></section>
          <div className="dashboard-motto"><span>LEARN</span><span>PRACTISE</span><span>IMPROVE</span><span>SUCCEED</span><i></i></div>
        </div>
      </section>
    </main>
  )
}
