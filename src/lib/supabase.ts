import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

// Accepts either naming: VITE_SUPABASE_* if it was set by hand, or
// NEXT_PUBLIC_SUPABASE_* if it came from Vercel's Supabase integration, which
// names its variables for Next.js regardless of what the project actually is.
// The key itself has two possible names too — Supabase renamed "anon key" to
// "publishable key" on newer projects, and the integration follows whichever
// naming the connected project actually uses.
const url = (import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL) as
  | string
  | undefined
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  import.meta.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) as string | undefined

/**
 * Null when the env vars aren't set, and every call site treats that as "run
 * local-only". The app has to stay fully usable with no backend configured —
 * a missing key should never be the difference between logging the day and not.
 *
 * The anon key is meant to be public; row-level security in schema.sql is what
 * keeps one user out of another's row.
 */
export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      })
    : null

export const syncConfigured = supabase !== null

export const TABLE = 'app_state'
