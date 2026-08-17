import {
  CHECKLIST,
  CLEAN_IDS,
  COMPOUNDING,
  PILLARS,
  PROTOCOL_DAYS,
} from './config'
import type { ChecklistItem, PillarId } from './config'
import { addDays, dayNumber, fromISO, isoForDay, todayISO, weekStartISO } from './date'
import type { AccountId, AppState, DayEntry, MoneyEntity } from './types'

// ---------------------------------------------------------------------------
// Daily scoring

/**
 * Whether a checklist item counts as done. Metric-backed items are derived from
 * the logged number rather than a separate tick, so the score can never
 * disagree with the data. Two items accept a scheduled recovery day in place of
 * the number — that's the protocol's own rule, not a loophole.
 */
export function isItemDone(item: ChecklistItem, day: DayEntry, targets: AppState['targets']) {
  if (item.id === 'acmr_hours') {
    return day.restDay || day.metrics.acmrHours >= targets.acmrHours
  }
  if (item.id === 'training') return day.trained || day.restDay
  if (item.metric) {
    const value = day.metrics[item.metric]
    const target = targets[item.metric as keyof typeof targets] as number
    if (item.invert) return value <= target
    return value > 0 && value >= target
  }
  return Boolean(day.checks[item.id])
}

export interface PillarScore {
  id: PillarId
  label: string
  earned: number
  possible: number
}

export interface DayScore {
  score: number
  pillars: PillarScore[]
  done: number
  total: number
  clean: boolean
  won: boolean
}

export function scoreDay(day: DayEntry, targets: AppState['targets']): DayScore {
  const pillars: PillarScore[] = PILLARS.map((p) => ({
    id: p.id,
    label: p.label,
    earned: 0,
    possible: p.points,
  }))
  const byId = new Map(pillars.map((p) => [p.id, p]))
  let done = 0

  for (const item of CHECKLIST) {
    if (isItemDone(item, day, targets)) {
      byId.get(item.pillar)!.earned += item.points
      done++
    }
  }

  const score = pillars.reduce((s, p) => s + p.earned, 0)
  const clean = CLEAN_IDS.every((id) => day.checks[id])
  return { score, pillars, done, total: CHECKLIST.length, clean, won: score >= 80 }
}

/** An untouched day scores 0 but shouldn't be graded as a loss until logged. */
export function isLogged(day: DayEntry | undefined): day is DayEntry {
  if (!day) return false
  if (day.closed || day.trained || day.restDay) return true
  if (Object.values(day.checks).some(Boolean)) return true
  return Object.values(day.metrics).some((v) => v > 0)
}

// ---------------------------------------------------------------------------
// Protocol timeline

export interface Timeline {
  /** 1-based, clamped into the protocol window. */
  day: number
  /** Unclamped — negative before the start, > 126 after the finish. */
  rawDay: number
  remaining: number
  elapsedPct: number
  started: boolean
  finished: boolean
  endDate: string
}

export function timeline(state: AppState, iso = todayISO()): Timeline {
  const raw = dayNumber(state.startDate, iso)
  const day = Math.min(PROTOCOL_DAYS, Math.max(1, raw))
  return {
    day,
    rawDay: raw,
    remaining: Math.max(0, PROTOCOL_DAYS - day),
    elapsedPct: (day / PROTOCOL_DAYS) * 100,
    started: raw >= 1,
    finished: raw > PROTOCOL_DAYS,
    endDate: isoForDay(state.startDate, PROTOCOL_DAYS),
  }
}

/** Every protocol date in order, whether or not it has an entry. */
export function protocolDates(state: AppState): string[] {
  return Array.from({ length: PROTOCOL_DAYS }, (_, i) => isoForDay(state.startDate, i + 1))
}

export interface DayCell {
  date: string
  day: number
  score: number
  logged: boolean
  future: boolean
}

export function dayCells(state: AppState, iso = todayISO()): DayCell[] {
  const todayNum = dayNumber(state.startDate, iso)
  return protocolDates(state).map((date, i) => {
    const entry = state.days[date]
    const logged = isLogged(entry)
    return {
      date,
      day: i + 1,
      score: logged ? scoreDay(entry, state.targets).score : 0,
      logged,
      future: i + 1 > todayNum,
    }
  })
}

