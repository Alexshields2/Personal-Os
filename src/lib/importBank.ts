/**
 * Bank CSV import.
 *
 * CSV rather than PDF, on purpose. Revolut, AIB and Rev all offer a CSV
 * export, and a CSV is a table already — parsing one is a column lookup.
 * Parsing a PDF means fighting a page layout that was designed to be printed,
 * not read, and getting it wrong silently is worse than not importing at all.
 *
 * The date and amount columns are found by name, case-insensitively, from a
 * short list of headers each bank actually uses — nobody should have to know
 * which bank calls it "Started Date" and which calls it "Date".
 */

const DATE_HEADERS = ['date', 'started date', 'completed date', 'transaction date']
const DESC_HEADERS = ['description', 'reference', 'name / description', 'merchant', 'details']
const AMOUNT_HEADERS = ['amount', 'transaction amount']
// Split money-out / money-in columns, as Revolut's statement export uses.
const OUT_HEADERS = ['money out', 'paid out', 'debit']
const IN_HEADERS = ['money in', 'paid in', 'credit']

export interface ParsedRow {
  date: string
  description: string
  amount: number
}

export interface ImportResult {
  rows: ParsedRow[]
  skipped: number
  error?: string
}

function splitCsvLine(line: string): string[] {
  // Minimal CSV: handles quoted fields with commas inside, which is the one
  // thing a naive split(',') gets wrong on a real bank export.
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

function findColumn(headers: string[], candidates: string[]): number {
  const lower = headers.map((h) => h.toLowerCase())
  for (const c of candidates) {
    const i = lower.indexOf(c)
    if (i !== -1) return i
  }
  return -1
}

/** Accepts a few common shapes: DD/MM/YYYY, YYYY-MM-DD, "20 Dec 2025". */
function parseDate(raw: string): string | null {
  const s = raw.trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`

  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`

  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', sept: '09', oct: '10', nov: '11', dec: '12',
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/)
  if (m) {
    const mon = months[m[2].slice(0, 4).toLowerCase()] ?? months[m[2].slice(0, 3).toLowerCase()]
    if (mon) return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`
  }
  return null
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[€£$,\s]/g, '').replace(/^\((.*)\)$/, '-$1')
  if (cleaned === '') return null
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

export function parseBankCsv(text: string): ImportResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '')
  if (lines.length < 2) return { rows: [], skipped: 0, error: 'Nothing to import.' }

  const headers = splitCsvLine(lines[0])
  const dateCol = findColumn(headers, DATE_HEADERS)
  const descCol = findColumn(headers, DESC_HEADERS)
  const amountCol = findColumn(headers, AMOUNT_HEADERS)
  const outCol = findColumn(headers, OUT_HEADERS)
  const inCol = findColumn(headers, IN_HEADERS)

  if (dateCol === -1) {
    return { rows: [], skipped: 0, error: "Couldn't find a date column. Check the first row is a header." }
  }
  if (amountCol === -1 && outCol === -1 && inCol === -1) {
    return { rows: [], skipped: 0, error: "Couldn't find an amount column." }
  }

  const rows: ParsedRow[] = []
  let skipped = 0

  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line)
    const date = parseDate(cells[dateCol] ?? '')
    const description = descCol !== -1 ? cells[descCol] : ''

    let amount: number | null = null
    if (amountCol !== -1) {
      amount = parseAmount(cells[amountCol] ?? '')
    } else {
      const out = parseAmount(cells[outCol] ?? '')
      const inn = parseAmount(cells[inCol] ?? '')
      if (inn !== null && inn !== 0) amount = inn
      else if (out !== null && out !== 0) amount = -Math.abs(out)
    }

    if (!date || amount === null || amount === 0) {
      skipped++
      continue
    }
    rows.push({ date, description: description || '(no description)', amount })
  }

  return { rows, skipped }
}
