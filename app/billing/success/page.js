'use client'

import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '../../../lib/supabase'

export default function BillingSuccessPage() {
  const [message, setMessage] = useState('Confirming your payment…')

  useEffect(() => {
    let cancelled = false
    async function check() {
      const supabase = getSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { window.location.href = '/login'; return }
      for (let attempt = 0; attempt < 8 && !cancelled; attempt++) {
        const response = await fetch('/api/subscription/status', { headers: { Authorization: `Bearer ${session.access_token}` } })
        const data = await response.json().catch(() => ({}))
        if (data.active) {
          setMessage('Payment confirmed. Your TIALO access is active for 30 days.')
          return
        }
        await new Promise(resolve => setTimeout(resolve, 1500))
      }
      if (!cancelled) setMessage('Your payment was received by the payment page. We are still waiting for Yoco’s secure confirmation. Your data is safe; please refresh this page in a moment.')
    }
    check()
    return () => { cancelled = true }
  }, [])

  return <main className="shell" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24 }}><div className="panel" style={{ maxWidth: 620, textAlign: 'center' }}><div className="brand">TIA<span>LO</span></div><h1 style={{ fontSize: 42, margin: '24px 0 12px' }}>Payment received</h1><p style={{ color: '#9eabbc', lineHeight: 1.7 }}>{message}</p><div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24, flexWrap: 'wrap' }}><a className="btn primary" href="/dashboard">Go to dashboard</a><a className="btn secondary" href="/billing">View subscription</a></div></div></main>
}
