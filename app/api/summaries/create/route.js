import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

function supabaseClient(request) {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const auth = request.headers.get('authorization') || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : ''
  if (!rawUrl || !key || !token) return null

  try {
    const url = new URL(rawUrl.trim())
    if (!url.hostname.endsWith('.supabase.co')) return null

    return createClient(`${url.protocol}//${url.host}`, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })
  } catch {
    return null
  }
}

function sourceFromMaterial(material) {
  const pages = Array.isArray(material.page_text) ? material.page_text : []
  if (pages.length) {
    return pages
      .filter(page => page && Number(page.page) > 0 && String(page.text || '').trim())
      .map(page => `[SOURCE PAGE ${Number(page.page)}]\n${String(page.text).trim()}`)
      .join('\n\n')
  }
  return String(material.extracted_text || '').trim()
}

function parseJson(text) {
  const value = String(text || '').trim()
    .replace(/^\`\`\`json\s*/i, '')
    .replace(/^\`\`\`\s*/i, '')
    .replace(/\s*\`\`\`$/i, '')

  const start = value.indexOf('{')
  const end = value.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('Gemini returned no usable JSON summary.')
  return JSON.parse(value.slice(start, end + 1))
}

export async function POST(request) {
  try {
    const supabase = supabaseClient(request)
    if (!supabase) {
      return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
    }

    const authorization = request.headers.get('authorization') || ''
    const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    const { data: authData, error: authError } = await supabase.auth.getUser(token)

    if (authError || !authData?.user) {
      return NextResponse.json({ error: 'Your session is invalid or expired. Please log in again.' }, { status: 401 })
    }

    const body = await request.json()
    const subjectId = String(body.subjectId || '').trim()
    const materialIds = Array.isArray(body.materialIds)
      ? body.materialIds.map(String).map(value => value.trim()).filter(Boolean)
      : []
    const chapterRequest = String(body.chapterRequest || '').trim()
    const studyStyle = String(body.instruction || '').trim()
    const language = String(body.language || 'en').trim().toLowerCase()
    const rubricImage = typeof body.rubricImage === 'string' ? body.rubricImage : ''

    if (!subjectId || materialIds.length === 0 || (!chapterRequest && !rubricImage)) {
      return NextResponse.json({
        error: 'Choose a subject, at least one study document, and either a request or rubric photo.',
      }, { status: 400 })
    }

    const geminiKey = process.env.GEMINI_API_KEY
    if (!geminiKey) {
      return NextResponse.json({
        error: 'TIALO needs GEMINI_API_KEY in the Vercel Production environment.',
      }, { status: 503 })
    }

    const [{ data: subject, error: subjectError }, { data: materials, error: materialsError }, { data: profile }] = await Promise.all([
      supabase
        .from('subjects')
        .select('id,name')
        .eq('id', subjectId)
        .eq('user_id', authData.user.id)
        .maybeSingle(),
      supabase
        .from('materials')
        .select('id,subject_id,title,file_name,mime_type,processing_status,extracted_text,page_text')
        .eq('user_id', authData.user.id)
        .eq('subject_id', subjectId)
        .in('id', materialIds),
      supabase.from('profiles').select('language').eq('id', authData.user.id).maybeSingle(),
    ])

    if (subjectError) throw new Error(subjectError.message)
    if (materialsError) throw new Error(materialsError.message)
    if (!subject) return NextResponse.json({ error: 'That subject could not be found.' }, { status: 404 })

    const selectedMaterials = materialIds
      .map(id => materials?.find(material => material.id === id))
      .filter(Boolean)

    if (!selectedMaterials.length) {
      return NextResponse.json({ error: 'No selected study documents were found.' }, { status: 400 })
    }

    const selectedLanguage = profile?.language || language || 'en'
    const languageNames = { en:'English', af:'Afrikaans', zu:'isiZulu', xh:'isiXhosa', st:'Sesotho', tn:'Setswana', nso:'Sepedi', ts:'XiTsonga', ss:'siSwati', de:'German', fr:'French', es:'Spanish', pt:'Portuguese' }
    const outputLanguage = languageNames[selectedLanguage] || 'English'

    const documents = selectedMaterials.map(material => {
      const name = material.title || material.file_name || 'Study document'
      return [
        `DOCUMENT: ${name}`,
        `DOCUMENT_ID: ${material.id}`,
        sourceFromMaterial(material) || '[This document has no extracted text.]',
      ].join('\n')
    }).join('\n\n==============================\n\n')

    const studyBrief = [
      'You are TIALO, an academic study assistant for Grade 12 students.',
      '',
      'Your task is to create a study summary from the student\'s selected documents.',
      `Write the entire summary in ${outputLanguage}. Keep scientific names, formulas, symbols, and source references accurate. Do not translate a term if doing so would make the meaning scientifically incorrect.`,
      'Use ONLY information contained in the supplied documents and the teacher rubric image.',
      'Never invent facts, examples, page numbers, definitions, or references.',
      '',
      'STUDENT REQUEST:',
      chapterRequest || '[No typed request. Determine the required scope from the teacher rubric image.]',
      '',
      'OPTIONAL STUDY STYLE:',
      studyStyle || 'Clear, structured, exam-focused, and easy to revise.',
      '',
      'TEACHER RUBRIC:',
      rubricImage
        ? 'A teacher rubric image is attached after this instruction. Read it carefully. Treat its requirements as the study scope. Combine it with the student request when both are present.'
        : 'No rubric image was supplied.',
      '',
      'SOURCE-PAGE RULE:',
      'For every summary section, list only the exact source pages that directly support that section.',
      'Do not list a page simply because it is close to the relevant material.',
      'If a section is supported by multiple pages, list all directly supporting pages.',
      'If no exact source page supports a section, return an empty sourcePages list.',
      '',
      'OUTPUT RULE:',
      'Return ONLY valid JSON. Do not use markdown fences and do not add commentary.',
      '',
      'JSON FORMAT:',
      JSON.stringify({
        title: 'string',
        overview: 'string',
        sections: [
          {
            heading: 'string',
            summary: 'string',
            keyPoints: ['string'],
            sourcePages: [{ materialId: 'document id', page: 1 }],
          },
        ],
        importantTerms: [{ term: 'string', meaning: 'string' }],
      }),
      '',
      'QUALITY RULES:',
      'Explain the important ideas rather than copying large passages.',
      'Keep essential definitions, processes, comparisons, cause-and-effect relationships, formulas, and exam-relevant details.',
      'Organise the material into logical sections.',
      'Do not add outside knowledge just to make the summary longer.',
      '',
      'SELECTED DOCUMENTS:',
      documents,
    ].join('\n')

    const parts = [{ text: studyBrief }]

    if (rubricImage) {
      const match = rubricImage.match(/^data:(image\/[^;]+);base64,(.+)$/)
      if (match) {
        parts.push({
          inline_data: {
            mime_type: match[1],
            data: match[2],
          },
        })
      }
    }

    const model = process.env.GEMINI_SUMMARY_MODEL || 'gemini-3.5-flash-lite'

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiKey,
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
          },
        }),
      },
    )

    const geminiData = await geminiResponse.json().catch(() => ({}))

    if (!geminiResponse.ok) {
      console.error('TIALO Gemini summary request failed:', geminiData)
      return NextResponse.json({
        error: geminiData?.error?.message || `Gemini request failed with HTTP ${geminiResponse.status}.`,
      }, { status: 502 })
    }

    const generatedText = geminiData?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('')

    let summary
    try {
      summary = parseJson(generatedText)
    } catch (error) {
      console.error('TIALO Gemini summary JSON failure:', error)
      return NextResponse.json({
        error: 'Gemini responded, but TIALO could not read the summary format. Please try again.',
      }, { status: 502 })
    }

    const allowedMaterialIds = new Set(selectedMaterials.map(material => material.id))

    summary.sections = Array.isArray(summary.sections) ? summary.sections : []
    summary.sections = summary.sections.map(section => ({
      ...section,
      keyPoints: Array.isArray(section.keyPoints) ? section.keyPoints : [],
      sourcePages: (Array.isArray(section.sourcePages) ? section.sourcePages : [])
        .filter(reference =>
          allowedMaterialIds.has(reference?.materialId) &&
          Number.isInteger(Number(reference?.page)) &&
          Number(reference.page) > 0,
        )
        .map(reference => ({
          materialId: reference.materialId,
          page: Number(reference.page),
        })),
    }))

    summary.importantTerms = Array.isArray(summary.importantTerms) ? summary.importantTerms : []

    const title = String(summary.title || `${subject.name} study summary`).slice(0, 180)

    const { data: saved, error: saveError } = await supabase
      .from('summaries')
      .insert({
        user_id: authData.user.id,
        subject_id: subject.id,
        title,
        material_ids: selectedMaterials.map(material => material.id),
        chapter_request: chapterRequest || 'Based on uploaded teacher rubric',
        summary_json: summary,
      })
      .select('id,title,created_at')
      .single()

    if (saveError) throw new Error(saveError.message)

    return NextResponse.json({
      summary: {
        ...summary,
        id: saved.id,
        title: saved.title,
        createdAt: saved.created_at,
        subjectName: subject.name,
      },
      materials: selectedMaterials.map(material => ({
        id: material.id,
        title: material.title || material.file_name || 'Study document',
        mimeType: material.mime_type,
      })),
    })
  } catch (error) {
    console.error('TIALO summary creation failed:', error)
    return NextResponse.json({
      error: error?.message || 'Could not create the summary.',
    }, { status: 500 })
  }
}
