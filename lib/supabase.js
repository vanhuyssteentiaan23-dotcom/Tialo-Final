import { createClient } from '@supabase/supabase-js'

let client

function normalizeSupabaseUrl(rawUrl) {
  if (!rawUrl) return null

  try {
    const parsed = new URL(rawUrl.trim())

    // NEXT_PUBLIC_SUPABASE_URL must be the project root.
    // Defensively remove API paths if they were accidentally pasted into Vercel.
    if (parsed.hostname.endsWith('.supabase.co')) {
      return `${parsed.protocol}//${parsed.host}`
    }

    return null
  } catch {
    return null
  }
}

export function getSupabaseBrowserClient() {
  if (client) return client

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  const url = normalizeSupabaseUrl(rawUrl)

  if (!url || !key) return null

  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  })

  return client
}
