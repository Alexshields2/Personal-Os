import { supabase } from './supabase'

/**
 * ElevenLabs, for the one passage that gets read every morning.
 *
 * The browser's own voices are free and instant but plainly synthetic. These
 * are neither: every play costs credits, so the audio is kept after the
 * first one and the same words in the same voice are never bought twice.
 * Nothing here holds a key — the request goes through this app's own
 * `/api/speak`, which adds it server-side.
 */

export interface ElevenVoice {
  id: string
  name: string
  description: string
}

/** Why the real voice could not be used, so the app can say which. */
export type ElevenFailure = 'no-key' | 'not-signed-in' | 'failed'
export type ElevenResult = 'played' | ElevenFailure

/**
 * A stable name for a clip. FNV-1a rather than a crypto hash: this names a
 * cache entry, it does not protect anything, and it runs without awaiting.
 */
export function clipKey(voiceId: string, text: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `${voiceId}:${hash.toString(36)}:${text.length}`
}

// ------------------------------------------------------------------- cache

const DB_NAME = 'personal-os-audio'
const STORE = 'clips'

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE)
      }
      request.onsuccess = () => resolve(request.result)
      // Private windows and blocked storage: the voice still works, it just
      // pays for every play.
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function readClip(key: string): Promise<Blob | null> {
  const db = await openDb()
  if (!db) return null
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null)
      request.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

async function writeClip(key: string, blob: Blob): Promise<void> {
  const db = await openDb()
  if (!db) return
  try {
    db.transaction(STORE, 'readwrite').objectStore(STORE).put(blob, key)
  } catch {
    /* Out of space or blocked — the clip is simply not kept. */
  }
}

// ----------------------------------------------------------------- playing

let current: HTMLAudioElement | null = null
let currentUrl = ''

export function stopEleven(): void {
  if (current) {
    current.pause()
    current = null
  }
  if (currentUrl) {
    URL.revokeObjectURL(currentUrl)
    currentUrl = ''
  }
}

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) return {}
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { authorization: `Bearer ${token}` } : {}
}

/** The account's voices, or why they can't be listed. */
export async function elevenVoices(): Promise<{ voices: ElevenVoice[]; failure?: ElevenFailure }> {
  try {
    const res = await fetch('/api/voices', { headers: await authHeader() })
    if (res.status === 503) return { voices: [], failure: 'no-key' }
    if (res.status === 401) return { voices: [], failure: 'not-signed-in' }
    if (!res.ok) return { voices: [], failure: 'failed' }
    const body = (await res.json()) as { voices?: ElevenVoice[] }
    return { voices: body.voices ?? [] }
  } catch {
    return { voices: [], failure: 'failed' }
  }
}

/**
 * Play `text` in an ElevenLabs voice, from the cache when it has been read
 * before. Anything that goes wrong is reported rather than thrown, because
 * every caller's answer is the same: fall back to the device's own voice.
 */
export async function playEleven(
  text: string,
  voiceId: string,
  onEnd: () => void,
): Promise<ElevenResult> {
  const words = text.trim()
  if (!words || !voiceId) return 'failed'
  stopEleven()

  const key = clipKey(voiceId, words)
  let clip = await readClip(key)

  if (!clip) {
    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(await authHeader()) },
        body: JSON.stringify({ text: words, voiceId }),
      })
      if (res.status === 503) return 'no-key'
      if (res.status === 401) return 'not-signed-in'
      if (!res.ok) return 'failed'
      clip = await res.blob()
      void writeClip(key, clip)
    } catch {
      return 'failed'
    }
  }

  try {
    currentUrl = URL.createObjectURL(clip)
    const audio = new Audio(currentUrl)
    current = audio
    audio.onended = () => {
      stopEleven()
      onEnd()
    }
    audio.onerror = () => {
      stopEleven()
      onEnd()
    }
    await audio.play()
    return 'played'
  } catch {
    stopEleven()
    return 'failed'
  }
}
