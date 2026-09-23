import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return null
  try {
    const parsed = new URL(rawUrl.trim())
    if (!parsed.hostname.endsWith('.supabase.co')) return null
    return `${parsed.protocol}//${parsed.host}`
  } catch {
    return null
  }
}

function supabaseForRequest(request) {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!url || !key || !token) return null
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })
}

function cleanJson(text) {
  const raw = String(text || '').trim().replace(/^\`\`\`json\s*/i, '').replace(/^\`\`\`\s*/i, '').replace(/\s*\`\`\`$/i, '')
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('The summary service returned an invalid result.')
  return JSON.parse(raw.slice(start, end + 1))
}

export async function POST(request) {
  const supabase = supabaseForRequest(request)
  if (!supabase) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })

  const authHeader = request.headers.get('authorization') || ''
  const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
  if (authError || !user) {
    console.error('Summary auth failed:', authError?.message || 'No user returned')
    return NextResponse.json({ error: 'Your session is invalid or expired. Please log in again.' }, { status: 401 })
  }

  const geminiKey = process.env.GEMINI_API_KEY

  if (!geminiKey) {
    return NextResponse.json({ error: 'TIALO needs an AI provider key. Use the free Gemini API key in Vercel as GEMINI_API_KEY. TIALO will not call OpenAI for summaries.' }, { status: 503 })
  }

  let summary

  if (geminiKey) {
    const parts = [{ text: prompt }]
    if (rubricImage) {
      const match = rubricImage.match(/^data:(image\\/[^;]+);base64,(.+)$/)
      if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } })
    }

    const model = process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash-lite'
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      }),
    })

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('Gemini summary error:', result)
      return NextResponse.json({ error: result?.error?.message || 'The free AI summary service is unavailable right now. Please try again.' }, { status: 502 })
    }

    try {
      const text = result?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || ''
      summary = cleanJson(text)
    } catch (error) {
      console.error('Gemini summary JSON parse error:', error, result)
      return NextResponse.json({ error: 'TIALO received an unusable summary response. Please try again.' }, { status: 502 })
    }
  }

  const allowed = new Set(materials.map(m => m.id))
  for (const section of Array.isArray(summary.sections) ? summary.sections : []) {
    section.sourcePages = (Array.isArray(section.sourcePages) ? section.sourcePages : [])
      .filter(ref => allowed.has(ref?.materialId) && Number.isInteger(Number(ref?.page)) && Number(ref.page) > 0)
      .map(ref => ({ materialId: ref.materialId, page: Number(ref.page) }))
  }

  const title = String(summary.title || `${subject.name} summary`).slice(0, 180)
  const { data: saved, error: saveError } = await supabase.from('summaries').insert({
    user_id: user.id,
    subject_id: subject.id,
    title,
    material_ids: materials.map(m => m.id),
    chapter_request: chapterRequest || 'Based on uploaded rubric',
    summary_json: summary,
  }).select('id,title,created_at').single()

  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 400 })

  return NextResponse.json({ summary: { ...summary, id: saved.id, title: saved.title, createdAt: saved.created_at, subjectName: subject.name }, materials })
}
