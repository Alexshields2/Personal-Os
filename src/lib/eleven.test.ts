import { describe, expect, it } from 'vitest'
import { clipKey } from './eleven'

/**
 * Every play of a real voice costs credits, so the cache key is what keeps
 * the same words from being bought twice. It has to be stable across
 * reloads, and different whenever the words or the voice are.
 */
describe('the clip key', () => {
  const words = 'I train, I ship, I keep my word.'

  it('is the same for the same words in the same voice', () => {
    expect(clipKey('abc123', words)).toBe(clipKey('abc123', words))
  })

  it('changes with the voice', () => {
    expect(clipKey('abc123', words)).not.toBe(clipKey('xyz789', words))
  })

  it('changes with the words, including a single character', () => {
    expect(clipKey('abc123', words)).not.toBe(clipKey('abc123', `${words} `))
    expect(clipKey('abc123', 'a')).not.toBe(clipKey('abc123', 'b'))
  })

  it('stays short whatever it is given', () => {
    expect(clipKey('abc123', 'x'.repeat(5000)).length).toBeLessThan(40)
  })
})
