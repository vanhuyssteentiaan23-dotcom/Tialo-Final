'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function loadSubjects() {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login'
      return
    }

    const { data, error: queryError } = await supabase
      .from('subjects')
      .select('id,name,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })

    if (queryError) setError(queryError.message)
    else setSubjects(data || [])
    setLoading(false)
  }

  useEffect(() => { loadSubjects() }, [])

  async function addSubject(event) {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return

    setSaving(true)
    setError('')

    const supabase = getSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      window.location.href = '/login'
      return
    }

    const { error: insertError } = await supabase
      .from('subjects')
      .insert({ user_id: user.id, name: cleanName })

    if (insertError) setError(insertError.message)
    else {
      setName('')
      await loadSubjects()
    }

    setSaving(false)
  }

  async function deleteSubject(id) {
    if (!window.confirm('Delete this subject? Any material linked to it may also be affected.')) return

    const supabase = getSupabaseBrowserClient()
    const { error: deleteError } = await supabase.from('subjects').delete().eq('id', id)
    if (deleteError) setError(deleteError.message)
    else setSubjects(current => current.filter(subject => subject.id !== id))
  }

  return (
    <main className="shell" style={{ minHeight: '100vh' }}>
      <nav className="nav">
        <a className="brand" href="/dashboard">TIA<span>LO</span></a>
        <a className="btn secondary" href="/dashboard">Back to dashboard</a>
      </nav>

      <section className="section" style={{ paddingTop: 56 }}>
        <div className="eyebrow">Stage 4</div>
        <h1 style={{ fontSize: 48, margin: '18px 0 8px' }}>Your subjects</h1>
        <p className="muted" style={{ maxWidth: 700, lineHeight: 1.7 }}>
          Add the subjects you are currently studying. Your learning materials, AI tutor context, mock exams and progress will be organised around these subjects.
        </p>

        <form onSubmit={addSubject} className="panel" style={{ marginTop: 32, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            placeholder="e.g. Business Management"
            aria-label="Subject name"
            style={{ flex: '1 1 320px', minWidth: 0, padding: '15px 16px', borderRadius: 12, border: '1px solid rgba(255,255,255,.12)', background: 'rgba(255,255,255,.06)', color: '#fff', outline: 'none' }}
            maxLength={100}
          />
          <button className="btn primary" type="submit" disabled={saving || !name.trim()}>
            {saving ? 'Adding…' : 'Add subject'}
          </button>
        </form>

        {error && <p style={{ color: '#ff9b9b', marginTop: 18 }}>{error}</p>}

        {loading ? (
          <p className="muted" style={{ marginTop: 30 }}>Loading subjects…</p>
        ) : subjects.length === 0 ? (
          <div className="card" style={{ marginTop: 24, padding: 34 }}>
            <h3>No subjects yet</h3>
            <p>Start by adding your first subject above.</p>
          </div>
        ) : (
          <div className="grid" style={{ marginTop: 24 }}>
            {subjects.map(subject => (
              <article className="card" key={subject.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="eyebrow" style={{ fontSize: 10 }}>Subject</div>
                    <h3 style={{ fontSize: 22, marginTop: 14 }}>{subject.name}</h3>
                    <p>Upload your notes, textbooks and presentations for this subject.</p>
                    <a className="btn primary" href={`/materials?subject=${encodeURIComponent(subject.id)}`} style={{ marginTop: 10 }}>Upload materials</a>
                  </div>
                  <button className="btn secondary" onClick={() => deleteSubject(subject.id)} aria-label={`Delete ${subject.name}`}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  )
}
