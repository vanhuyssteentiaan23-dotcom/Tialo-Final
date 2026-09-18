'use client'

import { useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

export default function AiTutorPage() {
  const [subjects, setSubjects] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) {
        window.location.href = '/login'
        return
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
        return
      }
      const { data, error: subjectError } = await supabase
        .from('subjects')
        .select('id,name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
      if (subjectError) setError(subjectError.message)
      else {
        const rows = data || []
        setSubjects(rows)
        if (rows[0]) setSubjectId(rows[0].id)
      }
      setLoading(false)
    }
    load()
  }, [])

  const selectedSubject = useMemo(() => subjects.find(item => item.id === subjectId), [subjects, subjectId])

  async function sendQuestion(event) {
    event?.preventDefault()
    const cleanQuestion = question.trim()
    if (!cleanQuestion || !subjectId || sending) return

    setSending(true)
    setError('')
    const nextMessages = [...messages, { role: 'user', content: cleanQuestion }]
    setMessages(nextMessages)
    setQuestion('')

    try {
      const supabase = getSupabaseBrowserClient()
      const { data, error: sessionError } = await supabase.auth.getSession()
      let token = data?.session?.access_token
      if (!token || sessionError) {
        const refreshed = await supabase.auth.refreshSession()
        token = refreshed.data?.session?.access_token
      }
      if (!token) throw new Error('Your login session has expired. Please log in again.')

      const response = await fetch('/api/ai-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subjectId, question: cleanQuestion, history: messages }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'The AI Tutor could not answer.')
      setMessages(current => [...current, { role: 'assistant', content: result.answer }])
    } catch (sendError) {
      setMessages(current => current.slice(0, -1))
      setError(sendError instanceof Error ? sendError.message : 'The AI Tutor could not answer.')
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return <main className="shell dashboard-loading"><div className="loader-card"><div className="brand">TIA<span>LO</span></div><p>Loading your AI Tutor…</p></div></main>
  }

  return (
    <main className="shell dashboard-shell">
      <aside className="sidebar">
        <a className="brand" href="/dashboard">TIA<span>LO</span></a>
        <div className="sidebar-label">Workspace</div>
        <nav className="sidebar-nav">
          <a className="side-link" href="/dashboard"><span>⌂</span> Overview</a>
          <a className="side-link" href="/subjects"><span>▣</span> Subjects</a>
          <a className="side-link active" href="/ai-tutor"><span>◈</span> AI Tutor</a>
          <a className="side-link" href="/mock-exams"><span>□</span> Mock Exams</a>
          <a className="side-link" href="/daily-tasks"><span>✓</span> Daily Tasks</a>
          <a className="side-link" href="/progress"><span>↗</span> Progress</a>
        </nav>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-topbar">
          <div><span className="topbar-title">AI Tutor</span><span className="topbar-dot">●</span><span className="muted">Material-grounded learning</span></div>
          <a className="btn secondary" href="/materials">Manage materials</a>
        </header>

        <div className="dashboard-content">
          <div className="dashboard-hero">
            <div>
              <div className="eyebrow">TIALO AI TUTOR</div>
              <h1>Ask. Understand. Improve.</h1>
              <p>Ask questions about your uploaded study material. TIALO answers from your selected subject material instead of inventing information from general knowledge.</p>
            </div>
            <div className="hero-badge"><span>●</span> Source locked</div>
          </div>

          {error && <div className="notice" style={{ marginTop: 28 }}>{error}</div>}

          <section className="dashboard-section">
            <div className="panel" style={{ padding: 22 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 800, marginBottom: 10 }}>Study subject</label>
              <select value={subjectId} onChange={event => { setSubjectId(event.target.value); setMessages([]); setError('') }} disabled={!subjects.length} style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: '#0c1a2b', color: '#fff' }}>
                {!subjects.length && <option>No subjects yet</option>}
                {subjects.map(subject => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
              <div style={{ marginTop: 12, color: '#718096', fontSize: 12 }}>
                {selectedSubject ? `Using processed material from ${selectedSubject.name}.` : 'Choose a subject to begin.'}
              </div>
            </div>
          </section>

          <section className="dashboard-section">
            <div className="tutor-chat">
              <div className="tutor-messages">
                {messages.length === 0 ? (
                  <div className="tutor-empty">
                    <div className="empty-icon">◈</div>
                    <h3>What are you studying?</h3>
                    <p>Try: “Explain photosynthesis in simple terms” or “What are the functions of the mitochondria?”</p>
                  </div>
                ) : messages.map((message, index) => (
                  <div className={`tutor-message ${message.role}`} key={`${message.role}-${index}`}>
                    <div className="tutor-role">{message.role === 'user' ? 'YOU' : 'TIA LO AI TUTOR'}</div>
                    <div className="tutor-content">{message.content}</div>
                  </div>
                ))}
                {sending && <div className="tutor-message assistant"><div className="tutor-role">TIA LO AI TUTOR</div><div className="tutor-content muted">Thinking from your material…</div></div>}
              </div>

              <form onSubmit={sendQuestion} className="tutor-composer">
                <textarea value={question} onChange={event => setQuestion(event.target.value)} placeholder={selectedSubject ? `Ask TIALO about ${selectedSubject.name}…` : 'Choose a subject first…'} disabled={!subjectId || sending} rows={3} />
                <button className="btn primary" type="submit" disabled={!question.trim() || !subjectId || sending}>{sending ? 'Thinking…' : 'Ask TIALO'}</button>
              </form>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}
