'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../../lib/supabase'

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) return null
  const today = new Date()
  const birth = new Date(`${dateOfBirth}T00:00:00`)
  let age = today.getFullYear() - birth.getFullYear()
  const month = today.getMonth() - birth.getMonth()
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export default function Onboarding() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)
  const [fullName, setFullName] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [accountType, setAccountType] = useState('student')
  const [error, setError] = useState('')
  const [savedUnder16, setSavedUnder16] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return }
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) { window.location.href = '/login'; return }
      setUser(currentUser)
      const { data: profile } = await supabase.from('profiles').select('full_name,date_of_birth,role').eq('id', currentUser.id).maybeSingle()
      if (profile?.full_name) setFullName(profile.full_name)
      if (profile?.date_of_birth) setDateOfBirth(profile.date_of_birth)
      if (profile?.role === 'parent') setAccountType('parent')
      if (profile?.full_name && profile?.date_of_birth && profile?.role) {
        const age = calculateAge(profile.date_of_birth)
        if (profile.role === 'parent' && age >= 18) { window.location.href = '/parent'; return }
        if (profile.role === 'student' && age >= 16) { window.location.href = '/dashboard'; return }
        if (profile.role === 'student' && age < 16) {
          const { data: activeLink } = await supabase.from('parent_child').select('id').eq('child_id', currentUser.id).eq('status', 'active').limit(1).maybeSingle()
          if (activeLink) { window.location.href = '/dashboard'; return }
          setSavedUnder16(true)
        }
      }
      setLoading(false)
    }
    load()
  }, [])

  const age = calculateAge(dateOfBirth)

  async function saveProfile(event) {
    event.preventDefault(); setError('')
    if (!user) return
    if (!fullName.trim()) return setError('Please enter your full name.')
    if (!dateOfBirth) return setError('Please enter your date of birth.')
    if (age === null || age < 0 || age > 100) return setError('Please enter a valid date of birth.')
    if (accountType === 'parent' && age < 18) return setError('A parent or guardian account must be 18 or older.')
    setSaving(true)
    const supabase = getSupabaseBrowserClient()
    const role = accountType === 'parent' ? 'parent' : 'student'
    const { error: updateError } = await supabase.from('profiles').update({ full_name: fullName.trim(), date_of_birth: dateOfBirth, role }).eq('id', user.id)
    if (updateError) { setError(updateError.message); setSaving(false); return }
    if (role === 'student' && age < 16) { setSavedUnder16(true); setSaving(false); return }
    window.location.href = role === 'parent' ? '/parent' : '/dashboard'
  }

  if (loading) return <main className="shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading TIALO…</main>

  if (savedUnder16) return <main className="shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}><section className="card" style={{ maxWidth: 620, width: '100%', padding: 36 }}><div className="eyebrow">Parent / Guardian Required</div><h1 style={{ fontSize: 40, margin: '16px 0 12px' }}>Your profile is saved.</h1><p className="muted" style={{ lineHeight: 1.7 }}>Because this student is under 16, a parent or guardian must be linked before student dashboard access is enabled.</p><p className="muted" style={{ lineHeight: 1.7 }}>Ask your parent or guardian to create a TIALO Parent account and send a link request using this student account’s email address.</p><button className="btn secondary" style={{ marginTop: 18 }} onClick={() => window.location.href = '/parent-link'}>Check parent link</button></section></main>

  return <main className="shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}><section className="card" style={{ maxWidth: 620, width: '100%', padding: 36 }}><div className="eyebrow">Stage 2 • Profile setup</div><h1 style={{ fontSize: 40, margin: '16px 0 8px' }}>Let’s set up your TIALO account.</h1><p className="muted" style={{ lineHeight: 1.7, marginBottom: 28 }}>Your answers determine which TIALO experience and access rules apply to your account.</p><form onSubmit={saveProfile}><div className="field"><span>Account type</span><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}><button type="button" className={accountType === 'student' ? 'btn primary' : 'btn secondary'} onClick={() => setAccountType('student')}>Student</button><button type="button" className={accountType === 'parent' ? 'btn primary' : 'btn secondary'} onClick={() => setAccountType('parent')}>Parent / Guardian</button></div></div><label className="field" style={{ marginTop: 18 }}><span>Full name</span><input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" required /></label><label className="field" style={{ marginTop: 18 }}><span>Date of birth</span><input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} required /></label>{age !== null && age >= 0 && age <= 100 && <div className="card" style={{ marginTop: 18, padding: 16 }}><strong>Age: {age}</strong><p className="muted" style={{ margin: '6px 0 0' }}>{accountType === 'parent' ? age < 18 ? 'Parent / Guardian accounts require an age of 18 or older.' : 'Parent / Guardian account ready.' : age < 16 ? 'A parent or guardian must be linked before student dashboard access.' : 'Student dashboard access is available.'}</p></div>}{error && <p style={{ marginTop: 18 }} role="alert">{error}</p>}<button className="btn primary" type="submit" disabled={saving} style={{ marginTop: 24, width: '100%' }}>{saving ? 'Saving profile…' : 'Save and continue'}</button></form></section></main>
}
