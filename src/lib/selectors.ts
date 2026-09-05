import {
  CHECKLIST,
  CLEAN_IDS,
  COMPOUNDING,
  CADENCE_PER_MONTH,
  DEAL_STAGES,
  GOAL_HORIZONS,
  METRIC_BY_KEY,
  METRICS,
  OPEN_STAGES,
  PILLARS,
  PURSE_LABEL,
  SECTIONS,
  PROTOCOL_DAYS,
  STALE_DEAL_DAYS,
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
  Bill,
  Client,
  Connection,
  DayEntry,
  Deal,
  DealStage,
  DomainLink,
  DomainNode,
  Goal,
  GoalHorizon,
  Invoice,
  KeyResult,
  LedgerKind,
  MetricKey,
  Project,
  Purse,
  Task,
  Tracker,
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
  if (item.id === 'consulting_hours') {
    return day.restDay || day.metrics.consultingHours >= targets.consultingHours
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
  const a = entityTotals(state, 'consulting')
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
  return accountBalance(state, 'consultingBank') + accountBalance(state, 'onemediaBank')
}

export function rewardsUnlocked(state: AppState): boolean {
  return state.payoutReceived >= state.targets.personalPayout
}

/** Revenue booked inside a given Monday-anchored week, per entity. */
export function weekRevenue(state: AppState, weekStart: string) {
  const end = addDays(weekStart, 7)
  let consulting = 0
  let onemedia = 0
  let cash = 0
  let profit = 0
  for (const e of state.ledger) {
    if (e.date < weekStart || e.date >= end) continue
    if (e.kind === 'revenue') {
      if (e.entity === 'consulting') consulting += e.amount
      else onemedia += e.amount
    }
    if (e.kind === 'cashCollected') cash += e.amount
    if (e.kind === 'profit') profit += e.amount
  }
  return { consulting, onemedia, total: consulting + onemedia, cash, profit }
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

// ---------------------------------------------------------------------------
// The life map
//
// A node scores off the standards and metrics bound to it. A node with no
// bindings of its own takes the mean of its children, so a domain is only ever
// as healthy as what sits under it — and a branch nobody has bound to anything
// reports no score rather than a flattering zero.

export interface DomainScore {
  id: string
  /** 0-100, or null when nothing under this node is measured. */
  score: number | null
  /** Logged days the score was computed over. */
  days: number
  /** Times a loop belonging to this branch fired in the window. */
  loopHits: number
  /** Direct children, deepest-first traversal order. */
  childIds: string[]
  depth: number
}

function childrenOf(domains: DomainNode[], id: string): DomainNode[] {
  return domains.filter((d) => d.parentId === id)
}

/** Every node's id, in depth-first order, with its depth. */
export function domainOrder(domains: DomainNode[]): { node: DomainNode; depth: number }[] {
  const out: { node: DomainNode; depth: number }[] = []
  const walk = (parentId: string, depth: number) => {
    for (const node of childrenOf(domains, parentId)) {
      out.push({ node, depth })
      walk(node.id, depth + 1)
    }
  }
  const roots = domains.filter((d) => d.parentId === '')
  for (const root of roots) {
    out.push({ node: root, depth: 0 })
    walk(root.id, 1)
  }
  return out
}

/**
 * Scores every node over the trailing `window` days. Own bindings win; a node
 * without them averages its children.
 */
export function domainScores(
  state: AppState,
  iso = todayISO(),
  window = 28,
): Map<string, DomainScore> {
  const dates: string[] = []
  for (let i = 0; i < window; i++) dates.push(addDays(iso, -i))
  const days = dates.map((d) => state.days[d]).filter(isLogged)

  const byId = new Map(state.domains.map((d) => [d.id, d]))
  const out = new Map<string, DomainScore>()

  const own = (node: DomainNode): number | null => {
    if (days.length === 0) return null
    const parts: number[] = []
    for (const id of node.checkIds) {
      const item = CHECKLIST.find((c) => c.id === id)
      if (!item) continue
      parts.push(
        (days.filter((d) => isItemDone(item, d, state.targets)).length / days.length) * 100,
      )
    }
    for (const key of node.metricKeys) {
      const spec = METRIC_BY_KEY[key]
      const target = state.targets[key as keyof AppState['targets']] as number
      if (!spec || !target) continue
      // An inverted metric is a ceiling, so attainment runs the other way.
      const ratios = days.map((d) => {
        const v = d.metrics[key]
        return spec.invert ? (v <= target ? 1 : target / Math.max(v, 1)) : Math.min(1, v / target)
      })
      parts.push((ratios.reduce((a, b) => a + b, 0) / ratios.length) * 100)
    }
    if (parts.length === 0) return null
    return parts.reduce((a, b) => a + b, 0) / parts.length
  }

  const loopHitsFor = (node: DomainNode): number =>
    node.loopIds.reduce(
      (sum, id) => sum + days.filter((d) => d.loops.includes(id)).length,
      0,
    )

  // Depth-first so children are resolved before the parent needs their mean.
  const resolve = (node: DomainNode, depth: number): DomainScore => {
    const kids = childrenOf(state.domains, node.id)
    const kidScores = kids.map((k) => resolve(k, depth + 1))
    const mine = own(node)
    const usable = kidScores.map((k) => k.score).filter((v): v is number => v !== null)
    const score =
      mine !== null ? mine : usable.length ? usable.reduce((a, b) => a + b, 0) / usable.length : null

    const result: DomainScore = {
      id: node.id,
      score,
      days: days.length,
      loopHits: loopHitsFor(node) + kidScores.reduce((s, k) => s + k.loopHits, 0),
      childIds: kids.map((k) => k.id),
      depth,
    }
    out.set(node.id, result)
    return result
  }

  for (const root of state.domains.filter((d) => d.parentId === '')) resolve(root, 0)
  // Anything orphaned by an edit still deserves a row rather than vanishing.
  for (const node of state.domains) {
    if (!out.has(node.id) && byId.has(node.parentId) === false && node.parentId !== '') {
      resolve(node, 0)
    }
  }
  return out
}

/** Ancestors of a node, root first, excluding the node itself. */
export function domainPath(domains: DomainNode[], id: string): DomainNode[] {
  const byId = new Map(domains.map((d) => [d.id, d]))
  const out: DomainNode[] = []
  let cur = byId.get(id)
  while (cur && cur.parentId) {
    const parent = byId.get(cur.parentId)
    if (!parent) break
    out.unshift(parent)
    cur = parent
  }
  return out
}

/** Every id at or beneath a node — the filter a Patterns view runs on. */
export function domainSubtree(domains: DomainNode[], id: string): string[] {
  const out = [id]
  for (const child of childrenOf(domains, id)) out.push(...domainSubtree(domains, child.id))
  return out
}

export interface DomainEdge {
  link: DomainLink
  from: DomainNode
  to: DomainNode
}

/** Causes pointing into a node, and the effects running out of it. */
export function domainEdges(state: AppState, id: string): { causes: DomainEdge[]; effects: DomainEdge[] } {
  const byId = new Map(state.domains.map((d) => [d.id, d]))
  const edges = state.links
    .map((link) => {
      const from = byId.get(link.fromId)
      const to = byId.get(link.toId)
      return from && to ? { link, from, to } : null
    })
    .filter((e): e is DomainEdge => e !== null)
  return {
    causes: edges.filter((e) => e.link.toId === id),
    effects: edges.filter((e) => e.link.fromId === id),
  }
}

// ---------------------------------------------------------------------------
// Oscillation — the two versions of yourself
//
// The build-up and the tear-down are not moods, they are visible in the score.
// A short rolling mean against the long mean says which one is currently
// running; the crossings mark where one handed over to the other.

/** Days in the rolling window. Long enough to ignore one bad Tuesday. */
const SWING_WINDOW = 7

export interface SwingPoint {
  date: string
  /** Raw daily score, 0 when unlogged. */
  score: number
  /** Rolling mean over the trailing week — the curve you actually read. */
  smooth: number
  logged: boolean
}

export type Phase = 'build' | 'break'

export interface Swing {
  kind: Phase
  startDate: string
  endDate: string
  days: number
  /** Highest point of a build, lowest of a break. */
  extreme: number
  meanScore: number
}

export interface Oscillation {
  points: SwingPoint[]
  /** The long-run average — the state you actually live at, between the two. */
  mean: number
  swings: Swing[]
  current: Swing | null
  /** Mean of the most recent third against the oldest third. */
  drift: number
  longestBuild: Swing | null
  deepestBreak: Swing | null
  enough: boolean
}

/**
 * Reads the oscillation between the constructive and destructive version out of
 * the logged days. Above the long mean is a build; below it is a break. The
 * mean itself is the honest number: it is the version of you that actually
 * shows up on average, and moving it is the whole job.
 */
export function oscillation(state: AppState, iso = todayISO(), window = 90): Oscillation {
  const dates: string[] = []
  for (let i = window - 1; i >= 0; i--) dates.push(addDays(iso, -i))

  const scored = dates.map((date) => {
    const day = state.days[date]
    return {
      date,
      logged: isLogged(day),
      score: isLogged(day) ? scoreDay(day, state.targets).score : 0,
    }
  })

  const firstLogged = scored.findIndex((p) => p.logged)
  const live = firstLogged === -1 ? [] : scored.slice(firstLogged)
  const loggedOnly = live.filter((p) => p.logged)
  const mean = loggedOnly.length
    ? loggedOnly.reduce((s, p) => s + p.score, 0) / loggedOnly.length
    : 0

  // Carry the last known value across gaps: an unlogged day is missing data,
  // not a zero-score day, and letting it drag the curve down would invent a
  // crash out of a day you simply didn't open the app.
  let carry = mean
  const points: SwingPoint[] = live.map((p, i) => {
    if (p.logged) carry = p.score
    const from = Math.max(0, i - SWING_WINDOW + 1)
    const slice = live.slice(from, i + 1)
    const vals = slice.map((q) => (q.logged ? q.score : carry))
    return {
      date: p.date,
      score: p.score,
      logged: p.logged,
      smooth: vals.reduce((a, b) => a + b, 0) / vals.length,
    }
  })

  const swings: Swing[] = []
  for (const point of points) {
    const kind: Phase = point.smooth >= mean ? 'build' : 'break'
    const last = swings[swings.length - 1]
    if (last && last.kind === kind) {
      last.endDate = point.date
      last.days++
      last.extreme =
        kind === 'build' ? Math.max(last.extreme, point.smooth) : Math.min(last.extreme, point.smooth)
      last.meanScore = last.meanScore + (point.smooth - last.meanScore) / last.days
    } else {
      swings.push({
        kind,
        startDate: point.date,
        endDate: point.date,
        days: 1,
        extreme: point.smooth,
        meanScore: point.smooth,
      })
    }
  }

  const third = Math.floor(loggedOnly.length / 3)
  const drift =
    third >= 3
      ? loggedOnly.slice(-third).reduce((s, p) => s + p.score, 0) / third -
        loggedOnly.slice(0, third).reduce((s, p) => s + p.score, 0) / third
      : 0

  const builds = swings.filter((s) => s.kind === 'build')
  const breaks = swings.filter((s) => s.kind === 'break')

  return {
    points,
    mean,
    swings,
    current: swings[swings.length - 1] ?? null,
    drift,
    longestBuild: builds.sort((a, b) => b.days - a.days)[0] ?? null,
    deepestBreak: breaks.sort((a, b) => a.extreme - b.extreme)[0] ?? null,
    // Two full swings is the minimum before calling anything a cycle.
    enough: loggedOnly.length >= 14 && swings.length >= 2,
  }
}

// ---------------------------------------------------------------------------
// Work
//
// Revenue is a lagging number. Everything here exists to give it a leading one:
// what is in the pipeline, what it is worth once weighted, and what has stopped
// moving. A deal nobody has touched in a fortnight is not a deal.

export interface PipelineStage {
  id: DealStage
  label: string
  deals: Deal[]
  value: number
  weighted: number
}

export interface Pipeline {
  stages: PipelineStage[]
  open: Deal[]
  /** Face value of everything still open. */
  value: number
  /** Value once each deal is weighted by its own probability. */
  weighted: number
  won: number
  lost: number
  winRate: number
  averageDeal: number
  stale: Deal[]
}

export function pipeline(state: AppState, entity?: MoneyEntity, iso = todayISO()): Pipeline {
  const all = entity ? state.deals.filter((d) => d.entity === entity) : state.deals
  const stages: PipelineStage[] = DEAL_STAGES.map((s) => {
    const deals = all.filter((d) => d.stage === s.id)
    return {
      id: s.id,
      label: s.label,
      deals,
      value: deals.reduce((sum, d) => sum + d.value, 0),
      weighted: deals.reduce((sum, d) => sum + (d.value * d.probability) / 100, 0),
    }
  })

  const open = all.filter((d) => OPEN_STAGES.includes(d.stage))
  const won = all.filter((d) => d.stage === 'won')
  const lost = all.filter((d) => d.stage === 'lost')
  const closed = won.length + lost.length

  return {
    stages,
    open,
    value: open.reduce((s, d) => s + d.value, 0),
    weighted: open.reduce((s, d) => s + (d.value * d.probability) / 100, 0),
    won: won.reduce((s, d) => s + d.value, 0),
    lost: lost.reduce((s, d) => s + d.value, 0),
    winRate: closed ? (won.length / closed) * 100 : 0,
    averageDeal: won.length ? won.reduce((s, d) => s + d.value, 0) / won.length : 0,
    stale: open
      .filter((d) => !d.moved || daysBetween(d.moved, iso) >= STALE_DEAL_DAYS)
      .sort((a, b) => (a.moved || '').localeCompare(b.moved || '')),
  }
}

export interface ClientBook {
  active: Client[]
  /** Recurring monthly revenue from active clients. */
  mrr: number
  /** Share of MRR sitting with the single largest client. */
  concentration: number
  renewalsDue: Client[]
}

export function clientBook(state: AppState, entity?: MoneyEntity, iso = todayISO()): ClientBook {
  const all = entity ? state.clients.filter((c) => c.entity === entity) : state.clients
  const active = all.filter((c) => c.status === 'active')
  const mrr = active.reduce((s, c) => s + c.monthlyValue, 0)
  const largest = active.reduce((max, c) => Math.max(max, c.monthlyValue), 0)
  return {
    active,
    mrr,
    concentration: mrr > 0 ? (largest / mrr) * 100 : 0,
    // Anything renewing inside 30 days needs the conversation started now.
    renewalsDue: all
      .filter((c) => c.renewal && daysBetween(iso, c.renewal) <= 30)
      .sort((a, b) => a.renewal.localeCompare(b.renewal)),
  }
}

export interface TaskQueue {
  overdue: Task[]
  today: Task[]
  soon: Task[]
  someday: Task[]
  done: Task[]
  openCount: number
}

/** The open work, split by how late it already is. */
export function taskQueue(state: AppState, iso = todayISO()): TaskQueue {
  const open = state.tasks.filter((t) => !t.done)
  const dated = (t: Task) => (t.due ? daysBetween(iso, t.due) : null)
  return {
    overdue: open.filter((t) => {
      const d = dated(t)
      return d !== null && d < 0
    }),
    today: open.filter((t) => dated(t) === 0),
    soon: open.filter((t) => {
      const d = dated(t)
      return d !== null && d > 0 && d <= 7
    }),
    someday: open.filter((t) => dated(t) === null || (dated(t) ?? 0) > 7),
    done: state.tasks.filter((t) => t.done),
    openCount: open.length,
  }
}

export interface ProjectProgress {
  project: Project
  total: number
  done: number
  pct: number
  openTasks: Task[]
}

export function projectProgress(state: AppState, projectId: string): ProjectProgress | null {
  const project = state.projects.find((p) => p.id === projectId)
  if (!project) return null
  const tasks = state.tasks.filter((t) => t.projectId === projectId)
  const done = tasks.filter((t) => t.done).length
  return {
    project,
    total: tasks.length,
    done,
    pct: tasks.length ? (done / tasks.length) * 100 : 0,
    openTasks: tasks.filter((t) => !t.done),
  }
}

// ---------------------------------------------------------------------------
// Goals
//
// A key result either reads itself out of data the app already holds, or it is
// a number you type. The first kind can't drift out of date; the second kind
// always does, so it is the fallback rather than the default.

export interface KeyResultProgress {
  kr: KeyResult
  current: number
  target: number
  pct: number
  /** False when the source can no longer be resolved (a deleted account, say). */
  live: boolean
}

export function keyResultProgress(state: AppState, kr: KeyResult): KeyResultProgress {
  let current = kr.current
  let live = true

  if (kr.source === 'account') {
    current = accountBalance(state, kr.ref as AccountId)
  } else if (kr.source === 'ledger') {
    current = state.ledger
      .filter((e) => e.kind === (kr.ref as LedgerKind))
      .reduce((s, e) => s + e.amount, 0)
  } else if (kr.source === 'metric') {
    const key = kr.ref as MetricKey
    if (!METRIC_BY_KEY[key]) live = false
    else current = loggedDays(state).reduce((s, d) => s + (d.metrics[key] ?? 0), 0)
  }

  return {
    kr,
    current,
    target: kr.target,
    pct: kr.target > 0 ? Math.min(100, (current / kr.target) * 100) : 0,
    live,
  }
}

export interface GoalProgress {
  goal: Goal
  results: KeyResultProgress[]
  /** Mean of the key results; falls back to done/not-done with none. */
  pct: number
  children: Goal[]
  /** Days left, or null with no deadline. Negative once it has passed. */
  daysLeft: number | null
}

export function goalProgress(state: AppState, goal: Goal, iso = todayISO()): GoalProgress {
  const results = goal.keyResults.map((kr) => keyResultProgress(state, kr))
  return {
    goal,
    results,
    pct: results.length
      ? results.reduce((s, r) => s + r.pct, 0) / results.length
      : goal.done
        ? 100
        : 0,
    children: state.goals.filter((g) => g.parentId === goal.id),
    daysLeft: goal.due ? daysBetween(iso, goal.due) : null,
  }
}

export interface GoalBoard {
  byHorizon: { horizon: GoalHorizon; label: string; goals: GoalProgress[] }[]
  atRisk: GoalProgress[]
  done: number
  total: number
}

/**
 * Everything, grouped by how far out it sits. "At risk" means a dated goal
 * whose progress is further behind than its remaining time can account for —
 * being 20% done with 80% of the time gone is the shape worth catching.
 */
export function goalBoard(state: AppState, iso = todayISO()): GoalBoard {
  const all = state.goals.map((g) => goalProgress(state, g, iso))

  const atRisk = all.filter((p) => {
    if (p.goal.done || p.daysLeft === null) return false
    if (p.daysLeft < 0) return true
    // Compare progress against elapsed share of the run-up to the deadline.
    const span = p.goal.due ? daysBetween(p.goal.due, iso) : 0
    void span
    return p.pct < 50 && p.daysLeft <= 30
  })

  return {
    byHorizon: GOAL_HORIZONS.map((h) => ({
      horizon: h.id,
      label: h.label,
      goals: all.filter((p) => p.goal.horizon === h.id),
    })),
    atRisk,
    done: state.goals.filter((g) => g.done).length,
    total: state.goals.length,
  }
}

// ---------------------------------------------------------------------------
// Search
//
// Twelve sections is more than anyone navigates by tapping. Everything the app
// holds is reachable from one box, ranked so an exact prefix beats a match
// buried mid-word.

export type SearchKind =
  | 'section'
  | 'task'
  | 'project'
  | 'goal'
  | 'source'
  | 'lesson'
  | 'person'
  | 'client'
  | 'deal'
  | 'branch'
  | 'loop'
  | 'priority'

export interface SearchResult {
  id: string
  kind: SearchKind
  label: string
  sub: string
  /** Section to open when it is chosen. */
  tab: string
  score: number
}

const KIND_LABEL: Record<SearchKind, string> = {
  section: 'Section',
  task: 'Task',
  project: 'Project',
  goal: 'Goal',
  source: 'Learning',
  lesson: 'Lesson',
  person: 'Person',
  client: 'Client',
  deal: 'Deal',
  branch: 'Branch',
  loop: 'Loop',
  priority: 'Priority',
}

export function searchKindLabel(kind: SearchKind): string {
  return KIND_LABEL[kind]
}

/**
 * Rank one candidate. An exact hit beats a prefix, a prefix beats the start of
 * any word, and a match buried mid-word scores lowest — which is what stops
 * "an" dragging every sentence containing it to the top.
 */
function rank(haystack: string, needle: string): number {
  const h = haystack.toLowerCase()
  if (!h) return 0
  if (h === needle) return 100
  if (h.startsWith(needle)) return 80
  const at = h.indexOf(needle)
  if (at === -1) return 0
  // A match right after a space or punctuation is a word start.
  return /[\s\-–—:,.(]/.test(h[at - 1] ?? ' ') ? 55 : 25
}

export function search(state: AppState, query: string, limit = 12): SearchResult[] {
  const q = query.trim().toLowerCase()
  if (q.length < 1) return []
  const out: SearchResult[] = []

  const push = (
    id: string,
    kind: SearchKind,
    label: string,
    sub: string,
    tab: string,
    extra = '',
  ) => {
    const score = Math.max(rank(label, q), rank(extra, q) * 0.6)
    if (score > 0) out.push({ id, kind, label, sub, tab, score })
  }

  for (const s of SECTIONS) push(`section-${s.id}`, 'section', s.label, s.blurb, s.id, s.blurb)

  for (const t of state.tasks) {
    const project = state.projects.find((p) => p.id === t.projectId)
    push(
      `task-${t.id}`,
      'task',
      t.title,
      [t.done ? 'done' : 'open', project?.name, t.due && `due ${t.due}`]
        .filter(Boolean)
        .join(' · '),
      'work',
    )
  }

  for (const p of state.projects) push(`project-${p.id}`, 'project', p.name, p.status, 'work')
  for (const c of state.clients)
    push(`client-${c.id}`, 'client', c.name, `${c.status} · ${c.entity}`, 'work', c.notes)
  for (const d of state.deals)
    push(`deal-${d.id}`, 'deal', d.name, `${d.stage} · ${d.entity}`, 'work', d.nextStep)

  for (const g of state.goals)
    push(`goal-${g.id}`, 'goal', g.title, g.horizon, 'goals', g.note)

  for (const item of state.learning) {
    push(
      `source-${item.id}`,
      'source',
      item.title,
      [item.kind, item.source, item.status].filter(Boolean).join(' · '),
      'learn',
      item.notes,
    )
    for (const lesson of item.lessons) {
      push(`lesson-${lesson.id}`, 'lesson', lesson.text, `from ${item.title}`, 'learn', lesson.action)
    }
  }

  for (const c of state.connections)
    push(`person-${c.id}`, 'person', c.name, [c.role, c.status].filter(Boolean).join(' · '), 'network', `${c.why} ${c.notes}`)

  for (const d of state.domains)
    push(`branch-${d.id}`, 'branch', d.label, 'branch of the map', 'map', d.note)

  for (const l of state.loops)
    push(`loop-${l.id}`, 'loop', l.label, l.archived ? 'archived loop' : 'loop', 'patterns', l.note)

  // Priorities are searched across every day, deduped by text — the same
  // intention written on twelve days is one result, not twelve.
  const seen = new Set<string>()
  for (const day of loggedDays(state).reverse()) {
    for (const p of day.priorities) {
      const text = p.text.trim()
      if (!text) continue
      const key = text.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      push(`priority-${key}`, 'priority', text, `priority on ${day.date}`, 'today')
    }
  }

  return out.sort((a, b) => b.score - a.score || a.label.localeCompare(b.label)).slice(0, limit)
}

// ---------------------------------------------------------------------------
// Money, in depth
//
// Balances say what you have. These say what is leaving, what you own against
// what you owe, who hasn't paid, and how long the cash lasts — which is the
// only one of those that decides whether you can say no to a bad deal.

export interface BillBook {
  bills: Bill[]
  /** Every cadence normalised to a monthly figure. */
  monthly: number
  annual: number
  byPurse: { purse: Purse; label: string; monthly: number }[]
  dueSoon: Bill[]
}

export function monthlyCost(bill: Bill): number {
  return bill.amount * CADENCE_PER_MONTH[bill.cadence]
}

export function billBook(state: AppState, purse?: Purse, iso = todayISO()): BillBook {
  const bills = purse ? state.bills.filter((b) => b.purse === purse) : state.bills
  const monthly = bills.reduce((s, b) => s + monthlyCost(b), 0)
  const purses: Purse[] = ['consulting', 'onemedia', 'personal']
  return {
    bills,
    monthly,
    annual: monthly * 12,
    byPurse: purses.map((p) => ({
      purse: p,
      label: PURSE_LABEL[p],
      monthly: state.bills.filter((b) => b.purse === p).reduce((s, b) => s + monthlyCost(b), 0),
    })),
    dueSoon: bills
      .filter((b) => b.nextDue && daysBetween(iso, b.nextDue) <= 7)
      .sort((a, b) => a.nextDue.localeCompare(b.nextDue)),
  }
}

export interface BalanceSheet {
  assets: number
  liabilities: number
  net: number
  liquid: number
  illiquid: number
  /** True once anything has been itemised; false means the manual figure stands. */
  itemised: boolean
  /** The old manual net-worth snapshot, kept as the fallback. */
  manual: number
}

/**
 * Net worth, calculated. Falls back to the manual snapshot until at least one
 * holding exists, so upgrading doesn't blank the number you were watching.
 */
export function balanceSheet(state: AppState): BalanceSheet {
  const assets = state.holdings
    .filter((h) => h.kind === 'asset')
    .reduce((s, h) => s + h.value, 0)
  const liabilities = state.holdings
    .filter((h) => h.kind === 'liability')
    .reduce((s, h) => s + h.value, 0)
  const liquid = state.holdings
    .filter((h) => h.kind === 'asset' && h.liquid)
    .reduce((s, h) => s + h.value, 0)
  const manual = accountBalance(state, 'netWorth')
  const itemised = state.holdings.length > 0
  return {
    assets,
    liabilities,
    net: itemised ? assets - liabilities : manual,
    liquid,
    illiquid: assets - liquid,
    itemised,
    manual,
  }
}

export interface InvoiceBook {
  outstanding: number
  overdue: Invoice[]
  overdueValue: number
  paidThisMonth: number
  /** Mean days between issuing and payment. Null until something has been paid. */
  averageDaysToPay: number | null
}

export function invoiceBook(state: AppState, entity?: MoneyEntity, iso = todayISO()): InvoiceBook {
  const all = entity ? state.invoices.filter((i) => i.entity === entity) : state.invoices
  const sent = all.filter((i) => i.status === 'sent')
  const paid = all.filter((i) => i.status === 'paid' && i.paidDate)

  const settled = paid.filter((i) => i.issued)
  const monthStart = iso.slice(0, 7)

  return {
    outstanding: sent.reduce((s, i) => s + i.amount, 0),
    overdue: sent
      .filter((i) => i.due && daysBetween(i.due, iso) > 0)
      .sort((a, b) => a.due.localeCompare(b.due)),
    overdueValue: sent
      .filter((i) => i.due && daysBetween(i.due, iso) > 0)
      .reduce((s, i) => s + i.amount, 0),
    paidThisMonth: paid
      .filter((i) => i.paidDate.startsWith(monthStart))
      .reduce((s, i) => s + i.amount, 0),
    averageDaysToPay: settled.length
      ? settled.reduce((s, i) => s + daysBetween(i.issued, i.paidDate), 0) / settled.length
      : null,
  }
}

export interface Runway {
  cash: number
  monthlyBurn: number
  /** Months of cover. Infinity when nothing is going out. */
  months: number
  /** False until there are bills to burn — otherwise the number means nothing. */
  known: boolean
}

/** How long the cash lasts at the current outgoings. */
export function runway(state: AppState, purse: Purse): Runway {
  const account: AccountId =
    purse === 'consulting' ? 'consultingBank' : purse === 'onemedia' ? 'onemediaBank' : 'personalBank'
  const cash = accountBalance(state, account)
  const monthlyBurn = state.bills
    .filter((b) => b.purse === purse)
    .reduce((s, b) => s + monthlyCost(b), 0)
  return {
    cash,
    monthlyBurn,
    months: monthlyBurn > 0 ? cash / monthlyBurn : Infinity,
    known: monthlyBurn > 0,
  }
}

// ---------------------------------------------------------------------------
// Board layout
//
// The map reads as a board, not a list, so every node needs a position. Nodes
// that have been dragged keep theirs; the rest get a tidy tree — depth sets the
// column, and a parent sits at the mean of its children so the whole thing
// stays readable however lopsided the branches are.

export const NODE_W = 164
export const NODE_H = 66

export interface Placed {
  x: number
  y: number
}

/** Row pitch: one level of the hierarchy. */
const ROW = 132
/** Column pitch for adjacent leaves. */
const COL = 190

/**
 * A top-down hierarchy: the root at the top, its domains on the row beneath,
 * their sub-domains beneath those. Leaves take the next free column and a
 * parent centres over the span its children ended up occupying, which is what
 * keeps the branches from crossing however lopsided the tree gets.
 *
 * This replaced a radial layout. Radial looked more like a mind-map but read
 * as a scatter — with twenty-odd nodes you could not tell what sat under what,
 * which is the only thing the drawing is for.
 */
export function layoutDomains(domains: DomainNode[]): Map<string, Placed> {
  const out = new Map<string, Placed>()
  const children = (id: string) => domains.filter((d) => d.parentId === id)
  let column = 0

  const place = (node: DomainNode, depth: number): number => {
    const kids = children(node.id)
    let centre: number

    if (kids.length === 0) {
      centre = column * COL
      column++
    } else {
      const spans = kids.map((k) => place(k, depth + 1))
      centre = (Math.min(...spans) + Math.max(...spans)) / 2
    }

    // A hand-placed node keeps its spot; its subtree still lays out normally.
    out.set(node.id, {
      x: node.x ?? Math.round(centre - NODE_W / 2),
      y: node.y ?? depth * ROW,
    })
    return centre
  }

  const roots = domains.filter((d) => d.parentId === '')
  for (const root of roots) {
    place(root, 0)
    // A gap between separate trees, so two roots never read as one.
    column += 1
  }

  let stray = 0
  for (const node of domains) {
    if (!out.has(node.id)) {
      out.set(node.id, {
        x: node.x ?? column * COL + stray * COL,
        y: node.y ?? ROW,
      })
      stray++
    }
  }
  return out
}

/** Bounding box of the placed board, for zoom-to-fit. */
export function boardBounds(placed: Map<string, Placed>) {
  const points = [...placed.values()]
  if (points.length === 0) return { minX: 0, minY: 0, maxX: NODE_W, maxY: NODE_H }
  return {
    minX: Math.min(...points.map((p) => p.x)),
    minY: Math.min(...points.map((p) => p.y)),
    maxX: Math.max(...points.map((p) => p.x)) + NODE_W,
    maxY: Math.max(...points.map((p) => p.y)) + NODE_H,
  }
}

/**
 * A per-day score for every node over the window, oldest first — the series the
 * board draws inside each card. Computed in one bottom-up pass rather than by
 * re-scoring the tree once per day, which at 23 nodes × 28 days would be a walk
 * per cell.
 */
export function domainSeries(
  state: AppState,
  iso = todayISO(),
  window = 28,
): Map<string, number[]> {
  const dates: string[] = []
  for (let i = window - 1; i >= 0; i--) dates.push(addDays(iso, -i))
  const days = dates.map((d) => state.days[d]).filter(isLogged)
  const out = new Map<string, number[]>()
  if (days.length === 0) return out

  const ownDay = (node: DomainNode, day: DayEntry): number | null => {
    const parts: number[] = []
    for (const id of node.checkIds) {
      const item = CHECKLIST.find((c) => c.id === id)
      if (item) parts.push(isItemDone(item, day, state.targets) ? 100 : 0)
    }
    for (const key of node.metricKeys) {
      const spec = METRIC_BY_KEY[key]
      const target = state.targets[key as keyof AppState['targets']] as number
      if (!spec || !target) continue
      const v = day.metrics[key]
      const ratio = spec.invert ? (v <= target ? 1 : target / Math.max(v, 1)) : Math.min(1, v / target)
      parts.push(ratio * 100)
    }
    return parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : null
  }

  const resolve = (node: DomainNode): number[] | null => {
    const kids = state.domains.filter((d) => d.parentId === node.id)
    const kidSeries = kids.map(resolve).filter((s): s is number[] => s !== null)

    const mine = days.map((d) => ownDay(node, d))
    const hasOwn = mine.some((v) => v !== null)

    let series: number[] | null = null
    if (hasOwn) {
      series = mine.map((v) => v ?? 0)
    } else if (kidSeries.length) {
      series = days.map(
        (_, i) => kidSeries.reduce((s, k) => s + (k[i] ?? 0), 0) / kidSeries.length,
      )
    }
    if (series) out.set(node.id, series)
    return series
  }

  for (const root of state.domains.filter((d) => d.parentId === '')) resolve(root)
  return out
}

// ---------------------------------------------------------------------------
// Trackers
//
// A habit and a metric are the same object here — one is a tick, the other a
// number — so they share a streak rule: a day counts when the value clears its
// target, whichever direction the target points.

export interface TrackerStat {
  tracker: Tracker
  /** Today's value, 0 when nothing is logged. */
  value: number
  hit: boolean
  /** Consecutive days up to `iso` where the target was met. */
  streak: number
  /** Share of logged days in the window that met it. */
  rate: number
  days: number
  /** Values over the window, oldest first, for the sparkline. */
  series: number[]
  /** Mean of the logged values. Meaningless for a check, so null there. */
  average: number | null
}

/**
 * Whether a value counts as a win.
 *
 * Ceilings are the awkward case, because zero means two different things. For
 * "no lies today" zero *is* the win, so the day only has to have been logged.
 * For "in bed by 22:30" zero means the time was never entered — treating that
 * as a win gave every unfilled time tracker a perfect record. So a ceiling
 * above zero demands a real value, and a ceiling of zero demands a logged day.
 *
 * A floor of zero means no target at all: cash collected is worth recording
 * whatever the figure, so anything above zero counts.
 */
export function trackerHit(tracker: Tracker, value: number, logged: boolean): boolean {
  // Text has nothing to clear, so it is never a hit or a miss — only written.
  if (tracker.kind === 'text') return false
  if (tracker.kind === 'check') return value > 0
  if (tracker.direction === 'atMost') {
    return tracker.target === 0 ? logged && value === 0 : value > 0 && value <= tracker.target
  }
  if (tracker.target <= 0) return value > 0
  return value >= tracker.target
}

export function trackerStats(state: AppState, iso = todayISO(), window = 30): TrackerStat[] {
  const dates: string[] = []
  for (let i = window - 1; i >= 0; i--) dates.push(addDays(iso, -i))

  return state.trackers
    .filter((t) => !t.archived)
    .map((tracker) => {
      const logged = dates.filter((d) => isLogged(state.days[d]))
      const valueOn = (date: string) => state.days[date]?.trackers?.[tracker.id] ?? 0
      const loggedOn = (date: string) => isLogged(state.days[date])
      const hitOn = (date: string) => trackerHit(tracker, valueOn(date), loggedOn(date))

      let streak = 0
      let cursor = iso
      // Today only breaks a streak once it's closed — mid-morning shouldn't zero it.
      if (!hitOn(cursor)) {
        if (state.days[cursor]?.closed) {
          streak = 0
          cursor = ''
        } else {
          cursor = addDays(cursor, -1)
        }
      }
      while (cursor && hitOn(cursor)) {
        streak++
        cursor = addDays(cursor, -1)
      }

      const hits = logged.filter(hitOn).length
      const numbers = logged.map(valueOn).filter((v) => v > 0)

      return {
        tracker,
        value: valueOn(iso),
        hit: hitOn(iso),
        streak,
        rate: logged.length ? (hits / logged.length) * 100 : 0,
        days: logged.length,
        series: dates.map(valueOn),
        average:
          tracker.kind === 'number' && numbers.length
            ? numbers.reduce((a, b) => a + b, 0) / numbers.length
            : null,
      }
    })
}

// ---------------------------------------------------------------------------
// Revenue, year to date

export interface YearToDate {
  year: string
  revenue: number
  cashCollected: number
  profit: number
  payout: number
  /** Revenue by month, January first, for the chart. */
  monthly: number[]
  /** Same months, cash actually collected. */
  monthlyCash: number[]
  bestMonth: { month: number; amount: number } | null
}

/**
 * This calendar year's money for one business, or both. Revenue and cash are
 * kept apart on purpose: invoicing a number and banking it are different events
 * and confusing them is how a good year runs out of money.
 */
export function yearToDate(state: AppState, entity?: MoneyEntity, iso = todayISO()): YearToDate {
  const year = iso.slice(0, 4)
  const rows = state.ledger.filter(
    (e) => e.date.startsWith(year) && (!entity || e.entity === entity),
  )
  const sum = (kind: LedgerKind) =>
    rows.filter((e) => e.kind === kind).reduce((s, e) => s + e.amount, 0)

  const monthly = Array.from({ length: 12 }, () => 0)
  const monthlyCash = Array.from({ length: 12 }, () => 0)
  for (const e of rows) {
    const m = Number(e.date.slice(5, 7)) - 1
    if (m < 0 || m > 11) continue
    if (e.kind === 'revenue') monthly[m] += e.amount
    if (e.kind === 'cashCollected') monthlyCash[m] += e.amount
  }

  const best = monthly.reduce(
    (acc, amount, month) => (amount > (acc?.amount ?? 0) ? { month, amount } : acc),
    null as { month: number; amount: number } | null,
  )

  return {
    year,
    revenue: sum('revenue'),
    cashCollected: sum('cashCollected'),
    profit: sum('profit'),
    payout: sum('payout'),
    monthly,
    monthlyCash,
    bestMonth: best,
  }
}

// ---------------------------------------------------------------------------
// The week board
//
// `due` is when a task is owed; `scheduled` is when you intend to sit down and
// do it. Keeping them apart is the whole point — a week planned against
// deadlines tells you nothing about whether the week fits.

export interface BoardDay {
  date: string
  tasks: Task[]
  /** Estimated minutes of open work sitting on that day. */
  load: number
  capacity: number
  /** Load as a share of capacity. Over 100 means the day cannot hold it. */
  pct: number
  over: boolean
  /** Open tasks with no estimate, which the load silently excludes. */
  unestimated: number
}

export interface WeekBoard {
  days: BoardDay[]
  backlog: Task[]
  totalLoad: number
  totalCapacity: number
}

/** Highest priority first, then the longest job, then oldest. */
function boardOrder(a: Task, b: Task): number {
  if (a.done !== b.done) return a.done ? 1 : -1
  if (a.priority !== b.priority) return a.priority - b.priority
  if (a.estimateMin !== b.estimateMin) return b.estimateMin - a.estimateMin
  return a.created.localeCompare(b.created)
}

export function weekBoard(state: AppState, weekStart: string): WeekBoard {
  const capacity = state.targets.dailyCapacityMin || 480
  const days: BoardDay[] = []

  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i)
    const tasks = state.tasks.filter((t) => t.scheduled === date).sort(boardOrder)
    const open = tasks.filter((t) => !t.done)
    const load = open.reduce((s, t) => s + t.estimateMin, 0)
    days.push({
      date,
      tasks,
      load,
      capacity,
      pct: capacity > 0 ? (load / capacity) * 100 : 0,
      over: load > capacity,
      unestimated: open.filter((t) => t.estimateMin === 0).length,
    })
  }

  return {
    days,
    backlog: state.tasks.filter((t) => !t.scheduled && !t.done).sort(boardOrder),
    totalLoad: days.reduce((s, d) => s + d.load, 0),
    totalCapacity: capacity * 7,
  }
}

/** "2h 30m" — hours read better than 150 minutes once a day is being planned. */
export function durationLabel(minutes: number): string {
  if (minutes <= 0) return '—'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