/** Consecutive logged days ending today (or yesterday, if today isn't in yet). */
export function currentStreak(state: AppState, iso = todayISO()): number {
  let streak = 0
  let cursor = iso
  if (!isLogged(state.days[cursor])) cursor = addDays(cursor, -1)
  for (let i = 0; i < PROTOCOL_DAYS + 1; i++) {
    const entry = state.days[cursor]
    if (!isLogged(entry)) break
    if (scoreDay(entry, state.targets).score < 80) break
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

export function loggedDays(state: AppState): DayEntry[] {
  const set = new Set(protocolDates(state))
  return Object.values(state.days).filter((d) => set.has(d.date) && isLogged(d))
}

export function averageScore(state: AppState): number {
  const days = loggedDays(state)
  if (!days.length) return 0
  return days.reduce((s, d) => s + scoreDay(d, state.targets).score, 0) / days.length
}

// ---------------------------------------------------------------------------
// Compounding totals

export interface CompoundResult {
  id: string
  label: string
  unit: string
  value: number
  target: number
  pct: number
  invert: boolean
  note?: string
  /** Where the total should be by now if every day had hit target. */
  pace: number
}

export function compounding(state: AppState, iso = todayISO()): CompoundResult[] {
  const days = loggedDays(state)
  const elapsed = Math.min(PROTOCOL_DAYS, Math.max(0, dayNumber(state.startDate, iso)))

  return COMPOUNDING.map((spec) => {
    let value = 0
    switch (spec.source.type) {
      case 'metric': {
        const scale = spec.source.scale ?? 1
        const key = spec.source.key
        value = days.reduce((s, d) => s + d.metrics[key], 0) * scale
        break
      }
      case 'workouts':
        value = days.filter((d) => d.trained).length
        break
      case 'weekends':
        value = protectedWeekends(state, iso)
        break
      case 'cleanDays':
        value = days.filter((d) => CLEAN_IDS.every((id) => d.checks[id])).length
        break
    }
    const invert = Boolean(spec.invert)
    const pct = spec.target > 0 ? (value / spec.target) * 100 : 0
    return {
      id: spec.id,
      label: spec.label,
      unit: spec.unit,
      value,
      target: spec.target,
      pct: Math.max(0, Math.min(100, pct)),
      invert,
      note: spec.note,
      pace: (spec.target / PROTOCOL_DAYS) * elapsed,
    }
  })
}

/** A weekend counts as protected when both Sat and Sun stayed disappeared. */
function protectedWeekends(state: AppState, iso: string): number {
  const todayNum = dayNumber(state.startDate, iso)
  let count = 0
  // Walk the Saturdays inside the window; both weekend days must hold.
  for (const date of protocolDates(state)) {
    if (dayNumber(state.startDate, date) > todayNum) break
    if (fromISO(date).getDay() !== 6) continue
    const sat = state.days[date]
    const sun = state.days[addDays(date, 1)]
    const held = (e?: DayEntry) => Boolean(e && e.checks['disappeared'] && e.checks['no_alcohol'])
    if (held(sat) && held(sun)) count++
  }
  return count
}

// ---------------------------------------------------------------------------
// Money

export interface EntityTotals {
  revenue: number
  cashCollected: number
  profit: number
  expense: number
  payout: number
}

const ZERO_TOTALS: EntityTotals = {
  revenue: 0,
  cashCollected: 0,
  profit: 0,
  expense: 0,
  payout: 0,
}

export function entityTotals(state: AppState, entity: MoneyEntity): EntityTotals {
  const out = { ...ZERO_TOTALS }
  for (const e of state.ledger) {
    if (e.entity !== entity) continue
    out[e.kind] += e.amount
  }
  return out
}

export function allEntityTotals(state: AppState): EntityTotals {
  const a = entityTotals(state, 'acmr')
  const b = entityTotals(state, 'onemedia')
  return {
    revenue: a.revenue + b.revenue,
    cashCollected: a.cashCollected + b.cashCollected,
    profit: a.profit + b.profit,
    expense: a.expense + b.expense,
    payout: a.payout + b.payout,
  }
}

/** Most recent snapshot for an account, or 0 if never recorded. */
export function accountBalance(state: AppState, account: AccountId): number {
  let best: { date: string; amount: number } | undefined
  for (const b of state.balances) {
    if (b.account !== account) continue
    if (!best || b.date >= best.date) best = { date: b.date, amount: b.amount }
  }
  return best?.amount ?? 0
}

export function accountHistory(
  state: AppState,
  account: AccountId,
): { date: string; amount: number }[] {
  return state.balances
    .filter((b) => b.account === account)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((b) => ({ date: b.date, amount: b.amount }))
}

export function businessTotal(state: AppState): number {
  return accountBalance(state, 'acmrBank') + accountBalance(state, 'onemediaBank')
}

export function rewardsUnlocked(state: AppState): boolean {
  return state.payoutReceived >= state.targets.personalPayout
}

/** Revenue booked inside a given Monday-anchored week, per entity. */
export function weekRevenue(state: AppState, weekStart: string) {
  const end = addDays(weekStart, 7)
  let acmr = 0
  let onemedia = 0
  let cash = 0
  let profit = 0
  for (const e of state.ledger) {
    if (e.date < weekStart || e.date >= end) continue
    if (e.kind === 'revenue') {
      if (e.entity === 'acmr') acmr += e.amount
      else onemedia += e.amount
    }
    if (e.kind === 'cashCollected') cash += e.amount
    if (e.kind === 'profit') profit += e.amount
  }
  return { acmr, onemedia, total: acmr + onemedia, cash, profit }
}

export function currentWeekStart(iso = todayISO()): string {
  return weekStartISO(iso)
}
