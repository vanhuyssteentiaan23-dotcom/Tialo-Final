'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

export default function MockExamsPage() {
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [count, setCount] = useState(10)
  const [exam, setExam] = useState(null)
  const [questions, setQuestions] = useState([])
  const [answers, setAnswers] = useState({})
  const [review, setReview] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')

  const selectedSubject = useMemo(() => subjects.find(item => item.id === subjectId), [subjects, subjectId])

  async function getToken(supabase) {
    const { data, error: sessionError } = await supabase.auth.getSession()
    let token = data?.session?.access_token
    if (!token || sessionError) {
      const refreshed = await supabase.auth.refreshSession()
      token = refreshed.data?.session?.access_token
    }
    if (!token) throw new Error('Your login session has expired. Please log in again.')
    return token
  }

  async function loadPage() {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) { window.location.href = '/login'; return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { window.location.href = '/login'; return }
    const { data: subjectData, error: subjectError } = await supabase.from('subjects').select('id,name').eq('user_id', user.id).order('created_at', { ascending: true })
    if (subjectError) setError(subjectError.message)
    else {
      setSubjects(subjectData || [])
      if (subjectData?.[0]) setSubjectId(subjectData[0].id)
    }
    try {
      const token = await getToken(supabase)
      const response = await fetch('/api/mock-exams', { headers: { Authorization: `Bearer ${token}` } })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not load exam history.')
      setHistory(result.exams || [])
    } catch (historyError) {
      setError(historyError instanceof Error ? historyError.message : 'Could not load exam history.')
    }
    setLoading(false)
  }

  useEffect(() => { loadPage() }, [])

  async function generateExam() {
    if (!subjectId || working) return
    setWorking(true)
    setError('')
    setReview(null)
    setExam(null)
    setQuestions([])
    setAnswers({})
    try {
      const supabase = getSupabaseBrowserClient()
      const token = await getToken(supabase)
      const response = await fetch('/api/mock-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subjectId, count }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not generate the mock exam.')
      setExam(result.exam)
      setQuestions(result.questions || [])
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Could not generate the mock exam.')
    } finally { setWorking(false) }
  }

  async function submitExam(event) {
    event.preventDefault()
    if (!exam || working) return
    setWorking(true)
    setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const token = await getToken(supabase)
      const payload = questions.map(question => ({ position: question.position, answer: answers[question.position] || '' }))
      const response = await fetch('/api/mock-exams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'submit', examId: exam.id, answers: payload }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Could not submit the exam.')
      setReview(result.review || [])
      setExam(result.exam)
      const historyResponse = await fetch('/api/mock-exams', { headers: { Authorization: `Bearer ${token}` } })
      const historyResult = await historyResponse.json().catch(() => ({}))
      if (historyResponse.ok) setHistory(historyResult.exams || [])
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit the exam.')
    } finally { setWorking(false) }
  }

  function startNewExam() {
    setExam(null); setQuestions([]); setAnswers({}); setReview(null); setError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) return <main className="shell dashboard-loading"><div className="loader-card"><div className="brand">TIA<span>LO</span></div><p>Loading your Mock Exams…</p></div></main>

  return (
    <main className="shell dashboard-shell">
      <aside className="sidebar">
        <a className="brand" href="/dashboard">TIA<span>LO</span></a>
        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav">
          <a className="side-link" href="/dashboard"><span>⌂</span> Overview</a>
          <a className="side-link" href="/subjects"><span>▣</span> Subjects</a>
          <a className="side-link" href="/ai-tutor"><span>◈</span> AI Tutor</a>
          <a className="side-link active" href="/mock-exams"><span>□</span> Mock Exams</a>
          <a className="side-link" href="/daily-tasks"><span>✓</span> Daily Tasks</a>
          <a className="side-link" href="/progress"><span>↗</span> Progress</a>
        </nav>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div><span className="topbar-title">Mock Exams</span><span className="topbar-dot">●</span><span className="muted">Generated from your material</span></div>
          <a className="btn secondary" href="/materials">Manage materials</a>
        </header>

        <div className="dashboard-content">
          {!exam && (
            <>
              <div className="dashboard-hero">
                <div>
                  <div className="eyebrow">TIALO MOCK EXAMS</div>
                  <h1>Test what you know.</h1>
                  <p>Generate a Grade 12 multiple-choice exam using only your processed study material. Your answers and results are saved to your account.</p>
                </div>
                <div className="hero-badge"><span>●</span> Material locked</div>
              </div>

              {error && <div className="notice" style={{ marginTop: 24 }}>{error}</div>}

              <section className="dashboard-section">
                <div className="panel" style={{ padding: 24 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: 18, alignItems: 'end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Study subject</label>
                      <select value={subjectId} onChange={event => setSubjectId(event.target.value)} disabled={!subjects.length} style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: '#0c1a2b', color: '#fff' }}>
                        {!subjects.length && <option>No subjects yet</option>}
                        {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Questions</label>
                      <select value={count} onChange={event => setCount(Number(event.target.value))} style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: '#0c1a2b', color: '#fff' }}>
                        <option value={5}>5 questions</option><option value={10}>10 questions</option><option value={15}>15 questions</option><option value={20}>20 questions</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                    <span className="muted" style={{ fontSize: 13 }}>{selectedSubject ? `Questions will be based only on ${selectedSubject.name} material.` : 'Choose a subject first.'}</span>
                    <button className="btn primary" onClick={generateExam} disabled={!subjectId || working}>{working ? 'Generating exam…' : 'Generate Mock Exam'}</button>
                  </div>
                </div>
              </section>

              <section className="dashboard-section">
                <div className="section-heading"><div><div className="eyebrow">EXAM HISTORY</div><h2>Your results</h2></div></div>
                <div className="panel" style={{ overflow: 'hidden' }}>
                  {history.length === 0 ? <div style={{ padding: 28 }} className="muted">Your completed mock exams will appear here permanently.</div> : history.map(item => {
                    const percent = item.score == null ? null : Math.round((item.score / item.total_marks) * 100)
                    return <div key={item.id} style={{ padding: '18px 22px', borderBottom: '1px solid rgba(255,255,255,.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 18 }}>
                      <div><strong>{item.title}</strong><div className="muted" style={{ fontSize: 12, marginTop: 5 }}>{item.subjects?.name || 'Subject'} · {new Date(item.created_at).toLocaleDateString()}</div></div>
                      <div style={{ textAlign: 'right' }}>{percent == null ? <span className="muted">In progress</span> : <><strong style={{ fontSize: 20 }}>{percent}%</strong><div className="muted" style={{ fontSize: 11 }}>{item.score}/{item.total_marks}</div></>}</div>
                    </div>
                  })}
                </div>
              </section>
            </>
          )}

          {exam && !review && (
            <section className="dashboard-section">
              <div className="dashboard-hero">
                <div><div className="eyebrow">{selectedSubject?.name || 'MOCK EXAM'}</div><h1>{exam.title}</h1><p>{questions.length} questions · 1 mark each · Choose the best answer.</p></div>
                <div className="hero-badge"><span>●</span> Exam in progress</div>
              </div>
              {error && <div className="notice" style={{ marginTop: 24 }}>{error}</div>}
              <form onSubmit={submitExam} style={{ marginTop: 24 }}>
                {questions.map(question => (
                  <div className="panel" key={question.id} style={{ padding: 24, marginBottom: 16 }}>
                    <div className="eyebrow">QUESTION {question.position}</div>
                    <h3 style={{ margin: '8px 0 18px', lineHeight: 1.45 }}>{question.prompt}</h3>
                    <div style={{ display: 'grid', gap: 10 }}>
                      {question.options.map((option, index) => {
                        const letter = String.fromCharCode(65 + index)
                        return <label key={option} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14, borderRadius: 12, border: `1px solid ${answers[question.position] === option ? 'rgba(58,220,177,.6)' : 'rgba(255,255,255,.1)'}`, background: answers[question.position] === option ? 'rgba(58,220,177,.08)' : 'transparent', cursor: 'pointer' }}>
                          <input type="radio" name={`question-${question.position}`} value={option} checked={answers[question.position] === option} onChange={() => setAnswers(current => ({ ...current, [question.position]: option }))} style={{ marginTop: 4 }} />
                          <span><strong>{letter}.</strong> {option}</span>
                        </label>
                      })}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                  <button type="button" className="btn secondary" onClick={startNewExam}>Cancel</button>
                  <button type="submit" className="btn primary" disabled={working}>{working ? 'Marking…' : 'Submit Exam'}</button>
                </div>
              </form>
            </section>
          )}

          {exam && review && (
            <section className="dashboard-section">
              <div className="dashboard-hero">
                <div><div className="eyebrow">EXAM COMPLETE</div><h1>{exam.title}</h1><p>Result saved permanently to your TIALO account.</p></div>
                <div style={{ textAlign: 'right' }}><div className="eyebrow">SCORE</div><div style={{ fontSize: 44, fontWeight: 900 }}>{exam.score}/{exam.total_marks}</div><div className="muted">{Math.round((exam.score / exam.total_marks) * 100)}%</div></div>
              </div>
              {error && <div className="notice" style={{ marginTop: 24 }}>{error}</div>}
              <div style={{ marginTop: 24 }}>
                {review.map(item => <div className="panel" key={item.id} style={{ padding: 22, marginBottom: 14 }}>
                  <div className="eyebrow">QUESTION {item.position} · {item.correct ? 'CORRECT' : 'REVIEW'}</div>
                  <h3 style={{ margin: '8px 0 16px', lineHeight: 1.45 }}>{item.prompt}</h3>
                  <div className="muted" style={{ fontSize: 13 }}>Your answer: <strong style={{ color: '#fff' }}>{item.student_answer || 'Not answered'}</strong></div>
                  {!item.correct && <div style={{ marginTop: 7, fontSize: 13 }}>Correct answer: <strong>{item.correct_answer}</strong></div>}
                  {item.explanation && <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,.08)', fontSize: 13, lineHeight: 1.6 }}><strong>Why:</strong> {item.explanation}</div>}
                </div>)}
              </div>
              <button className="btn primary" onClick={startNewExam}>Take Another Exam</button>
            </section>
          )}
        </div>
      </section>
    </main>
  )
}
