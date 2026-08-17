/**
 * All dates are handled as local-time YYYY-MM-DD strings. Parsing goes through
 * `fromISO` (never `new Date(str)`, which reads bare dates as UTC and shifts the
 * day backwards for anyone west of Greenwich).
 */

export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function todayISO(): string {
  return toISO(new Date())
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

/** Whole days from `a` to `b`. Normalised to noon so DST can't shave one off. */
export function daysBetween(a: string, b: string): number {
  const A = fromISO(a)
  const B = fromISO(b)
  A.setHours(12, 0, 0, 0)
  B.setHours(12, 0, 0, 0)
  return Math.round((B.getTime() - A.getTime()) / 86_400_000)
}

/** Day 1 is the start date itself. Not clamped — callers decide. */
export function dayNumber(startDate: string, iso: string): number {
  return daysBetween(startDate, iso) + 1
}

export function isoForDay(startDate: string, day: number): string {
  return addDays(startDate, day - 1)
}

/** Monday-anchored week start, matching a Sunday review day. */
export function weekStartISO(iso: string): string {
  const d = fromISO(iso)
  const dow = d.getDay() // 0 Sun … 6 Sat
  const back = dow === 0 ? 6 : dow - 1
  return addDays(iso, -back)
}

export function isSunday(iso: string): boolean {
  return fromISO(iso).getDay() === 0
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

export function formatLong(iso: string): string {
  const d = fromISO(iso)
  return `${WEEKDAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]}`
}

export function formatShort(iso: string): string {
  const d = fromISO(iso)
  return `${d.getDate()} ${MONTH[d.getMonth()]}`
}

export function formatWithYear(iso: string): string {
  const d = fromISO(iso)
  return `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`
}

export function weekdayLetter(iso: string): string {
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][fromISO(iso).getDay()]
}
