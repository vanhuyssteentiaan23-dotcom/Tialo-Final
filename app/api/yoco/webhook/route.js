import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return null
  try {
    const parsed = new URL(rawUrl.trim())
    if (parsed.hostname.endsWith('.supabase.co')) return `${parsed.protocol}//${parsed.host}`
    return null
  } catch { return null }
}

function serviceClient() {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

function timingSafeEqual(a, b) {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  if (left.length !== right.length) return false
  return crypto.timingSafeEqual(left, right)
}

function verifyWebhook(rawBody, headers, secret) {
  const webhookId = headers.get('webhook-id') || ''
  const timestamp = headers.get('webhook-timestamp') || ''
  const signatureHeader = headers.get('webhook-signature') || ''
  if (!webhookId || !timestamp || !signatureHeader || !secret) return false

  const timestampNumber = Number(timestamp)
  if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 180) return false

  const cleanSecret = secret.replace(/^whsec_/, '')
  let secretBytes
  try { secretBytes = Buffer.from(cleanSecret, 'base64') } catch { return false }
  if (!secretBytes.length) return false

  const signedContent = `${webhookId}.${timestamp}.${rawBody}`
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64')
  const candidates = signatureHeader.split(' ').map(part => part.replace(/^v1,/, '').trim()).filter(Boolean)
  return candidates.some(candidate => timingSafeEqual(candidate, expected))
}

function extractPayload(event) {
  return event?.payload || event?.data || event || {}
}

function extractMetadata(payload) {
  return payload?.metadata || payload?.checkout?.metadata || payload?.data?.metadata || {}
}

function addThirtyDays(baseDate) {
  const date = new Date(baseDate)
  date.setUTCDate(date.getUTCDate() + 30)
  return date
}

export async function POST(request) {
  const rawBody = await request.text()
  const webhookSecret = process.env.YOCO_WEBHOOK_SECRET
  if (!webhookSecret || !verifyWebhook(rawBody, request.headers, webhookSecret)) {
    return new NextResponse('Invalid webhook signature.', { status: 401 })
  }

  const supabase = serviceClient()
  if (!supabase) return new NextResponse('Billing server is not configured.', { status: 503 })

  let event
  try { event = JSON.parse(rawBody) } catch { return new NextResponse('Invalid JSON.', { status: 400 }) }

  const eventType = event?.type || event?.eventType || ''
  const payload = extractPayload(event)
  const metadata = extractMetadata(payload)
  const userId = metadata?.user_id
  const amount = Number(payload?.amount ?? payload?.amountInCents ?? payload?.payment?.amount ?? 0)
  const currency = String(payload?.currency ?? payload?.payment?.currency ?? 'ZAR').toUpperCase()
  const paymentId = payload?.id || payload?.paymentId || payload?.payment?.id || null
  const checkoutId = payload?.checkoutId || payload?.checkout_id || payload?.checkout?.id || metadata?.checkout_id || null

  if (!userId) return NextResponse.json({ received: true, ignored: 'missing user metadata' })

  if (eventType === 'payment.succeeded' || eventType === 'checkout.completed' || payload?.status === 'completed') {
    if (amount !== 25000 || currency !== 'ZAR') {
      return new NextResponse('Unexpected payment amount or currency.', { status: 400 })
    }

    const { data: current } = await supabase
      .from('subscriptions')
      .select('id,access_until')
      .eq('user_id', userId)
      .maybeSingle()

    const now = new Date()
    const currentExpiry = current?.access_until ? new Date(current.access_until) : null
    const base = currentExpiry && currentExpiry > now ? currentExpiry : now
    const accessUntil = addThirtyDays(base)

    const values = {
      plan_code: 'tialo_full',
      status: 'active',
      current_period_start: now.toISOString(),
      current_period_end: accessUntil.toISOString(),
      access_until: accessUntil.toISOString(),
      last_payment_at: now.toISOString(),
      yoco_checkout_id: checkoutId,
      yoco_payment_id: paymentId,
      cancel_at_period_end: false,
    }

    if (current?.id) {
      const { error } = await supabase.from('subscriptions').update(values).eq('id', current.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from('subscriptions').insert({ user_id: userId, ...values })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ received: true, activated: true })
  }

  if (eventType === 'payment.failed' || eventType === 'checkout.failed') {
    // A failed renewal must NEVER remove already-paid access.
    await supabase.from('subscriptions').update({ status: 'failed' }).eq('user_id', userId)
    return NextResponse.json({ received: true, activated: false })
  }

  if (eventType === 'refund.succeeded') {
    // Refunds are recorded by Yoco; TIALO does not delete academic data.
    return NextResponse.json({ received: true, refunded: true })
  }

  return NextResponse.json({ received: true, ignored: eventType || 'unknown event' })
}
