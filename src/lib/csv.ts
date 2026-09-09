/**
 * Minimal CSV reading, shared by the bank-statement and contact importers.
 *
 * Handles the one thing a naive split(',') gets wrong on real exports: quoted
 * fields containing commas, and doubled quotes inside them.
 */

export function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (c === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/**
 * Splits on newlines that are not inside a quoted field — a spreadsheet cell
 * can legitimately contain a line break, and cutting there shears the row.
 */
export function splitCsvRows(text: string): string[] {
  const rows: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') inQuotes = !inQuotes
    if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && text[i + 1] === '\n') i++
      if (cur.trim() !== '') rows.push(cur)
      cur = ''
    } else {
      cur += c
    }
  }
  if (cur.trim() !== '') rows.push(cur)
  return rows
}

/** Index of the first header matching any candidate, or -1. Case-insensitive. */
export function findColumn(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase().trim())
  for (const c of candidates) {
    const i = lower.indexOf(c.toLowerCase())
    if (i !== -1) return i
  }
  // fall back to a contains match, so "CEO / leader" is found by "ceo"
  for (const c of candidates) {
    const i = lower.findIndex((h) => h.includes(c.toLowerCase()))
    if (i !== -1) return i
  }
  return -1
}
