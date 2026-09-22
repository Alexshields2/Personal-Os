import { describe, expect, it } from 'vitest'
import { OLDER_MAN, pickVoice, scoreVoice } from './speech'
import type { VoiceLike } from './speech'

/**
 * There is no "older man" setting in the browser, so the voice is chosen and
 * then read lower and slower. What is worth testing is the choosing: the
 * wrong pick here is a woman's voice reading words written to yourself.
 */

const v = (name: string, lang: string): VoiceLike => ({ name, lang })

describe('choosing a voice', () => {
  it('takes a British man over an American woman, whatever the order', () => {
    const voices = [v('Samantha', 'en-US'), v('Daniel', 'en-GB'), v('Karen', 'en-AU')]
    expect(pickVoice(voices)?.name).toBe('Daniel')
    expect(pickVoice([...voices].reverse())?.name).toBe('Daniel')
  })

  it('never picks a voice it knows to be a woman', () => {
    expect(scoreVoice(v('Samantha', 'en-US'))).toBeLessThan(0)
    expect(scoreVoice(v('Microsoft Zira - English (United States)', 'en-US'))).toBeLessThan(0)
    // Nothing recognisable at all is better than the wrong voice: with no
    // match it picks none and the browser reads in its own, still lower and
    // slower than default.
    expect(pickVoice([v('Samantha', 'en-US'), v('Fiona', 'en-GB')])).toBeNull()
    expect(pickVoice([v('Voice 3', 'en-US')])).toBeNull()
  })

  it('stays in English', () => {
    expect(scoreVoice(v('Thomas', 'fr-FR'))).toBeLessThan(0)
    expect(pickVoice([v('Thomas', 'fr-FR'), v('Alex', 'en-US')])?.name).toBe('Alex')
  })

  it('prefers the accent the words are written in, then the better recording', () => {
    expect(scoreVoice(v('Daniel', 'en-GB'))).toBeGreaterThan(scoreVoice(v('Aaron', 'en-US')))
    expect(scoreVoice(v('Daniel (Enhanced)', 'en-GB'))).toBeGreaterThan(scoreVoice(v('Daniel', 'en-GB')))
  })

  it('uses the voice you picked, and falls back when it is gone', () => {
    const voices = [v('Daniel', 'en-GB'), v('Alex', 'en-US')]
    expect(pickVoice(voices, 'Alex')?.name).toBe('Alex')
    expect(pickVoice(voices, 'A voice that was uninstalled')?.name).toBe('Daniel')
    expect(pickVoice([], 'Alex')).toBeNull()
  })

  it('reads lower and slower than the default', () => {
    expect(OLDER_MAN.pitch).toBeLessThan(1)
    expect(OLDER_MAN.rate).toBeLessThan(1)
  })
})
