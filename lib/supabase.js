import { createClient } from '@supabase/supabase-js'

let client

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return null
  try {
    const parsed = new URL(rawUrl.trim())
    if (parsed.hostname.endsWith('.supabase.co')) return `${parsed.protocol}//${parsed.host}`
    return null
  } catch { return null }
}

export function getSupabaseBrowserClient() {
  if (client) return client
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return null
  client = createClient(url, key, {
    auth: {
      flowType: 'implicit',
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })
  return client
}
