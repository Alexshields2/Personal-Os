import { describe, expect, it } from 'vitest'
import { contactKey, parseContactCsv } from './importContacts'

const SHEET = `Top Irish companies - CEO outreach
225 companies researched

Priority,Fit for 1Media / Consulting.ie,Company,Segment,Sector,CEO / leader,Title,Recent news hook,Outreach topic,LinkedIn
1,High,Byrne Motors,Automotive,Retail,Rory O'Brien,CEO,Opened a new site,Fleet electrification,https://linkedin.com/in/rory
2,Medium,"Kavanagh, Doyle & Co",Professional services,Legal,Aoife Ní Mhurchú,Managing Partner,,Brand refresh,
`

describe('parseContactCsv', () => {
  it('finds the header row beneath a title and blurb', () => {
    const out = parseContactCsv(SHEET)
    expect(out.error).toBeUndefined()
    expect(out.rows).toHaveLength(2)
  })

  it('maps the columns by name, not position', () => {
    const [first] = parseContactCsv(SHEET).rows
    expect(first).toMatchObject({
      name: "Rory O'Brien",
      role: 'CEO',
      company: 'Byrne Motors',
      priority: '1',
      segment: 'Automotive',
      handle: 'https://linkedin.com/in/rory',
    })
  })

  it('keeps a quoted company containing a comma intact', () => {
    expect(parseContactCsv(SHEET).rows[1].company).toBe('Kavanagh, Doyle & Co')
  })

  it('gathers the research columns into labelled notes', () => {
    const [first] = parseContactCsv(SHEET).rows
    expect(first.notes).toContain('Angle: Fleet electrification')
    expect(first.notes).toContain('Hook: Opened a new site')
    expect(first.notes).not.toContain('Angle: \n')
  })

  it('leaves empty research columns out of the notes entirely', () => {
    const [, second] = parseContactCsv(SHEET).rows
    expect(second.notes).not.toContain('Hook:')
    expect(second.notes).toContain('Angle: Brand refresh')
  })

  it('reports a file it cannot understand rather than importing nonsense', () => {
    expect(parseContactCsv('a,b,c\n1,2,3').error).toMatch(/header row/i)
    expect(parseContactCsv('').error).toBeDefined()
  })

  it('keys a contact on name and company together', () => {
    expect(contactKey(' Rory O’Brien ', 'Byrne Motors')).toBe(contactKey('rory o’brien', 'BYRNE MOTORS'))
    expect(contactKey('Rory', 'A')).not.toBe(contactKey('Rory', 'B'))
  })
})
