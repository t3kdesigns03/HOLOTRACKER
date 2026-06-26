// src/lib/supabase/client.ts
// Browser-side Supabase client (singleton)
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Strip trailing slash — a trailing slash in the env var causes double-slash
  // URLs like /auth/v1//signup which Supabase rejects with "Invalid path".
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  return createBrowserClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
