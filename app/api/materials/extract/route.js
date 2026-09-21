import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { definePDFJSModule, extractText, getDocumentProxy } from 'unpdf'

export const runtime = 'nodejs'
export const maxDuration = 60

let pdfjsReady
async function ensurePdfJs() {
  if (!pdfjsReady) pdfjsReady = definePDFJSModule(() => import('pdfjs-serverless'))
  await pdfjsReady
}

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return null

  try {
    const parsed = new URL(rawUrl.trim())
    if (parsed.hostname.endsWith('.supabase.co')) {
      return `${parsed.protocol}//${parsed.host}`
    }
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

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  return { client }
}

function cleanText(text) {
  return text.replace(/\u0000/g, '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim()
}

export async function POST(request) {
  const server = getServerSupabase(request)
  if (!server) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })
  const { client: supabase } = server

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error('Material extraction auth failed:', authError?.message || 'No user returned')
    return NextResponse.json({ error: 'Your session is invalid or expired. Please refresh the page and try again.' }, { status: 401 })
  }

  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  const materialId = body?.materialId
  if (!materialId) return NextResponse.json({ error: 'Material ID is required.' }, { status: 400 })

  const { data: material, error: materialError } = await supabase
    .from('materials')
    .select('id,user_id,file_name,mime_type,storage_path')
    .eq('id', materialId)
    .eq('user_id', user.id)
    .maybeSingle()
  if (materialError) return NextResponse.json({ error: materialError.message }, { status: 400 })
  if (!material) return NextResponse.json({ error: 'Material not found.' }, { status: 404 })
  if (material.mime_type !== 'application/pdf') return NextResponse.json({ error: 'PDF extraction is enabled first. DOCX and PPTX extraction will be added next.' }, { status: 400 })

  await supabase.from('materials').update({ processing_status: 'processing', processing_error: null }).eq('id', material.id).eq('user_id', user.id)

  try {
    const { data: file, error: downloadError } = await supabase.storage.from('study-materials').download(material.storage_path)
    if (downloadError || !file) throw new Error(downloadError?.message || 'Could not download the private material.')

    await ensurePdfJs()
    const pdf = await getDocumentProxy(new Uint8Array(await file.arrayBuffer()))
    const result = await extractText(pdf, { mergePages: false })
    const rawPages = Array.isArray(result.text) ? result.text : [result.text || '']
    const pageText = rawPages.map((text, index) => ({ page: index + 1, text: cleanText(text || '') })).filter(item => item.text)
    const extractedText = cleanText(pageText.map(item => item.text).join('\n\n'))
    if (!extractedText) throw new Error('No selectable text was found in this PDF. A scanned/image-only PDF will need OCR.')

    const { error: updateError } = await supabase.from('materials').update({
      extracted_text: extractedText,
      page_text: pageText,
      extracted_at: new Date().toISOString(),
      processing_status: 'ready',
      processing_error: null,
    }).eq('id', material.id).eq('user_id', user.id)
    if (updateError) throw new Error(updateError.message)

    return NextResponse.json({ ok: true, materialId: material.id, characters: extractedText.length, pages: result.totalPages || pageText.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Material extraction failed.'
    await supabase.from('materials').update({ processing_status: 'failed', processing_error: message }).eq('id', material.id).eq('user_id', user.id)
    return NextResponse.json({ error: message }, { status: 422 })
  }
}
