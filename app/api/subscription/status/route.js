import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return null
  try {
    const parsed = new URL(rawUrl.trim())
    if (parsed.hostname.endsWith('.supabase.co')) return `${parsed.protocol}//${parsed.host}`
    return null
  } catch { return null }
}

function getClient(request) {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!url || !key || !token) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

export async function GET(request) {
  const supabase = getClient(request)
  if (!supabase) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Your session is invalid or expired.' }, { status: 401 })

  const { data, error } = await supabase
    .from('subscriptions')
    .select('plan_code,status,current_period_start,current_period_end,access_until,last_payment_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const accessUntil = data?.access_until ? new Date(data.access_until) : null
  const active = Boolean(accessUntil && accessUntil > new Date() && data?.status === 'active')

  return NextResponse.json({
    plan: 'TIALO Full',
    priceZar: 250,
    status: active ? 'active' : (data?.status || 'inactive'),
    active,
    accessUntil: data?.access_until || null,
    lastPaymentAt: data?.last_payment_at || null,
  })
}
