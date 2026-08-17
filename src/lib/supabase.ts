import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

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
