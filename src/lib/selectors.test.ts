import { describe, expect, it } from 'vitest'
import { DEFAULT_CHECKLIST } from './config'
import { addDays } from './date'
import {
  agenda,
  boardBounds,
  breakdownSignals,
  carriedPriorities,
  clientBook,
  contactStatus,
  domainPath,
  domainScores,
  domainSubtree,
  eventFallsOn,
  goalProgress,
  isLogged,
  keyResultProgress,
  layoutDomains,
  loopStats,
  monthGrid,
  oscillation,
  pipeline,
  planEffect,
  planStatus,
  priorityRun,
  scoreDay,
  taskQueue,
  trackerHit,
  trackerStats,
  upcomingEvents,
  upkeepStatus,
  weakestStandards,
  weekdayScores,
} from './selectors'
import {
  client,
  connection,
  day,
  daysMap,
  deal,
  goal,
  ledger,
  makeState,
  perfectMetrics,
  priority,
  task,
} from './fixtures'

const TODAY = '2026-03-01'

/** All the non-metric checklist ids, for building a maximum-scoring day. */
const MANUAL_CHECKS = Object.fromEntries(
  DEFAULT_CHECKLIST.filter((c) => !c.metric && c.id !== 'training').map((c) => [c.id, true]),
)

function perfectDay(date: string) {
  return day(date, {
    metrics: perfectMetrics(),
    checks: { ...MANUAL_CHECKS },
    trained: true,
  })
}

// ---------------------------------------------------------------------------

describe('scoreDay', () => {
  it('scores a perfect day at 100', () => {
    const s0 = makeState()
    expect(scoreDay(perfectDay('2026-01-01'), s0.targets, s0.checklist).score).toBe(100)
  })

  it('floors an empty day at the inverted standards, which zero satisfies', () => {
    // A ceiling is met at zero by definition, so a day with nothing logged
    // still earns the "under 30 minutes of scrolling" points. That is honest —
    // you genuinely didn't scroll — and it never reaches an average, because
    // every aggregate gates on isLogged first. Asserted here so the floor
    // moves only when someone means to move it.
    const floor = DEFAULT_CHECKLIST.filter((c) => c.invert).reduce((s, c) => s + c.points, 0)
    const s0 = makeState()
    expect(scoreDay(day('2026-01-01'), s0.targets, s0.checklist).score).toBe(floor)
  })

  it('grades a metric row off the number, not a separate tick', () => {
    const state = makeState()
    const under = day('2026-01-01', { metrics: { ...perfectMetrics(), protein: 100 } })
    const at = day('2026-01-01', { metrics: perfectMetrics() })
    expect(scoreDay(under, state.targets, state.checklist).score).toBeLessThan(
      scoreDay(at, state.targets, state.checklist).score,
    )
  })

  it('treats an inverted metric as a ceiling, so under target wins', () => {
    const state = makeState()
    const quiet = day('2026-01-01', { metrics: { ...perfectMetrics(), socialMin: 5 } })
    const loud = day('2026-01-01', { metrics: { ...perfectMetrics(), socialMin: 400 } })
    expect(scoreDay(quiet, state.targets, state.checklist).score).toBeGreaterThan(
      scoreDay(loud, state.targets, state.checklist).score,
    )
  })

  it('lets a scheduled recovery day satisfy the hours and training standards', () => {
    const state = makeState()
    const rest = day('2026-01-01', {
      metrics: { ...perfectMetrics(), consultingHours: 0 },
      checks: { ...MANUAL_CHECKS },
      restDay: true,
    })
    expect(scoreDay(rest, state.targets, state.checklist).score).toBe(100)
  })

  it('pillar points always sum to 100', () => {
    const total = DEFAULT_CHECKLIST.reduce((s, c) => s + c.points, 0)
    expect(total).toBe(100)
  })
})

describe('isLogged', () => {
  it('is false for an untouched day and true once anything is recorded', () => {
    expect(isLogged(undefined)).toBe(false)
    expect(isLogged(day('2026-01-01', { closed: false }))).toBe(false)
    expect(isLogged(day('2026-01-01', { closed: true }))).toBe(true)
  })

  it('does not count a day that has only been planned', () => {
    // Planning tomorrow tonight must not make tomorrow look like a zero-score day.
    const planned = day('2026-01-02', {
      closed: false,
      planned: true,
      priorities: [priority('p1', { text: 'ship it' })],
    })
    expect(isLogged(planned)).toBe(false)
  })
})

