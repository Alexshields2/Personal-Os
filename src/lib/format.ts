const nf = new Intl.NumberFormat('en-IE')

export function num(n: number, dp = 0): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString('en-IE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: dp,
  })
}

export function int(n: number): string {
  return nf.format(Math.round(n))
}

/** Full euro amount with grouping — used where the exact figure matters. */
export function euro(n: number, dp = 0): string {
  const sign = n < 0 ? '-' : ''
  return `${sign}€${Math.abs(n).toLocaleString('en-IE', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  })}`
}

/** Compact euro for tiles and axis ticks: €4.2M, €18.5K. */
export function euroCompact(n: number): string {
  const a = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (a >= 1_000_000) return `${sign}€${trim(a / 1_000_000)}M`
  if (a >= 1_000) return `${sign}€${trim(a / 1_000)}K`
  return `${sign}€${Math.round(a)}`
}

export function compact(n: number): string {
  const a = Math.abs(n)
  const sign = n < 0 ? '-' : ''
  if (a >= 1_000_000) return `${sign}${trim(a / 1_000_000)}M`
  if (a >= 1_000) return `${sign}${trim(a / 1_000)}K`
  return `${sign}${Math.round(a)}`
}

function trim(v: number): string {
  const s = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)
  // Only trailing *decimal* zeros go — stripping them off "690" would print 69.
  if (!s.includes('.')) return s
  return s.replace(/0+$/, '').replace(/\.$/, '')
}

export function pct(v: number, total: number): number {
  if (total <= 0) return 0
  return Math.min(100, Math.max(0, (v / total) * 100))
}

export function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[^\d.-]/g, '')
  const v = Number.parseFloat(cleaned)
  return Number.isFinite(v) ? v : 0
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
}
