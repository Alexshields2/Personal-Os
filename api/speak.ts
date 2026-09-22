import { ELEVEN, MAX_CHARS, apiKey, json, signedIn } from './_shared'

/**
 * Reads a passage in an ElevenLabs voice.
 *
 * A thin pipe: the browser sends the words and a voice, this adds the key
 * and hands the audio straight back. The audio is streamed through rather
 * than buffered, so the voice starts before the whole file exists.
 */
export const config = { runtime: 'edge' }

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method-not-allowed' }, 405)

  const key = apiKey()
  // Not an error: the app is meant to work without this, in the device's own
  // voice. It says which, so the app can fall back quietly.
  if (!key) return json({ error: 'no-key' }, 503)
  if (!(await signedIn(request))) return json({ error: 'not-signed-in' }, 401)

  let text = ''
  let voiceId = ''
  try {
    const body = (await request.json()) as { text?: unknown; voiceId?: unknown }
    text = typeof body.text === 'string' ? body.text.trim() : ''
    voiceId = typeof body.voiceId === 'string' ? body.voiceId.trim() : ''
  } catch {
    return json({ error: 'bad-request' }, 400)
  }
  if (!text || !voiceId) return json({ error: 'bad-request' }, 400)
  if (text.length > MAX_CHARS) return json({ error: 'too-long', limit: MAX_CHARS }, 413)
  // Voice ids are opaque strings from ElevenLabs; anything else is someone
  // else's idea of a URL.
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(voiceId)) return json({ error: 'bad-voice' }, 400)

  const res = await fetch(
    `${ELEVEN}/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, use_speaker_boost: true },
      }),
    },
  )

  if (!res.ok) {
    // Quota, a deleted voice, a bad key: pass the reason back so the app can
    // say what happened instead of going quiet.
    const detail = await res.text().catch(() => '')
    return json({ error: 'elevenlabs', status: res.status, detail: detail.slice(0, 400) }, 502)
  }

  return new Response(res.body, {
    headers: { 'content-type': 'audio/mpeg', 'cache-control': 'no-store' },
  })
}
