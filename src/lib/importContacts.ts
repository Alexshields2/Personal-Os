/**
 * Importing an outreach list from a spreadsheet export.
 *
 * Columns are matched by name rather than position, because a research
 * spreadsheet gets columns inserted into it constantly and position-based
 * mapping would silently import the wrong field the first time that happened.
 *
 * Nothing here knows about any particular list — the data lives on your
 * machine and is never part of the app.
 */

import { findColumn, splitCsvLine, splitCsvRows } from './csv'

export interface ContactImportRow {
  name: string
  role: string
  company: string
  handle: string
  priority: string
  segment: string
  notes: string
}

export interface ContactImportResult {
  rows: ContactImportRow[]
  skipped: number
  error?: string
}

const NAME_COLS = ['ceo / leader', 'ceo', 'leader', 'name', 'contact', 'full name']
const COMPANY_COLS = ['company', 'organisation', 'organization', 'account', 'business']
const ROLE_COLS = ['title', 'role', 'position', 'job title']
const LINKEDIN_COLS = ['linkedin', 'profile', 'url', 'link']
const PRIORITY_COLS = ['priority', 'tier', 'rank']
const SEGMENT_COLS = ['segment', 'sector', 'industry', 'category']

/** Columns worth carrying into the notes, in the order they read best. */
const NOTE_COLS = [
  ['outreach topic', 'Angle'],
  ['recent news hook', 'Hook'],
  ['route in / caution', 'Route in'],
  ['fit for', 'Fit'],
  ['about the ceo', 'About them'],
  ['about the company', 'About the company'],
] as const

export function parseContactCsv(text: string): ContactImportResult {
  const lines = splitCsvRows(text)
  if (lines.length < 2) return { rows: [], skipped: 0, error: 'Nothing to import.' }

  // Export files often carry a title and a blurb above the real header, so
  // find the row that actually names the columns rather than assuming row one.
  let headerIdx = 0
  let headers: string[] = []
  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const cells = splitCsvLine(lines[i])
    if (findColumn(cells, COMPANY_COLS) !== -1 && findColumn(cells, NAME_COLS) !== -1) {
      headerIdx = i
      headers = cells
      break
    }
  }
  if (headers.length === 0) {
    return {
      rows: [],
      skipped: 0,
      error: "Couldn't find a header row with a company and a name column.",
    }
  }

  const idx = {
    name: findColumn(headers, NAME_COLS),
    company: findColumn(headers, COMPANY_COLS),
    role: findColumn(headers, ROLE_COLS),
    handle: findColumn(headers, LINKEDIN_COLS),
    priority: findColumn(headers, PRIORITY_COLS),
    segment: findColumn(headers, SEGMENT_COLS),
  }

  const noteIdx = NOTE_COLS.map(([col, label]) => ({ i: findColumn(headers, [col]), label })).filter(
    (n) => n.i !== -1,
  )

  const at = (cells: string[], i: number) => (i === -1 ? '' : (cells[i] ?? '').trim())

  const rows: ContactImportRow[] = []
  let skipped = 0

  for (const line of lines.slice(headerIdx + 1)) {
    const cells = splitCsvLine(line)
    const name = at(cells, idx.name)
    const company = at(cells, idx.company)
    // A row with neither is a spacer or a totals line, not a person.
    if (!name && !company) {
      skipped++
      continue
    }

    const notes = noteIdx
      .map(({ i, label }) => {
        const v = at(cells, i)
        return v ? `${label}: ${v}` : ''
      })
      .filter(Boolean)
      .join('\n')

    rows.push({
      name,
      company,
      role: at(cells, idx.role),
      handle: at(cells, idx.handle),
      priority: at(cells, idx.priority),
      segment: at(cells, idx.segment),
      notes,
    })
  }

  return { rows, skipped }
}

/** Same person, same company — the key used to avoid importing twice. */
export function contactKey(name: string, company: string): string {
  return `${name.trim().toLowerCase()}|${company.trim().toLowerCase()}`
}
