import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

function supabaseForRequest(request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
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

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Your session is invalid or expired. Please log in again.' }, { status: 401 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'TIALO is missing its AI connection. Add OPENAI_API_KEY to the Vercel production environment.' }, { status: 503 })

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }

  const subjectId = body?.subjectId
  const materialIds = Array.isArray(body?.materialIds) ? body.materialIds.filter(Boolean).slice(0, 8) : []
  const chapterRequest = typeof body?.chapterRequest === 'string' ? body.chapterRequest.trim() : ''
  const extraInstruction = typeof body?.instruction === 'string' ? body.instruction.trim() : ''
  const rubricImage = typeof body?.rubricImage === 'string' && body.rubricImage.startsWith('data:image/') ? body.rubricImage : ''

  if (!subjectId || !materialIds.length || (!chapterRequest && !rubricImage)) {
    return NextResponse.json({ error: 'Choose a subject, at least one document, then tell TIALO what to summarise or upload a picture of the rubric.' }, { status: 400 })
  }
  if (rubricImage.length > 3_000_000) {
    return NextResponse.json({ error: 'That rubric image is too large. Please upload a clearer photo under 2 MB.' }, { status: 400 })
  }

  const [{ data: subject }, { data: materials, error: materialError }] = await Promise.all([
    supabase.from('subjects').select('id,name').eq('id', subjectId).eq('user_id', user.id).maybeSingle(),
    supabase.from('materials').select('id,title,file_name,mime_type,extracted_text,page_text,processing_status').eq('user_id', user.id).eq('subject_id', subjectId).in('id', materialIds),
  ])

  if (!subject) return NextResponse.json({ error: 'Subject not found.' }, { status: 404 })
  if (materialError) return NextResponse.json({ error: materialError.message }, { status: 400 })
  if (!materials?.length) return NextResponse.json({ error: 'No selected material was found in this subject.' }, { status: 404 })

  const source = materials.map((m, index) => {
    const pages = Array.isArray(m.page_text) ? m.page_text : []
    const pageBlock = pages.map(p => `PAGE ${p.page}\n${String(p.text || '').slice(0, 9000)}`).join('\n\n')
    return `DOCUMENT ${index + 1}: ${m.title || m.file_name || 'Study material'}\n${pageBlock || m.extracted_text || 'No extracted text available.'}`
  }).join('\n\n====================\n\n').slice(0, 110000)

  const prompt = `Create a student-friendly study summary from ONLY the supplied documents.

SUBJECT: ${subject.name}
WHAT THE STUDENT NEEDS SUMMARISED: ${chapterRequest || 'Use the uploaded rubric to determine exactly what the student needs to study.'}
EXTRA INSTRUCTION: ${extraInstruction || 'Make it clear, concise and useful for studying.'}

RUBRIC:
The student may have uploaded a picture of a teacher rubric. If a rubric image is attached, read it carefully and use it as the study scope. Treat the rubric as a guide to what must be covered, not as a source of factual content. If the rubric lists chapters, topics, concepts, definitions, diagrams or learning outcomes, make sure the summary addresses those items using the selected study documents.

CRITICAL VISUAL RULE:
Every summary section must identify the original document page(s) that are directly relevant to the concepts in that section. These page numbers will later be used to connect the summary back to the source material, so NEVER choose a page merely because it is nearby. Choose a page only when its text clearly supports the section. If no page directly supports a section, use an empty sourcePages array. Do not invent page numbers.

Return JSON only in this exact shape:
{
  "title": "short study title",
  "overview": "2-4 sentence overview",
  "sections": [
    {
      "heading": "topic heading",
      "summary": "clear explanation with key facts and definitions",
      "keyPoints": ["point 1", "point 2"],
      "sourcePages": [{"materialId":"exact id","page":1}]
    }
  ],
  "importantTerms": [{"term":"term","meaning":"meaning"}]
}

Use the supplied material wording and facts. Do not add outside facts. Keep sourcePages tightly connected to each section.

SUPPLIED MATERIAL:
${source}`

  const content = [{ type: 'input_text', text: prompt }]
  if (rubricImage) content.push({ type: 'input_image', image_url: rubricImage })

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_SUMMARY_MODEL || process.env.OPENAI_TUTOR_MODEL || 'gpt-5.6-luna',
      instructions: 'You are TIALO Summaries. Return valid JSON only. Accuracy and source-page relevance are more important than length.',
      input: [{ role: 'user', content }],
    }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('Summary AI error:', result)
    return NextResponse.json({ error: result?.error?.message || 'TIALO could not create the summary right now. Please try again.' }, { status: 502 })
  }

  let summary
  try { summary = cleanJson(result.output_text || '') } catch (error) {
    console.error('Summary JSON parse error:', error, result)
    return NextResponse.json({ error: 'TIALO received an unusable summary response. Please try again.' }, { status: 502 })
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
