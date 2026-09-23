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

function getServerSupabase(request) {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const authorization = request.headers.get('authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!url || !key || !token) return null
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
}

const LANGUAGE_NAMES={en:'English',af:'Afrikaans',zu:'isiZulu',xh:'isiXhosa',st:'Sesotho',tn:'Setswana',nso:'Sepedi',ts:'XiTsonga',ss:'siSwati',de:'German',fr:'French',es:'Spanish',pt:'Portuguese'}
function outputLanguage(profile){return LANGUAGE_NAMES[profile?.language]||'English'}

const STOP_WORDS = new Set('the a an and or but is are was were be been being to of in on for from with without what why how when where which who does do did can could should would will this that these those it its as at by about into than then them they their you your i me my we our explain please give tell'.split(' '))

function termsFromQuestion(question) {
  return [...new Set((question.toLowerCase().match(/[a-z0-9]+/g) || []).filter(term => term.length > 2 && !STOP_WORDS.has(term)))]
}

function buildMaterialContext(materials, question = '') {
  const terms = termsFromQuestion(question)
  const candidates = []
  for (const material of materials) {
    const text = material.extracted_text || ''
    if (!text) continue
    const lower = text.toLowerCase()
    const chunkSize = 4500
    const overlap = 500
    for (let start = 0; start < text.length; start += chunkSize - overlap) {
      const chunk = text.slice(start, start + chunkSize)
      const chunkLower = lower.slice(start, start + chunk.length)
      let score = terms.length ? 0 : 1
      for (const term of terms) {
        const safe = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const matches = chunkLower.match(new RegExp(`\\b${safe}\\b`, 'g'))
        if (matches) score += Math.min(matches.length, 8)
      }
      if (score > 0) candidates.push({ score, text: chunk, title: material.title || material.file_name || 'Study material' })
      if (candidates.length > 80) break
    }
  }
  candidates.sort((a, b) => b.score - a.score)
  // Keep the prompt comfortably below the organization's TPM limit even for 20-question exams.
  return candidates.slice(0, 5).map((item, index) => `SOURCE ${index + 1} — ${item.title}\n${item.text}`).join('\n\n')
}

async function authenticate(request) {
  const supabase = getServerSupabase(request)
  if (!supabase) return { error: NextResponse.json({ error: 'Authentication is required.' }, { status: 401 }) }
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return { error: NextResponse.json({ error: 'Your session is invalid or expired. Please log in again.' }, { status: 401 }) }
  return { supabase, user }
}

function extractModelText(result) {
  if (typeof result?.output_text === 'string' && result.output_text.trim()) return result.output_text.trim()
  const pieces = []
  for (const item of result?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string' && content.text.trim()) pieces.push(content.text.trim())
    }
  }
  return pieces.join('\n').trim()
}

function parseExamData(result) {
  const raw = extractModelText(result)
  if (!raw) return null
  const candidates = [raw]
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) candidates.push(fenced[1].trim())
  const firstBrace = raw.indexOf('{')
  const lastBrace = raw.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(raw.slice(firstBrace, lastBrace + 1))
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate)
      if (parsed && Array.isArray(parsed.questions)) return parsed
    } catch {}
  }
  return null
}

