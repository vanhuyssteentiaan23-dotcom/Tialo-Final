import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

const PLAN_CODE = 'tialo_full'
const PLAN_AMOUNT_CENTS = 25000

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return null
  try {
    const parsed = new URL(rawUrl.trim())
    if (parsed.hostname.endsWith('.supabase.co')) return `${parsed.protocol}//${parsed.host}`
    return null
  } catch { return null }
}

function getUserClient(request) {
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

export async function POST(request) {
  const supabase = getUserClient(request)
  if (!supabase) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Your session is invalid or expired. Please log in again.' }, { status: 401 })

  const secretKey = process.env.YOCO_SECRET_KEY
  if (!secretKey) return NextResponse.json({ error: 'Yoco is not connected yet. Add YOCO_SECRET_KEY to Vercel.' }, { status: 503 })

  const origin = new URL(request.url).origin
  const reference = crypto.randomUUID()

  // Mark the billing record as pending. This does not touch any student data.
  const { data: existing } = await supabase
    .from('subscriptions')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.id) {
    await supabase.from('subscriptions').update({ plan_code: PLAN_CODE, status: 'pending' }).eq('id', existing.id)
  } else {
    const { error: insertError } = await supabase.from('subscriptions').insert({
      user_id: user.id,
      plan_code: PLAN_CODE,
      status: 'pending',
    })
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  const response = await fetch('https://payments.yoco.com/api/checkouts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': reference,
    },
    body: JSON.stringify({
      amount: PLAN_AMOUNT_CENTS,
      currency: 'ZAR',
      successUrl: `${origin}/billing/success?reference=${encodeURIComponent(reference)}`,
      cancelUrl: `${origin}/billing?payment=cancelled`,
      failureUrl: `${origin}/billing?payment=failed`,
      metadata: {
        user_id: user.id,
        plan_code: PLAN_CODE,
        reference,
      },
      lineItems: [{
        displayName: 'TIALO Full — 30 days access',
        description: 'TIALO AI Academic Coach access for 30 days',
        quantity: 1,
        pricingDetails: { price: PLAN_AMOUNT_CENTS },
      }],
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok || !data?.redirectUrl) {
    await supabase.from('subscriptions').update({ status: 'failed' }).eq('user_id', user.id)
    return NextResponse.json({ error: data?.message || 'Yoco could not create the payment checkout.' }, { status: 502 })
  }

  await supabase.from('subscriptions').update({
    yoco_checkout_id: data.id || null,
    status: 'pending',
  }).eq('user_id', user.id)

  return NextResponse.json({ redirectUrl: data.redirectUrl })
}
