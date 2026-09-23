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
  } catch { return null }
}

function serverClient(request) {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!url || !key || !token) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
}

async function auth(request) {
  const supabase = serverClient(request)
  if (!supabase) return { error: NextResponse.json({ error: 'Authentication is required.' }, { status: 401 }) }
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: NextResponse.json({ error: 'Your session is invalid or expired. Please log in again.' }, { status: 401 }) }
  return { supabase, user }
}

function extractModelText(result) {
  const geminiText = result?.candidates?.[0]?.content?.parts?.map(item => item.text || '').join('').trim()
  if (geminiText) return geminiText
  if (typeof result?.output_text === 'string' && result.output_text.trim()) return result.output_text.trim()
  const pieces = []
  for (const item of result?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string' && content.text.trim()) pieces.push(content.text.trim())
    }
  }
  return pieces.join('\n').trim()
}

function parseJson(result) {
  const raw = extractModelText(result)
  if (!raw) return null
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidates = [raw, fenced?.[1]?.trim()]
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(raw.slice(firstBrace, lastBrace + 1))
  for (const candidate of candidates) {
    if (!candidate) continue
    try {
      const parsed = JSON.parse(candidate)
      if (Array.isArray(parsed?.tasks)) return parsed
    } catch {}
  }
  return null
}

async function generateTasks({ supabase, user, subjectId, taskDate }) {
  const { data: profile } = await supabase.from('profiles').select('language').eq('id', user.id).maybeSingle()
  const { data: subject, error: subjectError } = await supabase.from('subjects').select('id,name').eq('id', subjectId).eq('user_id', user.id).maybeSingle()
  if (subjectError) return NextResponse.json({ error: subjectError.message }, { status: 400 })
  if (!subject) return NextResponse.json({ error: 'Subject not found.' }, { status: 404 })

  const { data: materials, error: materialError } = await supabase.from('materials').select('title,file_name,extracted_text').eq('user_id', user.id).eq('subject_id', subjectId).eq('processing_status', 'ready').not('extracted_text', 'is', null)
  if (materialError) return NextResponse.json({ error: materialError.message }, { status: 400 })
  if (!materials?.length) return NextResponse.json({ error: 'This subject has no processed study material yet. Upload and read your material first.' }, { status: 400 })

  const context = materials.slice(0, 4).map(m => `${m.title || m.file_name || 'Study material'}\n${(m.extracted_text || '').slice(0, 12000)}`).join('\n\n')
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'The Daily Tasks AI is not connected yet. Add GEMINI_API_KEY to Vercel.' }, { status: 503 })

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      tasks: {
        type: 'array',
        minItems: 4,
        maxItems: 4,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            estimated_minutes: { type: 'integer', minimum: 15, maximum: 90 },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] },
          },
          required: ['title', 'description', 'estimated_minutes', 'priority'],
        },
      },
    },
    required: ['tasks'],
  }

  const language = outputLanguage(profile)
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_TUTOR_MODEL || 'gemini-3.5-flash-lite'}:generateContent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction:{parts:[{text:`You are TIALO's study planner. Write every task title and description entirely in ${language}. Use ONLY the supplied study material. Create exactly 4 useful study tasks for ${subject.name}. Do not invent topics or facts.\n\nSUPPLIED STUDY MATERIAL:\n${context}`}]},
      contents:[{role:'user',parts:[{text:`Create today's four study tasks for ${subject.name}.`}]}],
      generationConfig:{temperature:.2,responseMimeType:'application/json',responseSchema:{"type":"object","properties":{"tasks":{"type":"array","items":{"type":"object","properties":{"title":{"type":"string"},"description":{"type":"string"},"estimated_minutes":{"type":"integer"},"priority":{"type":"string","enum":["high","medium","low"]}},"required":["title","description","estimated_minutes","priority"]}}},"required":["tasks"]}
    }),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('Gemini Daily Tasks error:', result)
    return NextResponse.json({ error: result?.error?.message || 'Could not generate study tasks.' }, { status: 502 })
  }
  const data = parseJson(result)
  if (!data || data.tasks.length !== 4) {
    console.error('OpenAI Daily Tasks returned no parseable structured output:', JSON.stringify(result).slice(0, 4000))
    return NextResponse.json({ error: 'The AI returned an invalid study plan. Please try again.' }, { status: 502 })
  }

  await supabase.from('daily_study_tasks').delete().eq('user_id', user.id).eq('subject_id', subjectId).eq('task_date', taskDate).eq('completed', false)
  const rows = data.tasks.map(task => ({ user_id: user.id, subject_id: subjectId, title: String(task.title).slice(0, 180), description: String(task.description || '').slice(0, 500), task_date: taskDate, estimated_minutes: Math.min(Math.max(Number(task.estimated_minutes) || 30, 15), 90), priority: ['high','medium','low'].includes(task.priority) ? task.priority : 'medium' }))
  const { data: saved, error: saveError } = await supabase.from('daily_study_tasks').insert(rows).select('id,title,description,task_date,estimated_minutes,priority,completed,subject_id,created_at')
  if (saveError) return NextResponse.json({ error: saveError.message }, { status: 400 })
  return NextResponse.json({ tasks: saved || [] })
}

export async function GET(request) {
  const result = await auth(request); if (result.error) return result.error
  const { supabase, user } = result
  const date = new URL(request.url).searchParams.get('date') || new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase.from('daily_study_tasks').select('id,title,description,task_date,estimated_minutes,priority,completed,completed_at,subject_id,subjects(name),created_at').eq('user_id', user.id).eq('task_date', date).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ tasks: data || [] })
}

export async function POST(request) {
  const result = await auth(request); if (result.error) return result.error
  const { supabase, user } = result
  let body; try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const taskDate = body?.date || new Date().toISOString().slice(0, 10)
  if (body?.action === 'toggle') {
    const completed = Boolean(body.completed)
    const { data, error } = await supabase.from('daily_study_tasks').update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq('id', body.id).eq('user_id', user.id).select('id,completed,completed_at').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ task: data })
  }
  if (!body?.subjectId) return NextResponse.json({ error: 'Please choose a subject.' }, { status: 400 })
  return generateTasks({ supabase, user, subjectId: body.subjectId, taskDate })
}
