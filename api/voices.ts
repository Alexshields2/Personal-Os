import { ELEVEN, apiKey, json, signedIn } from './_shared'

/**
 * The voices on the account, so the picker offers what is actually there —
 * including any voice cloned or added later, which a hard-coded list of ids
 * could never keep up with.
 */
export const config = { runtime: 'edge' }

interface ElevenVoice {
  voice_id?: string
  name?: string
  category?: string
  labels?: Record<string, string>
}

export default async function handler(request: Request): Promise<Response> {
  const key = apiKey()
  if (!key) return json({ error: 'no-key' }, 503)
  if (!(await signedIn(request))) return json({ error: 'not-signed-in' }, 401)

  const res = await fetch(`${ELEVEN}/voices`, { headers: { 'xi-api-key': key } })
  if (!res.ok) {
    return json({ error: 'elevenlabs', status: res.status }, 502)
  }

  const body = (await res.json()) as { voices?: ElevenVoice[] }
  const voices = (body.voices ?? [])
    .filter((v) => typeof v.voice_id === 'string' && typeof v.name === 'string')
    .map((v) => ({
      id: v.voice_id as string,
      name: v.name as string,
      // Age, gender and accent come through as labels; the picker shows them
      // because "Brian" says nothing about whether it is the voice you want.
      description: [v.labels?.age, v.labels?.gender, v.labels?.accent]
        .filter((l): l is string => typeof l === 'string' && l !== '')
        .join(' · '),
    }))

  return new Response(JSON.stringify({ voices }), {
    headers: {
      'content-type': 'application/json',
      // The list barely changes; a few minutes saves a round trip per open.
      'cache-control': 'private, max-age=300',
    },
  })
}
