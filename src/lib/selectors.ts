import {
  CHECKLIST,
  CLEAN_IDS,
  COMPOUNDING,
  METRICS,
  PILLARS,
  PROTOCOL_DAYS,
} from './config'
import type { ChecklistItem, PillarId } from './config'
import {
  addDays,
  blockHours,
  dayNumber,
  daysBetween,
  fromISO,
  isoForDay,
  todayISO,
  weekStartISO,
} from './date'
import type {
  AccountId,
  AppState,
  Connection,
  DayEntry,
  LearnItem,
  Loop,
  MoneyEntity,
  Priority,
  Upkeep,
} from './types'

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

// ---------------------------------------------------------------------------
// Upkeep

export interface UpkeepStatus {
  item: Upkeep
  /** Days until due. Negative means overdue. Null when never done. */
  dueIn: number | null
  nextDue: string | null
  overdue: boolean
}

export function upkeepStatus(item: Upkeep, iso = todayISO()): UpkeepStatus {
  if (!item.lastDone) {
    return { item, dueIn: null, nextDue: null, overdue: true }
  }
  const nextDue = addDays(item.lastDone, item.intervalDays)
  const dueIn = daysBetween(iso, nextDue)
  return { item, dueIn, nextDue, overdue: dueIn <= 0 }
}

export function upkeepDueCount(state: AppState, iso = todayISO()): number {
  return state.upkeep.filter((u) => upkeepStatus(u, iso).overdue).length
}

// ---------------------------------------------------------------------------
// Goals

export function goalProgress(state: AppState): { done: number; total: number } {
  return {
    done: state.goals.filter((g) => g.done).length,
    total: state.goals.length,
  }
}

// ---------------------------------------------------------------------------
// The daily plan

export interface PlanStatus {
  /** Priorities with something written in them. Empty slots don't count. */
  filled: Priority[]
  set: number
  done: number
  pct: number
  /** Rank 1 — the one that decides whether the day was worth it. */
  oneThing: Priority | undefined
  oneThingDone: boolean
  plannedHours: number
}

export function planStatus(day: DayEntry | undefined): PlanStatus {
  const filled = (day?.priorities ?? []).filter((p) => p.text.trim() !== '')
  const done = filled.filter((p) => p.done).length
  const oneThing = filled[0]
  return {
    filled,
    set: filled.length,
    done,
    pct: filled.length ? (done / filled.length) * 100 : 0,
    oneThing,
    oneThingDone: Boolean(oneThing?.done),
    plannedHours: (day?.blocks ?? []).reduce((s, b) => s + blockHours(b.start, b.end), 0),
  }
}

export interface PriorityRun {
  /** Days that had at least one priority written down. */
  daysPlanned: number
  set: number
  done: number
  pct: number
  /** How often the day's number one actually landed — the number that matters. */
  oneThingHit: number
  oneThingRate: number
}

/** Plan-versus-reality across every logged day. Unplanned days are excluded. */
export function priorityRun(state: AppState): PriorityRun {
  let daysPlanned = 0
  let set = 0
  let done = 0
  let oneThingHit = 0
  for (const day of loggedDays(state)) {
    const p = planStatus(day)
    if (p.set === 0) continue
    daysPlanned++
    set += p.set
    done += p.done
    if (p.oneThingDone) oneThingHit++
  }
  return {
    daysPlanned,
    set,
    done,
    pct: set ? (done / set) * 100 : 0,
    oneThingHit,
    oneThingRate: daysPlanned ? (oneThingHit / daysPlanned) * 100 : 0,
  }
}

/** Consecutive days up to `iso` where the day's one thing was hit. */
export function oneThingStreak(state: AppState, iso = todayISO()): number {
  let n = 0
  let cursor = iso
  // Today only breaks the streak once it's closed — mid-morning shouldn't zero it.
  if (!planStatus(state.days[cursor]).oneThingDone) {
    if (state.days[cursor]?.closed) return 0
    cursor = addDays(cursor, -1)
  }
  while (planStatus(state.days[cursor]).oneThingDone) {
    n++
    cursor = addDays(cursor, -1)
  }
  return n
}

// ---------------------------------------------------------------------------
// Patterns — loops, breakdowns and what precedes them
//
// The point of this section is to answer one question: what keeps happening?
// Self-reported loops give the honest half; the logged numbers give the half
// you can't argue with. Everything below needs a minimum sample before it will
// claim anything, because a pattern found in four days is not a pattern.

/** Below this a signal is noise, and saying it out loud would be worse than silence. */
const MIN_SAMPLE = 5

export interface LoopStat {
  loop: Loop
  /** Times it fired in the window. */
  count: number
  /** Logged days in the window — the denominator. */
  days: number
  rate: number
  recent: number
  prior: number
  /** Only stated when both halves hold enough logged days to compare. */
  trend: 'rising' | 'falling' | 'flat'
  lastFired: string
  /** Consecutive days up to today where it fired. */
  streak: number
}

/**
 * Loop frequency over the trailing `window` days, with the most recent half
 * compared against the half before it so a loop that is getting worse is
 * visible before it becomes the norm.
 */
