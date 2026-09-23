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
  const raw = String(text || '').trim()
    .replace(/^\`\`\`json\s*/i, '')
    .replace(/^\`\`\`\s*/i, '')
    .replace(/\s*\`\`\`$/i, '')
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < start) throw new Error('The summary service returned an invalid result.')
  return JSON.parse(raw.slice(start, end + 1))
}

function materialSource(material) {
  const pages = Array.isArray(material.page_text) ? material.page_text : []
  if (pages.length) {
    return pages
      .filter(p => p && Number(p.page) > 0 && String(p.text || '').trim())
      .map(p => `[PAGE ${Number(p.page)}]\n${String(p.text).trim()}`)
      .join('\n\n')
  }
  return String(material.extracted_text || '').trim()
}

export async function POST(request) {
  try {
    const supabase = supabaseForRequest(request)
    if (!supabase) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })

    const authHeader = request.headers.get('authorization') || ''
    const accessToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken)
    if (authError || !user) {
      console.error('Summary auth failed:', authError?.message || 'No user returned')
      return NextResponse.json({ error: 'Your session is invalid or expired. Please log in again.' }, { status: 401 })
    }

    const body = await request.json()
    const subjectId = String(body.subjectId || '')
    const materialIds = Array.isArray(body.materialIds) ? body.materialIds.map(String).filter(Boolean) : []
    const chapterRequest = String(body.chapterRequest || '').trim()
    const instruction = String(body.instruction || '').trim()
    const rubricImage = typeof body.rubricImage === 'string' ? body.rubricImage : ''

    if (!subjectId || !materialIds.length || (!chapterRequest && !rubricImage)) {
      return NextResponse.json({ error: 'Choose a subject, at least one document, and a summary request or rubric photo.' }, { status: 400 })
    }

    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      return NextResponse.json({ error: 'TIALO needs GEMINI_API_KEY in the Vercel Production environment.' }, { status: 503 })
    }

    const [{ data: subject, error: subjectError }, { data: materials, error: materialsError }] = await Promise.all([
      supabase.from('subjects').select('id,name').eq('id', subjectId).eq('user_id', user.id).maybeSingle(),
      supabase.from('materials')
        .select('id,subject_id,title,file_name,mime_type,processing_status,extracted_text,page_text')
        .eq('user_id', user.id)
        .eq('subject_id', subjectId)
        .in('id', materialIds),
    ])

    if (subjectError) throw new Error(subjectError.message)
    if (materialsError) throw new Error(materialsError.message)
    if (!subject) return NextResponse.json({ error: 'That subject could not be found.' }, { status: 404 })
    if (!materials?.length) return NextResponse.json({ error: 'No selected study documents were found.' }, { status: 400 })

    const selected = materialIds.map(id => materials.find(m => m.id === id)).filter(Boolean)
    if (!selected.length) return NextResponse.json({ error: 'No selected study documents were found.' }, { status: 400 })

    const sourceText = selected.map(material => {
      const title = material.title || material.file_name || 'Study document'
      return `=== MATERIAL: ${title} | MATERIAL ID: ${material.id} ===\n${materialSource(material) || '[No extracted text available]'}`
    }).join('\n\n')

    const prompt = `You are TIALO's study-summary engine.

Create a clear Grade 12 study summary using ONLY the supplied study documents. Do not invent facts and do not use outside knowledge.

Student request:
${chapterRequest || '[No typed request; use the teacher rubric image attached.]'}

Optional study style:
${instruction || '[Use a clear, exam-focused style.]'}

IMPORTANT SOURCE-LINKING RULE:
Each section must include sourcePages containing ONLY pages that directly support the claims in that section. Do NOT choose a page merely because it is nearby. If no supplied page directly supports a section, use an empty sourcePages array.

If a teacher rubric image is attached, read it carefully and use it to determine the required scope. Combine the typed request and rubric when both are present.

Return ONLY valid JSON in exactly this shape:
{
  "title": "string",
  "overview": "string",
  "sections": [
    {
      "heading": "string",
      "summary": "string",
      "keyPoints": ["string"],
      "sourcePages": [{"materialId": "string", "page": 1}]
    }
  ],
  "importantTerms": [
    {"term": "string", "meaning": "string"}
  ]
}

Keep the summary useful for studying: explain important ideas in simple language, preserve essential definitions/processes, and avoid filler.

SUPPLIED STUDY DOCUMENTS:
${sourceText}`

    const parts = [{ text: prompt }]
    if (rubricImage) {
      const match = rubricImage.match(/^data:(image\/[^;]+);base64,(.+)$/)
      if (match) parts.push({ inline_data: { mime_type: match[1], data: match[2] } })
    }

    const model = process.env.GEMINI_SUMMARY_MODEL || 'gemini-2.5-flash-lite'
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
        }),
      }
    )

    const result = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error('Gemini summary error:', result)
      return NextResponse.json({ error: result?.error?.message || 'The Gemini summary service is unavailable right now.' }, { status: 502 })
    }

    let summary
    try {
      const responseText = result?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || ''
      summary = cleanJson(responseText)
    } catch (error) {
      console.error('Gemini summary JSON parse error:', error, result)
      return NextResponse.json({ error: 'TIALO received an unusable summary response. Please try again.' }, { status: 502 })
    }

    const allowed = new Set(selected.map(m => m.id))
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
      material_ids: selected.map(m => m.id),
      chapter_request: chapterRequest || 'Based on uploaded rubric',
      summary_json: summary,
    }).select('id,title,created_at').single()

    if (saveError) throw new Error(saveError.message)

    return NextResponse.json({
      summary: { ...summary, id: saved.id, title: saved.title, createdAt: saved.created_at, subjectName: subject.name },
      materials: selected.map(m => ({ id: m.id, title: m.title || m.file_name || 'Study document', mimeType: m.mime_type })),
    })
  } catch (error) {
    console.error('Summary request failed:', error)
    return NextResponse.json({ error: error?.message || 'Could not create the summary.' }, { status: 500 })
  }
}