async function generateExam({ supabase, user, subjectId, count }) {
  const { data: profile } = await supabase.from('profiles').select('language').eq('id', user.id).maybeSingle()
  const { data: subject, error: subjectError } = await supabase.from('subjects').select('id,name').eq('id', subjectId).eq('user_id', user.id).maybeSingle()
  if (subjectError) return NextResponse.json({ error: subjectError.message }, { status: 400 })
  if (!subject) return NextResponse.json({ error: 'Subject not found.' }, { status: 404 })

  const { data: materials, error: materialError } = await supabase.from('materials').select('id,title,file_name,extracted_text,processing_status').eq('user_id', user.id).eq('subject_id', subjectId).eq('processing_status', 'ready').not('extracted_text', 'is', null)
  if (materialError) return NextResponse.json({ error: materialError.message }, { status: 400 })
  if (!materials?.length) return NextResponse.json({ error: 'This subject has no processed study material yet. Upload and read your material first.' }, { status: 400 })

  const context = buildMaterialContext(materials)
  if (!context) return NextResponse.json({ error: 'I could not find enough extracted text to create an exam.' }, { status: 400 })

  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'The Mock Exam system is not connected yet. Add OPENAI_API_KEY to Vercel.' }, { status: 503 })

  const schema = {
    type: 'object', additionalProperties: false,
    properties: {
      title: { type: 'string' },
      questions: { type: 'array', minItems: count, maxItems: count, items: {
        type: 'object', additionalProperties: false,
        properties: {
          prompt: { type: 'string' },
          options: { type: 'array', minItems: 4, maxItems: 4, items: { type: 'string' } },
          correct_answer: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['prompt', 'options', 'correct_answer', 'explanation'],
      } },
    },
    required: ['title', 'questions'],
  }

  const language = outputLanguage(profile)
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: process.env.OPENAI_TUTOR_MODEL || 'gpt-5.6-luna',
      instructions: `You are TIALO Mock Exam Generator for ${subject.name}. Write the exam title, questions, options and explanations entirely in ${language}. Keep scientific terms, formulas and proper nouns accurate.  Create exactly ${count} Grade 12 multiple-choice questions using ONLY the supplied study-material sources. Every correct answer must be directly supported by the sources. Do not use outside knowledge. Do not invent facts, terminology, examples, page numbers, or citations. Each question must have exactly four distinct answer options. correct_answer must exactly match one of the four options. Make questions academically useful and varied in difficulty. The explanation must be supported by the same sources. Return only the requested structured data.\n\nSUPPLIED STUDY MATERIAL:\n${context}`,
      input: `Generate a ${count}-question mock exam for ${subject.name}.`,
      max_output_tokens: count * 350 + 1000,
      text: { format: { type: 'json_schema', name: 'mock_exam', strict: true, schema } },
    }),
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    console.error('OpenAI Mock Exam error:', result)
    return NextResponse.json({ error: result?.error?.message || 'The mock exam could not be generated right now.' }, { status: response.status === 429 ? 429 : 502 })
  }

  const examData = parseExamData(result)
  if (!examData) return NextResponse.json({ error: 'The AI returned an invalid exam format. Please try again.' }, { status: 502 })
  const questions = Array.isArray(examData.questions) ? examData.questions.slice(0, count) : []
  if (questions.length !== count) return NextResponse.json({ error: 'The AI did not generate the required number of questions. Please try again.' }, { status: 502 })
  for (const question of questions) {
    if (!question.prompt || !Array.isArray(question.options) || question.options.length !== 4 || !question.options.includes(question.correct_answer)) return NextResponse.json({ error: 'The generated exam failed validation. Please try again.' }, { status: 502 })
  }

  const { data: exam, error: examError } = await supabase.from('exam_attempts').insert({ user_id: user.id, subject_id: subject.id, title: examData.title || `${subject.name} Mock Exam`, question_count: count, total_marks: count, status: 'in_progress' }).select('id,title,question_count,total_marks,status,created_at').single()
  if (examError) return NextResponse.json({ error: examError.message }, { status: 400 })
  const rows = questions.map((question, index) => ({ exam_id: exam.id, position: index + 1, prompt: question.prompt, options: question.options, correct_answer: question.correct_answer, marks: 1, explanation: question.explanation || null }))
  const { data: savedQuestions, error: questionsError } = await supabase.from('exam_questions').insert(rows).select('id,position,prompt,options,marks')
  if (questionsError) { await supabase.from('exam_attempts').delete().eq('id', exam.id).eq('user_id', user.id); return NextResponse.json({ error: questionsError.message }, { status: 400 }) }
  return NextResponse.json({ exam, questions: savedQuestions })
}

async function submitExam({ supabase, user, examId, answers }) {
  if (!examId || !Array.isArray(answers)) return NextResponse.json({ error: 'Exam ID and answers are required.' }, { status: 400 })
  const { data: exam, error: examError } = await supabase.from('exam_attempts').select('id,user_id,question_count,total_marks,status,subject_id,title').eq('id', examId).eq('user_id', user.id).maybeSingle()
  if (examError) return NextResponse.json({ error: examError.message }, { status: 400 })
  if (!exam) return NextResponse.json({ error: 'Exam not found.' }, { status: 404 })
  if (exam.status === 'completed') return NextResponse.json({ error: 'This exam has already been submitted.' }, { status: 400 })
  const { data: questions, error: questionError } = await supabase.from('exam_questions').select('id,position,prompt,options,correct_answer,marks,explanation').eq('exam_id', exam.id).order('position', { ascending: true })
  if (questionError) return NextResponse.json({ error: questionError.message }, { status: 400 })
  const answerMap = new Map(answers.map(item => [Number(item.position), typeof item.answer === 'string' ? item.answer : '']))
  let score = 0
  const review = []
  for (const question of questions || []) {
    const answer = answerMap.get(question.position) || ''
    const correct = answer === question.correct_answer
    if (correct) score += question.marks || 1
    await supabase.from('exam_questions').update({ student_answer: answer || null }).eq('id', question.id)
    review.push({ id: question.id, position: question.position, prompt: question.prompt, options: question.options, student_answer: answer, correct_answer: question.correct_answer, correct, marks: question.marks, explanation: question.explanation })
  }
  const { error: updateError } = await supabase.from('exam_attempts').update({ score, status: 'completed', completed_at: new Date().toISOString() }).eq('id', exam.id).eq('user_id', user.id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
  return NextResponse.json({ exam: { ...exam, score, status: 'completed' }, review })
}

export async function GET(request) {
  const auth = await authenticate(request); if (auth.error) return auth.error
  const { supabase, user } = auth
  const { data, error } = await supabase.from('exam_attempts').select('id,title,subject_id,question_count,score,total_marks,status,created_at,completed_at,subjects(name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ exams: data || [] })
}

export async function POST(request) {
  const auth = await authenticate(request); if (auth.error) return auth.error
  const { supabase, user } = auth
  let body; try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  if (body?.action === 'submit') return submitExam({ supabase, user, examId: body.examId, answers: body.answers })
  const subjectId = body?.subjectId
  const count = Math.min(Math.max(Number(body?.count) || 10, 5), 20)
  if (!subjectId) return NextResponse.json({ error: 'Please choose a subject.' }, { status: 400 })
  return generateExam({ supabase, user, subjectId, count })
}