export function loopStats(state: AppState, iso = todayISO(), window = 28): LoopStat[] {
  const half = Math.floor(window / 2)
  const dates: string[] = []
  for (let i = 0; i < window; i++) dates.push(addDays(iso, -i))
  const logged = dates.filter((d) => isLogged(state.days[d]))

  return state.loops
    .filter((l) => !l.archived)
    .map((loop) => {
      let count = 0
      let recent = 0
      let prior = 0
      let lastFired = ''
      for (const [i, date] of dates.entries()) {
        if (!state.days[date]?.loops.includes(loop.id)) continue
        count++
        if (i < half) recent++
        else prior++
        if (!lastFired) lastFired = date
      }
      let streak = 0
      for (const date of dates) {
        if (!state.days[date]?.loops.includes(loop.id)) break
        streak++
      }

      // Compare rates, not raw counts: early in a protocol the older half holds
      // far fewer logged days, and counting alone would call every loop rising.
      const recentDays = dates.slice(0, half).filter((d) => isLogged(state.days[d])).length
      const priorDays = dates.slice(half).filter((d) => isLogged(state.days[d])).length
      const recentRate = recentDays ? recent / recentDays : 0
      const priorRate = priorDays ? prior / priorDays : 0
      const comparable = recentDays >= 4 && priorDays >= 4
      const shift = recentRate - priorRate

      return {
        loop,
        count,
        days: logged.length,
        rate: logged.length ? (count / logged.length) * 100 : 0,
        recent,
        prior,
        trend:
          !comparable || Math.abs(shift) < 0.1 ? 'flat' : shift > 0 ? 'rising' : 'falling',
        lastFired,
        streak,
      } satisfies LoopStat
    })
    .sort((a, b) => b.count - a.count || a.loop.label.localeCompare(b.loop.label))
}

export interface WeakStandard {
  id: string
  label: string
  pillar: string
  missed: number
  logged: number
  rate: number
  points: number
}

/** The standards you drop most often, weighted by what they cost you. */
export function weakestStandards(state: AppState): WeakStandard[] {
  const days = loggedDays(state)
  if (days.length < MIN_SAMPLE) return []
  return CHECKLIST.map((item) => {
    const missed = days.filter((d) => !isItemDone(item, d, state.targets)).length
    return {
      id: item.id,
      label: item.label,
      pillar: PILLARS.find((p) => p.id === item.pillar)?.label ?? '',
      missed,
      logged: days.length,
      rate: (missed / days.length) * 100,
      points: item.points,
    }
  })
    .filter((w) => w.missed > 0)
    .sort((a, b) => b.rate * b.points - a.rate * a.points)
}

export interface CarriedPriority {
  text: string
  tag: string
  /** Days it was written down and not finished, in total. */
  times: number
  /** Longest unbroken run of writing it down and not doing it. */
  maxRun: number
  /** Whether that longest run is the one still going. */
  ongoing: boolean
  firstDate: string
  lastDate: string
  everDone: boolean
}

/**
 * The same intention, rewritten and left open. Ranked by the longest unbroken
 * run rather than by total misses, because those are two different things: a
 * standing item like "gym" will accumulate misses forever without ever being
 * stuck, whereas five days in a row of writing the same sentence and not doing
 * it is a wall. Only the second one is worth a screen.
 */
export function carriedPriorities(state: AppState): CarriedPriority[] {
  const seen = new Map<string, { text: string; tag: string; hits: { date: string; done: boolean }[] }>()
  for (const day of loggedDays(state)) {
    for (const p of day.priorities) {
      const text = p.text.trim()
      if (!text) continue
      const key = text.toLowerCase().replace(/\s+/g, ' ')
      const entry = seen.get(key) ?? { text, tag: p.tag, hits: [] }
      entry.hits.push({ date: day.date, done: p.done })
      seen.set(key, entry)
    }
  }

  const out: CarriedPriority[] = []
  for (const { text, tag, hits } of seen.values()) {
    hits.sort((a, b) => a.date.localeCompare(b.date))
    let run = 0
    let maxRun = 0
    let runEnd = ''
    for (const h of hits) {
      run = h.done ? 0 : run + 1
      if (run > maxRun) {
        maxRun = run
        runEnd = h.date
      }
    }
    if (maxRun < 2) continue
    out.push({
      text,
      tag,
      times: hits.filter((h) => !h.done).length,
      maxRun,
      // The run is still live if it reaches the last time the item was written.
      ongoing: runEnd === hits[hits.length - 1].date && !hits[hits.length - 1].done,
      firstDate: hits[0].date,
      lastDate: hits[hits.length - 1].date,
      everDone: hits.some((h) => h.done),
    })
  }
  return out.sort((a, b) => b.maxRun - a.maxRun || b.times - a.times)
}

export interface MetricGap {
  key: string
  label: string
  unit: string
  dp: number
  winning: number
  losing: number
  /** Signed difference, winning minus losing. */
  gap: number
  /** Share of the losing average the gap represents — used to rank. */
  weight: number
}

/**
 * What is measurably different about the days that fall apart. Compares each
 * metric's average on winning days (80+) against breakdown days (under 50).
 * Correlation, not cause — but it is where to look first.
 */