// ---------------------------------------------------------------------------

describe('planStatus', () => {
  it('ignores empty slots and treats the first filled one as the one thing', () => {
    const d = day('2026-01-01', {
      priorities: [
        priority('a', { text: 'the big one', done: true }),
        priority('b', { text: '' }),
        priority('c', { text: 'second', done: false }),
      ],
    })
    const p = planStatus(d)
    expect(p.set).toBe(2)
    expect(p.done).toBe(1)
    expect(p.oneThing?.text).toBe('the big one')
    expect(p.oneThingDone).toBe(true)
  })

  it('reports nothing for a day with no plan', () => {
    const p = planStatus(day('2026-01-01'))
    expect(p.set).toBe(0)
    expect(p.pct).toBe(0)
    expect(p.oneThing).toBeUndefined()
  })
})

describe('priorityRun', () => {
  it('counts only days that had a plan', () => {
    const state = makeState({
      days: daysMap([
        day('2026-01-01', { priorities: [priority('a', { text: 'x', done: true })] }),
        day('2026-01-02', { priorities: [priority('b', { text: 'y', done: false })] }),
        day('2026-01-03'),
      ]),
    })
    const run = priorityRun(state)
    expect(run.daysPlanned).toBe(2)
    expect(run.set).toBe(2)
    expect(run.done).toBe(1)
    expect(run.oneThingHit).toBe(1)
    expect(run.oneThingRate).toBe(50)
  })
})

