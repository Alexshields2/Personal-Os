import { describe, expect, it } from 'vitest'
import { parseContact, splitHeadline } from './parseContact'

describe('splitHeadline', () => {
  it('splits on "at"', () => {
    expect(splitHeadline('CEO at Acme Group')).toEqual({ role: 'CEO', company: 'Acme Group' })
  })

  it('splits on "@"', () => {
    expect(splitHeadline('Founder @ Byrne Motors')).toEqual({
      role: 'Founder',
      company: 'Byrne Motors',
    })
  })

  it('splits on a comma only when the left side is a title', () => {
    expect(splitHeadline('Managing Director, Kavanagh Ltd')).toEqual({
      role: 'Managing Director',
      company: 'Kavanagh Ltd',
    })
  })

  it('does not read a location as role and company', () => {
    // "Dublin, Ireland" is a place, not a job — it belongs in neither field as
    // a role, and treating it as one is worse than leaving role empty.
    expect(splitHeadline('Dublin, Ireland').role).toBe('')
  })

  it('keeps a title with no company rather than inventing one', () => {
    expect(splitHeadline('Founder | Building something new')).toEqual({
      role: 'Founder Building something new',
      company: '',
    })
  })
})

describe('parseContact', () => {
  it('reads a LinkedIn profile screenshot', () => {
    const text = `
      Aoife Ní Mhurchú
      CEO at Kavanagh Group
      Dublin, County Dublin, Ireland
      500+ connections
      Message  Connect  More
    `
    expect(parseContact(text)).toEqual({
      name: 'Aoife Ní Mhurchú',
      role: 'CEO',
      company: 'Kavanagh Group',
    })
  })

  it('skips LinkedIn chrome above the name', () => {
    const text = `
      LinkedIn
      Home  My Network  Jobs
      1st
      Rory O'Brien
      Founder & CEO at Byrne Motors
    `
    const out = parseContact(text)
    expect(out.name).toBe("Rory O'Brien")
    expect(out.company).toBe('Byrne Motors')
  })

  it('returns a partial draft rather than guessing wildly', () => {
    const out = parseContact('Some Company Ltd\nWe do things')
    expect(out.name).toBe('')
  })

  it('survives empty and junk input', () => {
    expect(parseContact('')).toEqual({ name: '', role: '', company: '' })
    expect(parseContact('!!! ??? 123').name).toBe('')
  })

  it('does not mistake a job title for a person name', () => {
    const out = parseContact('Chief Executive Officer\nMary Doyle')
    expect(out.name).toBe('Mary Doyle')
  })
})
