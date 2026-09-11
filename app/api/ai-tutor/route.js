import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return null
  try {
    const parsed = new URL(rawUrl.trim())
    if (parsed.hostname.endsWith('.supabase.co')) return `${parsed.protocol}//${parsed.host}`
    return null
  } catch {
    return null
  }
}

function getServerSupabase(request) {
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

const STOP_WORDS = new Set('the a an and or but is are was were be been being to of in on for from with without what why how when where which who does do did can could should would will this that these those it its as at by about into than then them they their you your i me my we our explain please give tell'.split(' '))

function termsFromQuestion(question) {
  return [...new Set((question.toLowerCase().match(/[a-z0-9]+/g) || []).filter(term => term.length > 2 && !STOP_WORDS.has(term)))]
}

function buildMaterialContext(materials, question) {
  const terms = termsFromQuestion(question)
  const candidates = []

  for (const material of materials) {
    const text = material.extracted_text || ''
    if (!text) continue
    const lower = text.toLowerCase()
    const chunkSize = 7000
    const overlap = 900
    for (let start = 0; start < text.length; start += chunkSize - overlap) {
      const chunk = text.slice(start, start + chunkSize)
      const chunkLower = lower.slice(start, start + chunk.length)
      let score = 0
      for (const term of terms) {
        const matches = chunkLower.match(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')}\\b`, 'g'))
        if (matches) score += Math.min(matches.length, 8)
      }
      if (score > 0) candidates.push({ score, text: chunk, title: material.title || material.file_name || 'Study material' })
      if (candidates.length > 80) break
    }
  }

  candidates.sort((a, b) => b.score - a.score)
  const selected = candidates.slice(0, 8)
  if (!selected.length) return ''
  return selected.map((item, index) => `SOURCE ${index + 1} — ${item.title}\n${item.text}`).join('\n\n')
}

export async function POST(request) {
  const supabase = getServerSupabase(request)
  if (!supabase) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Your session is invalid or expired. Please log in again.' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'The AI Tutor is not connected yet. Add OPENAI_API_KEY to the Vercel environment variables.' }, { status: 503 })

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }

  const question = typeof body?.question === 'string' ? body.question.trim() : ''
  const subjectId = body?.subjectId
  const history = Array.isArray(body?.history) ? body.history.slice(-8) : []
  if (!question) return NextResponse.json({ error: 'Please enter a question.' }, { status: 400 })
  if (!subjectId) return NextResponse.json({ error: 'Please choose a subject.' }, { status: 400 })

  const { data: materials, error: materialError } = await supabase
    .from('materials')
    .select('id,title,file_name,extracted_text,processing_status')
    .eq('user_id', user.id)
    .eq('subject_id', subjectId)
    .eq('processing_status', 'ready')
    .not('extracted_text', 'is', null)

  if (materialError) return NextResponse.json({ error: materialError.message }, { status: 400 })
  if (!materials?.length) return NextResponse.json({ error: 'This subject has no processed study material yet. Upload and read a PDF first.' }, { status: 400 })

  const context = buildMaterialContext(materials, question)
  if (!context) return NextResponse.json({ answer: 'I could not find enough relevant information in your uploaded material to answer that confidently. Please ask about a topic covered in this subject material.' })

  const messages = history.filter(item => item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string').map(item => ({ role: item.role, content: item.content }))
  messages.push({ role: 'user', content: question })

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_TUTOR_MODEL || 'gpt-5.6-luna',
      instructions: `You are TIALO AI Tutor. Teach the student clearly and step by step. You MUST answer using only the supplied study-material sources. Do not use outside knowledge to fill gaps. If the sources do not support the answer, say so clearly. Do not invent facts, definitions, examples, page numbers, or citations. Prefer simple explanations, then a short example only when the source supports it. If the student asks for an exam-style explanation, keep it aligned to the supplied material.\n\nSUPPLIED STUDY MATERIAL:\n${context}`,
      input: messages,
    }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('OpenAI Tutor error:', result)
    return NextResponse.json({ error: result?.error?.message || 'The AI Tutor could not answer right now.' }, { status: 502 })
  }

  const answer = result.output_text || result.output?.flatMap(item => item.content || []).map(item => item.text || '').join('') || ''
  if (!answer.trim()) return NextResponse.json({ error: 'The AI Tutor returned an empty answer.' }, { status: 502 })

  return NextResponse.json({ answer })
}
