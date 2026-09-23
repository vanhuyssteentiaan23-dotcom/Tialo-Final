import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

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

export async function GET(request) {
  const supabase = getServerSupabase(request)
  if (!supabase) return NextResponse.json({ error: 'Authentication is required.' }, { status: 401 })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Your session is invalid or expired.' }, { status: 401 })

  const materialId = new URL(request.url).searchParams.get('materialId')
  if (!materialId) return NextResponse.json({ error: 'Material ID is required.' }, { status: 400 })

  const { data: material, error: materialError } = await supabase
    .from('materials')
    .select('id,user_id,file_name,mime_type,storage_path')
    .eq('id', materialId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (materialError) return NextResponse.json({ error: materialError.message }, { status: 400 })
  if (!material) return NextResponse.json({ error: 'Material not found.' }, { status: 404 })
  if (material.mime_type !== 'application/pdf') return NextResponse.json({ error: 'Only PDF source documents can be rendered here.' }, { status: 400 })

  const { data: file, error: downloadError } = await supabase.storage
    .from('study-materials')
    .download(material.storage_path)

  if (downloadError || !file) {
    console.error('TIALO source PDF download failed:', downloadError?.message || 'No file returned')
    return NextResponse.json({ error: 'Could not load the source PDF.' }, { status: 502 })
  }

  return new Response(file, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${(material.file_name || 'study-material.pdf').replace(/["\\\r\n]/g, '')}"`,
      'Cache-Control': 'private, max-age=300',
    },
  })
}
