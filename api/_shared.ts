/**
 * Shared bits for the two ElevenLabs routes.
 *
 * The key never goes near the browser. A key shipped in the bundle is a
 * public key — the app's sign-in wall is client-side, and the JavaScript
 * behind it is served to anyone who asks — so anybody could spend the
 * account's credits. It lives in the project's environment instead, and
 * these routes only answer to a request carrying a valid session for the
 * same Supabase project the app signs into.
 *
 * Files starting with an underscore are not routes.
 */

export const ELEVEN = 'https://api.elevenlabs.io/v1'

/** The longest passage worth reading in one go, and a cap on a runaway bill. */
export const MAX_CHARS = 2500

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  })
}

/** Vercel's Supabase integration names its variables NEXT_PUBLIC_*; ours are VITE_*. */
function firstSet(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]
    if (typeof value === 'string' && value.trim() !== '') return value
  }
  return ''
}

export function apiKey(): string {
  return firstSet('ELEVENLABS_API_KEY', 'ELEVEN_LABS_API_KEY')
}

/**
 * True when the request carries a session for this app's own Supabase
 * project. Asking Supabase rather than verifying the token here keeps the
 * signing secret out of this code entirely, and a revoked session stops
 * working immediately rather than at expiry.
 */
export async function signedIn(request: Request): Promise<boolean> {
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return false

  const url = firstSet('NEXT_PUBLIC_SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_URL')
  const anon = firstSet(
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
    'VITE_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
  )
  // With no backend configured there is no one to check against, and no
  // sign-in wall either — refuse rather than answer to anybody.
  if (!url || !anon) return false

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/user`, {
      headers: { apikey: anon, authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}
