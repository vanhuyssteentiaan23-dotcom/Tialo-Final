'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

function todayLocal() {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function formatDate(value) {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ProgressPage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [exams, setExams] = useState([])
  const [tasks, setTasks] = useState([])
  const [subjects, setSubjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) { window.location.href = '/login'; return }
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) { window.location.href = '/login'; return }
      setUser(currentUser)

      const [{ data: currentProfile }, { data: subjectRows, error: subjectError }, { data: examRows, error: examError }, { data: taskRows, error: taskError }] = await Promise.all([
        supabase.from('profiles').select('full_name').eq('id', currentUser.id).maybeSingle(),
        supabase.from('subjects').select('id,name').eq('user_id', currentUser.id).order('created_at', { ascending: true }),
        supabase.from('exam_attempts').select('id,title,subject_id,question_count,score,total_marks,status,created_at,completed_at,subjects(name)').eq('user_id', currentUser.id).eq('status', 'completed').order('completed_at', { ascending: false }).limit(100),
        supabase.from('daily_study_tasks').select('id,subject_id,title,estimated_minutes,completed,completed_at,task_date,subjects(name)').eq('user_id', currentUser.id).order('task_date', { ascending: false }).limit(300),
      ])

      if (subjectError || examError || taskError) setError('Some progress data could not be loaded yet.')
      setProfile(currentProfile || null)
      setSubjects(subjectRows || [])
      setExams(examRows || [])
      setTasks(taskRows || [])
      setLoading(false)
    }
    load()
  }, [])

  const stats = useMemo(() => {
    const completedTasks = tasks.filter(task => task.completed)
    const examScores = exams.filter(exam => Number(exam.total_marks) > 0).map(exam => Number(exam.score || 0) / Number(exam.total_marks) * 100)
    const average = examScores.length ? Math.round(examScores.reduce((a, b) => a + b, 0) / examScores.length) : 0
    const studyMinutes = completedTasks.reduce((sum, task) => sum + Number(task.estimated_minutes || 0), 0)
    const days = new Set(completedTasks.map(task => task.completed_at?.slice(0, 10)).filter(Boolean))
    let streak = 0
    const cursor = new Date(`${todayLocal()}T12:00:00`)
    while (true) {
      const key = cursor.toISOString().slice(0, 10)
      if (!days.has(key)) break
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }
    return { completedTasks: completedTasks.length, average, studyMinutes, streak }
  }, [tasks, exams])

  const subjectStats = useMemo(() => subjects.map(subject => {
    const subjectExams = exams.filter(exam => exam.subject_id === subject.id && Number(exam.total_marks) > 0)
    const subjectTasks = tasks.filter(task => task.subject_id === subject.id)
    const scores = subjectExams.map(exam => Number(exam.score || 0) / Number(exam.total_marks) * 100)
    return {
      ...subject,
      exams: subjectExams.length,
      average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      completedTasks: subjectTasks.filter(task => task.completed).length,
      totalTasks: subjectTasks.length,
    }
  }), [subjects, exams, tasks])

  if (loading) return <main className="shell dashboard-loading"><div className="loader-card"><div className="brand">TIA<span>LO</span></div><p>Loading your progress…</p></div></main>

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'Student'

  return <main className="shell dashboard-shell">
    <aside className="sidebar">
      <a className="brand" href="/dashboard">TIA<span>LO</span></a>
      <div className="sidebar-label">Workspace</div>
      <nav className="sidebar-nav">
        <a className="side-link" href="/dashboard"><span>⌂</span> Overview</a>
        <a className="side-link" href="/subjects"><span>▣</span> Subjects</a>
        <a className="side-link" href="/ai-tutor"><span>◈</span> AI Tutor</a>
        <a className="side-link" href="/mock-exams"><span>□</span> Mock Exams</a>
        <a className="side-link" href="/daily-tasks"><span>✓</span> Daily Tasks</a>
        <a className="side-link active" href="/progress"><span>↗</span> Progress</a>
      </nav>
      <div className="sidebar-bottom"><div className="student-mini"><div className="avatar">{firstName.charAt(0).toUpperCase()}</div><div><strong>{firstName}</strong><span>Student account</span></div></div><span className="muted" style={{ fontSize: 11 }}>{user?.email}</span></div>
    </aside>

    <section className="dashboard-main">
      <header className="dashboard-topbar"><div><span className="topbar-title">Progress</span><span className="topbar-dot">●</span><span className="muted">Your academic performance</span></div><a className="btn secondary" href="/dashboard">Dashboard</a></header>
      <div className="dashboard-content">
        <div className="dashboard-hero"><div><div className="eyebrow">TIALO PROGRESS</div><h1>See how you’re improving, {firstName}.</h1><p>Your mock-exam results and completed study tasks, kept together in one private progress view.</p></div><div className="hero-badge"><span>●</span> {stats.average ? `${stats.average}% average` : 'Start practising'}</div></div>
        {error && <div className="notice" style={{ marginTop: 24 }}>{error}</div>}

        <section className="stat-grid">
          <article className="stat-card"><span>Mock exams</span><strong>{exams.length}</strong><small>Completed exams</small></article>
          <article className="stat-card"><span>Average score</span><strong>{stats.average}%</strong><small>Across completed exams</small></article>
          <article className="stat-card"><span>Tasks completed</span><strong>{stats.completedTasks}</strong><small>Study actions finished</small></article>
          <article className="stat-card"><span>Study time</span><strong>{stats.studyMinutes >= 60 ? `${Math.floor(stats.studyMinutes / 60)}h ${stats.studyMinutes % 60}m` : `${stats.studyMinutes}m`}</strong><small>Estimated time from completed tasks</small></article>
        </section>

        <section className="dashboard-section">
          <div className="section-heading"><div><span className="section-kicker">BY SUBJECT</span><h2>Subject performance</h2><p>Track where you are strongest and where more practice may help.</p></div></div>
          {subjectStats.length === 0 ? <div className="empty-state"><div className="empty-icon">↗</div><h3>No subjects yet</h3><p>Add a subject and start using TIALO to build your progress history.</p><a className="btn primary" href="/subjects" style={{ marginTop: 12 }}>Add a subject</a></div> : <div className="subject-grid">{subjectStats.map(subject => <article className="subject-card" key={subject.id}><div className="subject-number">{subject.average == null ? '—' : `${subject.average}%`}</div><h3>{subject.name}</h3><p>{subject.exams ? `${subject.exams} completed mock exam${subject.exams === 1 ? '' : 's'} · ${subject.average}% average` : 'No completed mock exams yet.'}</p><div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}><span className="tool-status">{subject.completedTasks}/{subject.totalTasks} tasks</span>{subject.average != null && <span className="tool-status">{subject.average >= 75 ? 'Strong' : subject.average >= 50 ? 'Developing' : 'Needs practice'}</span>}</div></article>)}</div>}
        </section>

        <section className="dashboard-section">
          <div className="section-heading"><div><span className="section-kicker">EXAM HISTORY</span><h2>Recent results</h2><p>Your completed mock exams are retained so you can see your progress over time.</p></div><a className="btn secondary" href="/mock-exams">Take another exam</a></div>
          {exams.length === 0 ? <div className="empty-state"><div className="empty-icon">□</div><h3>No completed exams yet</h3><p>Complete your first mock exam and your result will appear here.</p></div> : <div style={{ display: 'grid', gap: 10 }}>{exams.slice(0, 12).map(exam => { const percent = exam.total_marks ? Math.round(Number(exam.score || 0) / Number(exam.total_marks) * 100) : 0; return <article className="panel" key={exam.id} style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr auto', gap: 16, alignItems: 'center' }}><div><h3 style={{ margin: 0 }}>{exam.title}</h3><p className="muted" style={{ margin: '5px 0 0', fontSize: 12 }}>{exam.subjects?.name || 'Subject'} · {formatDate(exam.completed_at || exam.created_at)} · {exam.question_count} questions</p></div><div style={{ textAlign: 'right' }}><strong style={{ fontSize: 24 }}>{exam.score}/{exam.total_marks}</strong><div className="muted" style={{ fontSize: 11 }}>{percent}%</div></div></article> })}</div>}
        </section>

        <section className="privacy-strip"><div><strong>Keep going.</strong><p>TIALO uses your own activity and completed exams to show your progress. Your academic data stays tied to your signed-in account.</p></div><span>PRIVATE PROGRESS</span></section>
      </div>
    </section>
  </main>
}
