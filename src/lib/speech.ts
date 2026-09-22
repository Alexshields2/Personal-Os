/**
 * Reading the top of the day out loud.
 *
 * The browser's default voice is whatever the device picked first, which is
 * usually a bright American woman — wrong for words you wrote to yourself.
 * There is no "older man" setting in the Web Speech API, so this gets there
 * the only way available: choose the deepest male voice installed, then read
 * it lower and slower than default.
 *
 * Every device ships a different list, so this ranks what it finds rather
 * than naming one voice and hoping.
 */

/** Deeper and slower than default — the difference between reading and telling. */
export const OLDER_MAN = { pitch: 0.75, rate: 0.9 }

/** Male voices shipped by Apple, Google and Microsoft, roughly deepest first. */
const MALE_NAMES = [
  'daniel',
  'arthur',
  'oliver',
  'gordon',
  'google uk english male',
  'alex',
  'aaron',
  'fred',
  'reed',
  'rishi',
  'george',
  'guy',
  'ryan',
  'james',
  'tom',
  'male',
]

const FEMALE_NAMES = [
  'samantha',
  'zira',
  'hazel',
  'heera',
  'catherine',
  'linda',
  'eva',
  'karen',
  'moira',
  'tessa',
  'fiona',
  'serena',
  'kate',
  'martha',
  'female',
  'victoria',
  'allison',
  'ava',
  'susan',
  'zoe',
  'nicky',
]

/** Only what a voice list actually gives us, so this can be tested without a browser. */
export interface VoiceLike {
  name: string
  lang: string
  localService?: boolean
  default?: boolean
}

/**
 * Higher is better. English only; these are English words. Irish and British
 * voices come first because that is the accent the words are written in,
 * then anything else English. A name known to be a man's outranks
 * everything, and a name known to be a woman's is ruled out rather than
 * merely ranked down — better no match than the wrong voice.
 */
export function scoreVoice(voice: VoiceLike): number {
  const name = voice.name.toLowerCase()
  const lang = voice.lang.toLowerCase().replace('_', '-')
  if (!lang.startsWith('en')) return -1
  if (FEMALE_NAMES.some((f) => name.includes(f))) return -1

  let score = 0
  const male = MALE_NAMES.findIndex((m) => name.includes(m))
  if (male >= 0) score += 100 - male
  if (lang.startsWith('en-ie')) score += 40
  else if (lang.startsWith('en-gb')) score += 30
  else if (lang.startsWith('en-au')) score += 10
  // Apple's downloaded voices say so in the name and sound far better than
  // the compact one that ships in the box.
  if (name.includes('enhanced') || name.includes('premium')) score += 20
  return score
}

/**
 * The voice to read with: the one asked for by name if it is still
 * installed, otherwise the best-scoring one, otherwise nothing — in which
 * case the browser uses its own default and still reads the words out.
 */
export function pickVoice<T extends VoiceLike>(voices: T[], preferred = ''): T | null {
  if (preferred) {
    const asked = voices.find((v) => v.name === preferred)
    if (asked) return asked
  }
  let best: T | null = null
  let bestScore = 0
  for (const voice of voices) {
    const score = scoreVoice(voice)
    if (score > bestScore) {
      best = voice
      bestScore = score
    }
  }
  return best
}

/**
 * The installed voices, which load asynchronously on most browsers: the
 * first call often returns an empty list and a `voiceschanged` event follows.
 */
export function loadVoices(onReady: (voices: SpeechSynthesisVoice[]) => void): () => void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return () => {}
  const read = () => onReady(window.speechSynthesis.getVoices())
  read()
  window.speechSynthesis.addEventListener('voiceschanged', read)
  return () => window.speechSynthesis.removeEventListener('voiceschanged', read)
}

/** Read `text` aloud in the chosen voice. Returns false when nothing was said. */
export function speak(
  text: string,
  voices: SpeechSynthesisVoice[],
  preferred: string,
  onDone: () => void,
): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !text.trim()) return false
  window.speechSynthesis.cancel()
  const said = new SpeechSynthesisUtterance(text)
  const voice = pickVoice(voices, preferred)
  if (voice) {
    said.voice = voice
    said.lang = voice.lang
  }
  said.pitch = OLDER_MAN.pitch
  said.rate = OLDER_MAN.rate
  said.onend = onDone
  said.onerror = onDone
  window.speechSynthesis.speak(said)
  return true
}
