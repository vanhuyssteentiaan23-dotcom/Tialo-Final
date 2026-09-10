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
  const [error, setError] = useState('')
  const [savedUnder16, setSavedUnder16] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = getSupabaseBrowserClient()
      if (!supabase) {
        setError('Supabase is not configured.')
        setLoading(false)
        return
      }

      const { data: { user: currentUser } } = await supabase.auth.getUser()
      if (!currentUser) {
        window.location.href = '/login'
        return
      }

      setUser(currentUser)

      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name,date_of_birth,role')
        .eq('id', currentUser.id)
        .maybeSingle()

      if (profile?.full_name) setFullName(profile.full_name)
      if (profile?.date_of_birth) setDateOfBirth(profile.date_of_birth)

      if (profile?.date_of_birth && profile?.role) {
        const age = calculateAge(profile.date_of_birth)
        if (age >= 16) {
          window.location.href = '/dashboard'
          return
        }
      }

      setLoading(false)
    }

    load()
  }, [])

  const age = calculateAge(dateOfBirth)

  async function saveProfile(event) {
    event.preventDefault()
    setError('')

    if (!user) return
    if (!fullName.trim()) return setError('Please enter your full name.')
    if (!dateOfBirth) return setError('Please enter your date of birth.')
    if (age === null || age < 0 || age > 100) return setError('Please enter a valid date of birth.')

    setSaving(true)
    const supabase = getSupabaseBrowserClient()

    const role = age < 16 ? 'student' : 'student'

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        date_of_birth: dateOfBirth,
        role,
      })
      .eq('id', user.id)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    if (age < 16) {
      setSavedUnder16(true)
      setSaving(false)
      return
    }

    window.location.href = '/dashboard'
  }

  if (loading) {
    return <main className="shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>Loading TIALO…</main>
  }

  if (savedUnder16) {
    return (
      <main className="shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
        <section className="card" style={{ maxWidth: 620, width: '100%', padding: 36 }}>
          <div className="eyebrow">Parent / Guardian Required</div>
          <h1 style={{ fontSize: 40, margin: '16px 0 12px' }}>Your profile is saved.</h1>
          <p className="muted" style={{ lineHeight: 1.7 }}>
            Because you are under 16, TIALO requires a linked parent or guardian before you can access the student dashboard.
          </p>
          <p className="muted" style={{ lineHeight: 1.7 }}>
            The next step is for your parent or guardian to create their TIALO account and link your student profile.
          </p>
          <button className="btn" style={{ marginTop: 18 }} onClick={() => window.location.href = '/'}>Back to home</button>
        </section>
      </main>
    )
  }

  return (
    <main className="shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}>
      <section className="card" style={{ maxWidth: 620, width: '100%', padding: 36 }}>
        <div className="eyebrow">Step 1 of 1</div>
        <h1 style={{ fontSize: 40, margin: '16px 0 8px' }}>Set up your TIALO profile.</h1>
        <p className="muted" style={{ lineHeight: 1.7, marginBottom: 28 }}>
          Tell us your name and date of birth so TIALO can set up the correct student experience.
        </p>

        <form onSubmit={saveProfile}>
          <label className="field">
            <span>Full name</span>
            <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your full name" autoComplete="name" />
          </label>

          <label className="field" style={{ marginTop: 18 }}>
            <span>Date of birth</span>
            <input type="date" value={dateOfBirth} onChange={e => setDateOfBirth(e.target.value)} />
          </label>

          {age !== null && age >= 0 && age <= 100 && (
            <div className="card" style={{ marginTop: 18, padding: 16 }}>
              <strong>Age: {age}</strong>
              <p className="muted" style={{ margin: '6px 0 0' }}>
                {age < 16 ? 'A parent or guardian will need to be linked before dashboard access.' : 'You can use the full student dashboard.'}
              </p>
            </div>
          )}

          {error && <p style={{ marginTop: 18 }}>{error}</p>}

          <button className="btn" type="submit" disabled={saving} style={{ marginTop: 24, width: '100%' }}>
            {saving ? 'Saving…' : 'Continue to TIALO'}
          </button>
        </form>
      </section>
    </main>
  )
}