describe('planEffect', () => {
  it('stays quiet until both sides have enough days', () => {
    const state = makeState({
      days: daysMap([
        day('2026-01-01', { priorities: [priority('a', { text: 'x' })] }),
        day('2026-01-02'),
      ]),
    })
    expect(planEffect(state).meaningful).toBe(false)
  })

  it('reports the gap once there are three of each', () => {
    const planned = [1, 2, 3].map((n) =>
      day(`2026-01-0${n}`, {
        ...perfectDay(`2026-01-0${n}`),
        priorities: [priority(`p${n}`, { text: 'x' })],
      }),
    )
    const unplanned = [4, 5, 6].map((n) => day(`2026-01-0${n}`))
    const state = makeState({ days: daysMap([...planned, ...unplanned]) })
    const effect = planEffect(state)
    expect(effect.meaningful).toBe(true)
    expect(effect.plannedDays).toBe(3)
    expect(effect.unplannedDays).toBe(3)
    expect(effect.delta).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------

describe('loopStats', () => {
  it('counts hits and the run of consecutive days up to today', () => {
    const days = [0, 1, 2].map((i) => day(addDays(TODAY, -i), { loops: ['l_avoid'] }))
    const state = makeState({ days: daysMap(days) })
    const stat = loopStats(state, TODAY).find((s) => s.loop.id === 'l_avoid')!
    expect(stat.count).toBe(3)
    expect(stat.streak).toBe(3)
    expect(stat.rate).toBe(100)
  })

  it('compares halves by rate, not raw count', () => {
    // Regression: with 20 logged days the older half holds fewer of them, so
    // counting alone reported every loop as rising.
    const days = Array.from({ length: 20 }, (_, i) =>
      day(addDays(TODAY, -i), { loops: i % 2 === 0 ? ['l_avoid'] : [] }),
    )
    const state = makeState({ days: daysMap(days) })
    const stat = loopStats(state, TODAY, 28).find((s) => s.loop.id === 'l_avoid')!
    // The loop fires at a steady every-other-day rate throughout.
    expect(stat.trend).toBe('flat')
  })

  it('will not name a trend without enough days in both halves', () => {
    const days = [0, 1, 2, 3].map((i) => day(addDays(TODAY, -i), { loops: ['l_avoid'] }))
    const state = makeState({ days: daysMap(days) })
    const stat = loopStats(state, TODAY, 28).find((s) => s.loop.id === 'l_avoid')!
    expect(stat.trend).toBe('flat')
  })

  it('calls a genuinely worsening loop rising', () => {
    const days = Array.from({ length: 28 }, (_, i) =>
      // Fires on every recent day, and none of the older ones.
      day(addDays(TODAY, -i), { loops: i < 14 ? ['l_avoid'] : [] }),
    )
    const state = makeState({ days: daysMap(days) })
    const stat = loopStats(state, TODAY, 28).find((s) => s.loop.id === 'l_avoid')!
    expect(stat.trend).toBe('rising')
  })
})

describe('carriedPriorities', () => {
  it('ranks by the longest unbroken run rather than total misses', () => {
    // Regression: "gym", missed often but never twice running, used to outrank
    // a genuinely stuck item because it had more total misses.
    const days = [
      day('2026-01-01', {
        priorities: [priority('a', { text: 'gym', done: false }), priority('b', { text: 'wall' })],
      }),
      day('2026-01-02', {
        priorities: [priority('c', { text: 'gym', done: true }), priority('d', { text: 'wall' })],
      }),
      day('2026-01-03', {
        priorities: [priority('e', { text: 'gym', done: false }), priority('f', { text: 'wall' })],
      }),
      day('2026-01-04', {
        priorities: [priority('g', { text: 'gym', done: true })],
      }),
      day('2026-01-05', {
        priorities: [priority('h', { text: 'gym', done: false })],
      }),
    ]
    const carried = carriedPriorities(makeState({ days: daysMap(days) }))
    expect(carried[0].text).toBe('wall')
    expect(carried[0].maxRun).toBe(3)
    expect(carried[0].ongoing).toBe(true)
    // Gym has more total misses but never two in a row, so it isn't a wall.
    const gym = carried.find((c) => c.text === 'gym')
    expect(gym).toBeUndefined()
  })

  it('matches the same intention regardless of case and spacing', () => {
    const days = [
      day('2026-01-01', { priorities: [priority('a', { text: 'Call  the bank' })] }),
      day('2026-01-02', { priorities: [priority('b', { text: 'call the bank' })] }),
    ]
    const carried = carriedPriorities(makeState({ days: daysMap(days) }))
    expect(carried).toHaveLength(1)
    expect(carried[0].maxRun).toBe(2)
  })

  it('marks a run that was eventually closed as not ongoing', () => {
    const days = [
      day('2026-01-01', { priorities: [priority('a', { text: 'wall' })] }),
      day('2026-01-02', { priorities: [priority('b', { text: 'wall' })] }),
      day('2026-01-03', { priorities: [priority('c', { text: 'wall', done: true })] }),
    ]
    const carried = carriedPriorities(makeState({ days: daysMap(days) }))
    expect(carried[0].ongoing).toBe(false)
    expect(carried[0].everDone).toBe(true)
  })
})

describe('weakestStandards and breakdownSignals', () => {
  it('say nothing below the minimum sample', () => {
    const state = makeState({ days: daysMap([day('2026-01-01'), day('2026-01-02')]) })
    expect(weakestStandards(state)).toEqual([])
    expect(breakdownSignals(state)).toEqual([])
  })

  it('ranks standards by cost, not by how often they slip', () => {
    // A cheap standard missed always, against an expensive one missed often.
    const days = Array.from({ length: 10 }, (_, i) =>
      day(`2026-01-${String(i + 1).padStart(2, '0')}`, {
        checks: { ...MANUAL_CHECKS, grooming: false, measurable: i < 3 },
        metrics: perfectMetrics(),
        trained: true,
      }),
    )
    const weak = weakestStandards(makeState({ days: daysMap(days) }))
    const grooming = weak.find((w) => w.id === 'grooming')!
    const measurable = weak.find((w) => w.id === 'measurable')!
    expect(grooming.rate).toBe(100)
    expect(measurable.rate).toBe(70)
    // 70% of 6 points outranks 100% of 1 point.
    expect(weak.indexOf(measurable)).toBeLessThan(weak.indexOf(grooming))
  })

  it('compares winning against breakdown days once there are three of each', () => {
    const winning = [1, 2, 3].map((n) => perfectDay(`2026-01-0${n}`))
    const losing = [4, 5, 6].map((n) =>
      day(`2026-01-0${n}`, { metrics: { ...perfectMetrics(), sleepHours: 4, steps: 0 } }),
    )
    const signals = breakdownSignals(makeState({ days: daysMap([...winning, ...losing]) }))
    expect(signals.length).toBeGreaterThan(0)
    const steps = signals.find((s) => s.key === 'steps')!
    expect(steps.gap).toBeGreaterThan(0)
    expect(steps.winning).toBe(10000)
    expect(steps.losing).toBe(0)
  })
})

describe('weekdayScores', () => {
  it('buckets by day of week and leaves unlogged weekdays empty', () => {
    // 2026-01-05 is a Monday.
    const state = makeState({ days: daysMap([perfectDay('2026-01-05')]) })
    const rows = weekdayScores(state)
    expect(rows[1].label).toBe('Monday')
    expect(rows[1].days).toBe(1)
    expect(rows[1].avg).toBe(100)
    expect(rows[2].days).toBe(0)
  })
})

// ---------------------------------------------------------------------------

describe('oscillation', () => {
  it('stays quiet until there is enough to call a cycle', () => {
    const state = makeState({ days: daysMap([perfectDay('2026-02-01')]) })
    expect(oscillation(state, TODAY).enough).toBe(false)
  })

  it('splits the curve into build and break phases around the mean', () => {
    // Ten strong days then ten weak ones: one build, one break.
    const days = Array.from({ length: 20 }, (_, i) => {
      const date = addDays(TODAY, -(19 - i))
      return i < 10
        ? perfectDay(date)
        : day(date, { metrics: { ...perfectMetrics(), consultingHours: 0, steps: 0, protein: 0 } })
    })
    const osc = oscillation(makeState({ days: daysMap(days) }), TODAY)
    expect(osc.enough).toBe(true)
    expect(osc.swings[0].kind).toBe('build')
    expect(osc.current?.kind).toBe('break')
    expect(osc.mean).toBeGreaterThan(0)
    expect(osc.mean).toBeLessThan(100)
  })

  it('reports a falling mean when the run deteriorates', () => {
    const days = Array.from({ length: 30 }, (_, i) => {
      const date = addDays(TODAY, -(29 - i))
      return i < 15 ? perfectDay(date) : day(date)
    })
    const osc = oscillation(makeState({ days: daysMap(days) }), TODAY)
    expect(osc.drift).toBeLessThan(0)
  })

  it('carries the last value across an unlogged gap instead of scoring it zero', () => {
    // A missed day is missing data, not a crash. Two runs that differ only by
    // a gap in the middle must not produce wildly different minima.
    const solid = Array.from({ length: 20 }, (_, i) => perfectDay(addDays(TODAY, -(19 - i))))
    const gapped = solid.filter((d) => d.date !== addDays(TODAY, -10))

    const a = oscillation(makeState({ days: daysMap(solid) }), TODAY)
    const b = oscillation(makeState({ days: daysMap(gapped) }), TODAY)
    const lowest = (o: typeof a) => Math.min(...o.points.map((p) => p.smooth))
    expect(lowest(b)).toBeGreaterThan(90)
    expect(Math.abs(lowest(a) - lowest(b))).toBeLessThan(1)
  })
})

// ---------------------------------------------------------------------------

describe('the life map', () => {
  it('scores a leaf off its own bindings', () => {
    const days = Array.from({ length: 10 }, (_, i) =>
      day(addDays(TODAY, -i), { metrics: { ...perfectMetrics(), sleepHours: 4 } }),
    )
    const scores = domainScores(makeState({ days: daysMap(days) }), TODAY)
    // Recovery is bound to sleep, target 8, logged 4 — half attainment.
    expect(scores.get('recovery')!.score).toBeCloseTo(50, 0)
  })

  it('lets a parent with no bindings inherit the mean of its children', () => {
    const state = makeState({
      domains: [
        { id: 'root', parentId: '', label: 'Root', note: '', loopIds: [], checkIds: [], metricKeys: [] },
        { id: 'a', parentId: 'root', label: 'A', note: '', loopIds: [], checkIds: ['grooming'], metricKeys: [] },
        { id: 'b', parentId: 'root', label: 'B', note: '', loopIds: [], checkIds: ['notes'], metricKeys: [] },
      ],
      days: daysMap(
        Array.from({ length: 10 }, (_, i) =>
          day(addDays(TODAY, -i), { checks: { grooming: true, notes: false } }),
        ),
      ),
    })
    const scores = domainScores(state, TODAY)
    expect(scores.get('a')!.score).toBe(100)
    expect(scores.get('b')!.score).toBe(0)
    expect(scores.get('root')!.score).toBe(50)
  })

  it('reports no score rather than zero for a branch bound to nothing', () => {
    const state = makeState({
      domains: [
        { id: 'root', parentId: '', label: 'Root', note: '', loopIds: [], checkIds: [], metricKeys: [] },
      ],
      days: daysMap([day(TODAY)]),
    })
    expect(domainScores(state, TODAY).get('root')!.score).toBeNull()
  })

  it('rolls loop hits up from the children', () => {
    const days = [0, 1].map((i) => day(addDays(TODAY, -i), { loops: ['l_avoid'] }))
    const scores = domainScores(makeState({ days: daysMap(days) }), TODAY)
    // l_avoid is bound to Sales, which sits under Consulting.ie, under Wealth.
    expect(scores.get('consulting_sales')!.loopHits).toBe(2)
    expect(scores.get('wealth')!.loopHits).toBeGreaterThanOrEqual(2)
  })

  it('walks the subtree and the path', () => {
    const state = makeState()
    const under = domainSubtree(state.domains, 'body')
    expect(under).toContain('body')
    expect(under).toContain('training')
    expect(under).not.toContain('wealth')
    expect(domainPath(state.domains, 'training').map((d) => d.id)).toEqual(['root', 'health', 'body'])
  })
})

// ---------------------------------------------------------------------------

describe('pipeline', () => {
  it('weights open deals by their own probability and excludes closed ones', () => {
    const state = makeState({
      deals: [
        deal('a', { stage: 'qualified', value: 10_000, probability: 30 }),
        deal('b', { stage: 'proposal', value: 20_000, probability: 50 }),
        deal('c', { stage: 'won', value: 50_000, probability: 100 }),
        deal('d', { stage: 'lost', value: 5_000, probability: 0 }),
      ],
    })
    const p = pipeline(state, undefined, TODAY)
    expect(p.value).toBe(30_000)
    expect(p.weighted).toBe(13_000)
    expect(p.won).toBe(50_000)
    expect(p.winRate).toBe(50)
  })

  it('flags an open deal that has not moved in a fortnight', () => {
    const state = makeState({
      deals: [
        deal('fresh', { stage: 'lead', moved: addDays(TODAY, -3) }),
        deal('stale', { stage: 'lead', moved: addDays(TODAY, -20) }),
        deal('old-but-won', { stage: 'won', moved: addDays(TODAY, -90) }),
      ],
    })
    const stale = pipeline(state, undefined, TODAY).stale.map((d) => d.id)
    expect(stale).toEqual(['stale'])
  })

  it('filters to one business', () => {
    const state = makeState({
      deals: [
        deal('a', { entity: 'consulting', stage: 'lead', value: 1000, probability: 100 }),
        deal('b', { entity: 'onemedia', stage: 'lead', value: 9000, probability: 100 }),
      ],
    })
    expect(pipeline(state, 'consulting', TODAY).value).toBe(1000)
  })
})

describe('clientBook', () => {
  it('sums MRR from active clients only and measures concentration', () => {
    const state = makeState({
      clients: [
        client('a', { monthlyValue: 7000 }),
        client('b', { monthlyValue: 3000 }),
        client('c', { monthlyValue: 5000, status: 'churned' }),
      ],
    })
    const book = clientBook(state, undefined, TODAY)
    expect(book.mrr).toBe(10_000)
    expect(book.concentration).toBe(70)
  })

  it('surfaces renewals inside thirty days', () => {
    const state = makeState({
      clients: [
        client('soon', { renewal: addDays(TODAY, 10) }),
        client('later', { renewal: addDays(TODAY, 90) }),
      ],
    })
    expect(clientBook(state, undefined, TODAY).renewalsDue.map((c) => c.id)).toEqual(['soon'])
  })
})

describe('taskQueue', () => {
  it('splits open tasks by how late they already are', () => {
    const state = makeState({
      tasks: [
        task('late', { due: addDays(TODAY, -1) }),
        task('now', { due: TODAY }),
        task('soon', { due: addDays(TODAY, 3) }),
        task('far', { due: addDays(TODAY, 30) }),
        task('undated'),
        task('done', { done: true, due: addDays(TODAY, -5) }),
      ],
    })
    const q = taskQueue(state, TODAY)
    expect(q.overdue.map((t) => t.id)).toEqual(['late'])
    expect(q.today.map((t) => t.id)).toEqual(['now'])
    expect(q.soon.map((t) => t.id)).toEqual(['soon'])
    expect(q.someday.map((t) => t.id).sort()).toEqual(['far', 'undated'])
    expect(q.openCount).toBe(5)
  })
})

// ---------------------------------------------------------------------------

describe('goals', () => {
  it('reads a key result out of the ledger rather than a typed number', () => {
    const state = makeState({
      ledger: [
        ledger('a', { kind: 'payout', amount: 250_000 }),
        ledger('b', { kind: 'payout', amount: 250_000 }),
        ledger('c', { kind: 'revenue', amount: 900_000 }),
      ],
    })
    const kr = {
      id: 'k',
      label: 'Payout received',
      source: 'ledger' as const,
      ref: 'payout',
      target: 1_000_000,
      current: 0,
      unit: '€',
    }
    const p = keyResultProgress(state, kr)
    expect(p.current).toBe(500_000)
    expect(p.pct).toBe(50)
  })

  it('totals a daily metric across logged days', () => {
    const state = makeState({
      days: daysMap([
        day('2026-01-01', { metrics: { ...perfectMetrics(), pagesRead: 20 } }),
        day('2026-01-02', { metrics: { ...perfectMetrics(), pagesRead: 30 } }),
      ]),
    })
    const p = keyResultProgress(state, {
      id: 'k',
      label: 'Pages',
      source: 'metric',
      ref: 'pagesRead',
      target: 100,
      current: 0,
      unit: '',
    })
    expect(p.current).toBe(50)
  })

  it('averages the key results into the goal', () => {
    const state = makeState({
      ledger: [ledger('a', { kind: 'payout', amount: 500_000 })],
      goals: [
        goal('g', {
          keyResults: [
            { id: 'k1', label: 'Payout', source: 'ledger', ref: 'payout', target: 1_000_000, current: 0, unit: '€' },
            { id: 'k2', label: 'Manual', source: 'manual', ref: '', target: 10, current: 10, unit: '' },
          ],
        }),
      ],
    })
    expect(goalProgress(state, state.goals[0], TODAY).pct).toBe(75)
  })

  it('falls back to done-or-not with no key results', () => {
    const state = makeState({ goals: [goal('g', { done: true })] })
    expect(goalProgress(state, state.goals[0], TODAY).pct).toBe(100)
  })

  it('caps a key result at 100 when it overshoots', () => {
    const state = makeState({ ledger: [ledger('a', { kind: 'payout', amount: 5_000_000 })] })
    const p = keyResultProgress(state, {
      id: 'k', label: 'x', source: 'ledger', ref: 'payout', target: 1_000_000, current: 0, unit: '€',
    })
    expect(p.pct).toBe(100)
  })
})

// ---------------------------------------------------------------------------

describe('network and upkeep', () => {
  it('treats a tracked person never spoken to as due', () => {
    const s = contactStatus(connection('a', { cadenceDays: 7 }), TODAY)
    expect(s.tracked).toBe(true)
    expect(s.due).toBe(true)
    expect(s.daysSince).toBeNull()
  })

  it('never nags about someone with no cadence', () => {
    const s = contactStatus(connection('a', { lastContact: '2020-01-01' }), TODAY)
    expect(s.tracked).toBe(false)
    expect(s.due).toBe(false)
  })

  it('counts down and then over', () => {
    const early = contactStatus(
      connection('a', { cadenceDays: 14, lastContact: addDays(TODAY, -4) }),
      TODAY,
    )
    expect(early.dueIn).toBe(10)
    expect(early.due).toBe(false)

    const over = contactStatus(
      connection('b', { cadenceDays: 14, lastContact: addDays(TODAY, -20) }),
      TODAY,
    )
    expect(over.due).toBe(true)
    expect(over.daysSince).toBe(20)
  })

  it('restarts the upkeep clock from the day it was ticked', () => {
    const fresh = upkeepStatus(
      { id: 'u', label: 'Haircut', intervalDays: 14, lastDone: addDays(TODAY, -2) },
      TODAY,
    )
    expect(fresh.overdue).toBe(false)
    const late = upkeepStatus(
      { id: 'u', label: 'Haircut', intervalDays: 14, lastDone: addDays(TODAY, -20) },
      TODAY,
    )
    expect(late.overdue).toBe(true)
  })
})

describe('board layout', () => {
  it('places every node, including one orphaned by an edit', () => {
    const state = makeState({
      domains: [
        ...makeState().domains,
        {
          id: 'orphan',
          parentId: 'deleted-parent',
          label: 'Orphan',
          note: '',
          loopIds: [],
          checkIds: [],
          metricKeys: [],
        },
      ],
    })
    const placed = layoutDomains(state.domains)
    expect(placed.size).toBe(state.domains.length)
    for (const node of state.domains) {
      const at = placed.get(node.id)!
      expect(Number.isFinite(at.x)).toBe(true)
      expect(Number.isFinite(at.y)).toBe(true)
    }
  })

  it('lets a hand-placed node override the automatic position', () => {
    const domains = makeState().domains.map((d) =>
      d.id === 'recovery' ? { ...d, x: 1234, y: -56 } : d,
    )
    const placed = layoutDomains(domains)
    expect(placed.get('recovery')).toEqual({ x: 1234, y: -56 })
    // Its siblings still lay out automatically around it.
    expect(placed.get('appearance')!.x).not.toBe(1234)
  })

  it('puts the root on top with each level on the row beneath', () => {
    const state = makeState()
    const placed = layoutDomains(state.domains)
    const root = placed.get('root')!
    // Every other node sits below the root, and depth strictly increases the row.
    for (const [id, p] of placed) {
      if (id !== 'root') expect(p.y).toBeGreaterThan(root.y)
    }
    expect(placed.get('health')!.y).toBeLessThan(placed.get('body')!.y)
    expect(placed.get('body')!.y).toBeLessThan(placed.get('training')!.y)
  })

  it('centres a parent over the children it spans', () => {
    const placed = layoutDomains(makeState().domains)
    const body = placed.get('body')!
    const kids = ['training', 'nutrition', 'movement'].map((id) => placed.get(id)!)
    const left = Math.min(...kids.map((k) => k.x))
    const right = Math.max(...kids.map((k) => k.x))
    expect(body.x).toBeGreaterThanOrEqual(left - 1)
    expect(body.x).toBeLessThanOrEqual(right + 1)
  })

  it('bounds the whole board, including nodes in negative space', () => {
    const placed = layoutDomains(makeState().domains)
    const b = boardBounds(placed)
    expect(b.maxX).toBeGreaterThan(b.minX)
    expect(b.maxY).toBeGreaterThan(b.minY)
    for (const p of placed.values()) {
      expect(p.x).toBeGreaterThanOrEqual(b.minX)
      expect(p.y).toBeGreaterThanOrEqual(b.minY)
    }
  })
})

describe('trackers', () => {
  const habit = (over: Partial<import('./types').Tracker> = {}) => ({
    id: 't',
    label: 'Test',
    kind: 'check' as const,
    unit: '',
    target: 1,
    direction: 'atLeast' as const,
    group: '',
    archived: false,
    ...over,
  })

  it('lets a ceiling of zero be won on a logged day', () => {
    // Regression: "no lies today" was impossible to hit, because a ceiling
    // demanded a value above zero to distinguish it from an unlogged day.
    const t = habit({ kind: 'number', target: 0, direction: 'atMost' })
    expect(trackerHit(t, 0, true)).toBe(true)
    expect(trackerHit(t, 1, true)).toBe(false)
    // An unlogged day is still not a free win.
    expect(trackerHit(t, 0, false)).toBe(false)
  })

  it('does not credit an unentered time against its cut-off', () => {
    // Regression: an unset time is 0, and 0 is before any cut-off, so every
    // time tracker reported a perfect record until one was actually filled in.
    const t = habit({ kind: 'time', target: 6 * 60, direction: 'atMost' })
    expect(trackerHit(t, 0, true)).toBe(false)
    expect(trackerHit(t, 5 * 60 + 30, true)).toBe(true)
    expect(trackerHit(t, 7 * 60, true)).toBe(false)
  })

  it('treats a floor of zero as no target at all', () => {
    const t = habit({ kind: 'number', target: 0, direction: 'atLeast' })
    expect(trackerHit(t, 0, true)).toBe(false)
    expect(trackerHit(t, 250, true)).toBe(true)
  })

  it('scores a rating against its threshold', () => {
    const t = habit({ kind: 'rating', target: 7 })
    expect(trackerHit(t, 6, true)).toBe(false)
    expect(trackerHit(t, 7, true)).toBe(true)
  })

  it('never scores a text tracker', () => {
    expect(trackerHit(habit({ kind: 'text' }), 5, true)).toBe(false)
  })

  it('counts a streak and stops at the first miss', () => {
    const t = habit({ id: 'tk', kind: 'check' })
    const days = [0, 1, 2, 4].map((i) =>
      day(addDays(TODAY, -i), { trackers: { tk: i === 4 ? 1 : 1 } }),
    )
    // Day 3 back is missing entirely, which breaks the run.
    const state = makeState({ trackers: [t], days: daysMap(days) })
    const stat = trackerStats(state, TODAY)[0]
    expect(stat.streak).toBe(3)
    expect(stat.hit).toBe(true)
  })
})

describe('calendar repeats', () => {
  const ev = (over: Partial<import('./types').CalendarEvent> = {}) => ({
    id: 'e',
    title: 'Thing',
    date: '2026-01-15',
    time: '',
    durationMin: 0,
    repeat: 'none' as const,
    tag: 'life' as const,
    notes: '',
    remindDays: 3,
    ...over,
  })

  it('lands a one-off only on its own date', () => {
    const e = ev()
    expect(eventFallsOn(e, '2026-01-15')).toBe(true)
    expect(eventFallsOn(e, '2026-01-16')).toBe(false)
    expect(eventFallsOn(e, '2027-01-15')).toBe(false)
  })

  it('never falls before it starts', () => {
    const e = ev({ repeat: 'yearly' })
    expect(eventFallsOn(e, '2025-01-15')).toBe(false)
  })

  it('repeats weekly on the same weekday', () => {
    // 2026-01-15 is a Thursday.
    const e = ev({ repeat: 'weekly' })
    expect(eventFallsOn(e, '2026-01-22')).toBe(true)
    expect(eventFallsOn(e, '2026-01-23')).toBe(false)
  })

  it('repeats yearly, and survives a leap day', () => {
    const birthday = ev({ date: '2024-02-29', repeat: 'yearly' })
    expect(eventFallsOn(birthday, '2028-02-29')).toBe(true)
    // 2027 has no 29th, so it lands on the 28th rather than vanishing.
    expect(eventFallsOn(birthday, '2027-02-28')).toBe(true)
    expect(eventFallsOn(birthday, '2027-03-01')).toBe(false)
  })

  it('clamps a monthly repeat to the last day of a short month', () => {
    const e = ev({ date: '2026-01-31', repeat: 'monthly' })
    expect(eventFallsOn(e, '2026-03-31')).toBe(true)
    // February stops at the 28th, so that is where it lands.
    expect(eventFallsOn(e, '2026-02-28')).toBe(true)
    expect(eventFallsOn(e, '2026-02-27')).toBe(false)
  })
})

describe('agenda', () => {
  it('lists only the days that have something on them', () => {
    const state = makeState({
      events: [
        {
          id: 'e1',
          title: 'Dentist',
          date: addDays(TODAY, 2),
          time: '09:00',
          durationMin: 30,
          repeat: 'none',
          tag: 'life',
          notes: '',
          remindDays: 3,
        },
      ],
      tasks: [task('t1', { scheduled: addDays(TODAY, 2) }), task('t2', { due: addDays(TODAY, 5) })],
    })
    const list = agenda(state, TODAY, 10)
    expect(list.map((d) => d.date)).toEqual([addDays(TODAY, 2), addDays(TODAY, 5)])
    expect(list[0].events).toHaveLength(1)
    expect(list[0].scheduled).toHaveLength(1)
    expect(list[1].due).toHaveLength(1)
  })

  it('does not list a task twice when it is scheduled on the day it is due', () => {
    const state = makeState({
      tasks: [task('t', { scheduled: addDays(TODAY, 1), due: addDays(TODAY, 1) })],
    })
    const day = agenda(state, TODAY, 5)[0]
    expect(day.scheduled).toHaveLength(1)
    expect(day.due).toHaveLength(0)
  })

  it('only surfaces an event once it is inside its reminder window', () => {
    const far = {
      id: 'e',
      title: 'Renewal',
      date: addDays(TODAY, 20),
      time: '',
      durationMin: 0,
      repeat: 'none' as const,
      tag: 'life' as const,
      notes: '',
      remindDays: 3,
    }
    expect(upcomingEvents(makeState({ events: [far] }), TODAY, 30)).toHaveLength(0)
    const near = { ...far, date: addDays(TODAY, 2) }
    expect(upcomingEvents(makeState({ events: [near] }), TODAY, 30)).toHaveLength(1)
  })
})

describe('monthGrid', () => {
  it('returns six Monday-first weeks around the anchor month', () => {
    const cells = monthGrid(makeState(), '2026-03-15', TODAY)
    expect(cells).toHaveLength(42)
    // 1 March 2026 is a Sunday, so a Monday-first grid opens on 23 February.
    expect(cells[0].date).toBe('2026-02-23')
    expect(cells[0].inMonth).toBe(false)
    expect(cells.filter((c) => c.inMonth)).toHaveLength(31)
  })
})
