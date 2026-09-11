'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

export default function ParentLinkPage() {
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function load() {
    const supabase = getSupabaseBrowserClient()
    if (!supabase) return (window.location.href = '/login')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return (window.location.href = '/login')
    const { data: profile } = await supabase.from('profiles').select('full_name,date_of_birth,role').eq('id', user.id).maybeSingle()
    if (!profile || profile.role !== 'student') return (window.location.href = '/dashboard')
    const { data, error: linkError } = await supabase.from('parent_child').select('id,parent_id,status,created_at,profiles:parent_id(full_name,email)').eq('child_id', user.id).eq('status', 'pending').order('created_at', { ascending: false })
    if (linkError) setError(linkError.message)
    else setLinks(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function respond(id, accepted) {
    setWorking(true); setError(''); setMessage('')
    const supabase = getSupabaseBrowserClient()
    const update = accepted ? { status: 'active', accepted_at: new Date().toISOString() } : { status: 'rejected', accepted_at: null }
    const { error: updateError } = await supabase.from('parent_child').update(update).eq('id', id)
    if (updateError) setError(updateError.message)
    else if (accepted) { setMessage('Parent link accepted. Your parent can now see your academic progress.'); setLinks(current => current.filter(link => link.id !== id)) }
    else { setMessage('Parent link declined.'); setLinks(current => current.filter(link => link.id !== id)) }
    setWorking(false)
  }

  if (loading) return <main className="shell dashboard-loading"><div className="loader-card"><div className="brand">TIA<span>LO</span></div><p>Checking parent link requests…</p></div></main>

  return <main className="shell" style={{ minHeight: '100vh', padding: 24, display: 'grid', placeItems: 'center' }}>
    <section className="card" style={{ maxWidth: 700, width: '100%', padding: 36 }}>
      <a className="brand" href="/">TIA<span>LO</span></a>
      <div className="eyebrow" style={{ marginTop: 32 }}>PARENT / GUARDIAN LINK</div>
      <h1 style={{ fontSize: 42, margin: '14px 0 10px' }}>Parent link requests</h1>
      <p className="muted" style={{ lineHeight: 1.7 }}>A parent or guardian has requested access to your TIALO academic progress. You choose whether to accept the connection.</p>
      {message && <div className="notice" style={{ marginTop: 20 }}>{message}</div>}
      {error && <div className="notice" style={{ marginTop: 20 }}>{error}</div>}
      {links.length === 0 ? <div className="empty-state" style={{ marginTop: 24 }}><div className="empty-icon">✓</div><h3>No pending requests</h3><p>There are no parent or guardian link requests waiting for your approval.</p><button className="btn primary" style={{ marginTop: 12 }} onClick={() => window.location.href = '/'}>Back to TIALO</button></div> : <div style={{ display: 'grid', gap: 14, marginTop: 24 }}>{links.map(link => <article className="panel" key={link.id} style={{ padding: 20 }}><h3 style={{ marginTop: 0 }}>{link.profiles?.full_name || 'Parent / Guardian'}</h3><p className="muted">{link.profiles?.email || ''}</p><p style={{ lineHeight: 1.6 }}>If you accept, this parent will be able to view your subjects, completed daily tasks, study-time estimates and mock-exam results. They will <strong>not</strong> receive your private AI Tutor conversations.</p><div style={{ display: 'flex', gap: 10, marginTop: 18 }}><button className="btn primary" disabled={working} onClick={() => respond(link.id, true)}>Accept link</button><button className="btn secondary" disabled={working} onClick={() => respond(link.id, false)}>Decline</button></div></article>)}</div>}
    </section>
  </main>
}