export function breakdownSignals(state: AppState): MetricGap[] {
  const days = loggedDays(state)
  const winning = days.filter((d) => scoreDay(d, state.targets).score >= 80)
  const losing = days.filter((d) => scoreDay(d, state.targets).score < 50)
  if (winning.length < 3 || losing.length < 3) return []

  const mean = (list: DayEntry[], key: string) =>
    list.reduce((s, d) => s + (d.metrics[key as keyof DayEntry['metrics']] ?? 0), 0) / list.length

  return METRICS.map((m) => {
    const w = mean(winning, m.key)
    const l = mean(losing, m.key)
    const gap = w - l
    return {
      key: m.key,
      label: m.label,
      unit: m.unit,
      dp: m.dp,
      winning: w,
      losing: l,
      gap,
      weight: Math.abs(gap) / Math.max(1, Math.abs(l)),
    }
  })
    .filter((g) => Math.abs(g.gap) > 0)
    .sort((a, b) => b.weight - a.weight)
}

export interface WeekdayScore {
  dow: number
  label: string
  avg: number
  days: number
}

const DOW_LABEL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Average score by day of the week. The weak day is nearly always the same one. */
export function weekdayScores(state: AppState): WeekdayScore[] {
  const buckets: { total: number; n: number }[] = Array.from({ length: 7 }, () => ({
    total: 0,
    n: 0,
  }))
  for (const day of loggedDays(state)) {
    const b = buckets[fromISO(day.date).getDay()]
    b.total += scoreDay(day, state.targets).score
    b.n++
  }
  return buckets.map((b, dow) => ({
    dow,
    label: DOW_LABEL[dow],
    avg: b.n ? b.total / b.n : 0,
    days: b.n,
  }))
}

export interface PlanEffect {
  plannedDays: number
  unplannedDays: number
  plannedAvg: number
  unplannedAvg: number
  delta: number
  /** Only true once both sides have enough days to mean anything. */
  meaningful: boolean
}

/** What writing the plan down is actually worth, in points per day. */
export function planEffect(state: AppState): PlanEffect {
  const days = loggedDays(state)
  const withPlan = days.filter((d) => planStatus(d).set > 0)
  const without = days.filter((d) => planStatus(d).set === 0)
  const avg = (list: DayEntry[]) =>
    list.length ? list.reduce((s, d) => s + scoreDay(d, state.targets).score, 0) / list.length : 0
  const plannedAvg = avg(withPlan)
  const unplannedAvg = avg(without)
  return {
    plannedDays: withPlan.length,
    unplannedDays: without.length,
    plannedAvg,
    unplannedAvg,
    delta: plannedAvg - unplannedAvg,
    meaningful: withPlan.length >= 3 && without.length >= 3,
  }
}

// ---------------------------------------------------------------------------
// Learning

export interface LearnStats {
  active: number
  done: number
  queued: number
  lessons: number
  applied: number
  /** Lessons captured but never turned into an action taken. */
  unapplied: number
}

export function learnStats(state: AppState): LearnStats {
  const lessons = state.learning.flatMap((i) => i.lessons)
  return {
    active: state.learning.filter((i) => i.status === 'active').length,
    done: state.learning.filter((i) => i.status === 'done').length,
    queued: state.learning.filter((i) => i.status === 'queued').length,
    lessons: lessons.length,
    applied: lessons.filter((l) => l.applied).length,
    unapplied: lessons.filter((l) => !l.applied).length,
  }
}

export interface DatedLesson {
  itemId: string
  itemTitle: string
  kind: LearnItem['kind']
  lesson: LearnItem['lessons'][number]
}

/** Every lesson across every source, newest first. */
export function allLessons(state: AppState): DatedLesson[] {
  return state.learning
    .flatMap((item) =>
      item.lessons.map((lesson) => ({
        itemId: item.id,
        itemTitle: item.title,
        kind: item.kind,
        lesson,
      })),
    )
    .sort((a, b) => b.lesson.date.localeCompare(a.lesson.date))
}

// ---------------------------------------------------------------------------
// Network

export interface ContactStatus {
  /** Days since the last logged conversation; null when there never was one. */
  daysSince: number | null
  /** Days until the cadence comes round. Negative once it has passed. */
  dueIn: number
  due: boolean
  tracked: boolean
}

/** Where a relationship stands against the cadence you set for it. */
export function contactStatus(c: Connection, iso = todayISO()): ContactStatus {
  const tracked = c.cadenceDays > 0
  if (!c.lastContact) {
    return { daysSince: null, dueIn: 0, due: tracked, tracked }
  }
  const daysSince = daysBetween(c.lastContact, iso)
  const dueIn = c.cadenceDays - daysSince
  return { daysSince, dueIn, due: tracked && dueIn <= 0, tracked }
}

export function contactsDue(state: AppState, iso = todayISO()): Connection[] {
  return state.connections
    .filter((c) => contactStatus(c, iso).due)
    .sort((a, b) => contactStatus(a, iso).dueIn - contactStatus(b, iso).dueIn)
}
