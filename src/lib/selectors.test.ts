import { describe, expect, it } from 'vitest'
import { CHECKLIST } from './config'
import { addDays } from './date'
import {
  breakdownSignals,
  carriedPriorities,
  clientBook,
  contactStatus,
  domainPath,
  domainScores,
  domainSubtree,
  goalProgress,
  isLogged,
  keyResultProgress,
  loopStats,
  oscillation,
  pipeline,
  planEffect,
  planStatus,
  priorityRun,
  scoreDay,
  taskQueue,
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
  CHECKLIST.filter((c) => !c.metric && c.id !== 'training').map((c) => [c.id, true]),
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
    expect(scoreDay(perfectDay('2026-01-01'), makeState().targets).score).toBe(100)
  })

  it('floors an empty day at the inverted standards, which zero satisfies', () => {
    // A ceiling is met at zero by definition, so a day with nothing logged
    // still earns the "under 30 minutes of scrolling" points. That is honest —
    // you genuinely didn't scroll — and it never reaches an average, because
    // every aggregate gates on isLogged first. Asserted here so the floor
    // moves only when someone means to move it.
    const floor = CHECKLIST.filter((c) => c.invert).reduce((s, c) => s + c.points, 0)
    expect(scoreDay(day('2026-01-01'), makeState().targets).score).toBe(floor)
  })

  it('grades a metric row off the number, not a separate tick', () => {
    const state = makeState()
    const under = day('2026-01-01', { metrics: { ...perfectMetrics(), protein: 100 } })
    const at = day('2026-01-01', { metrics: perfectMetrics() })
    expect(scoreDay(under, state.targets).score).toBeLessThan(
      scoreDay(at, state.targets).score,
    )
  })

  it('treats an inverted metric as a ceiling, so under target wins', () => {
    const state = makeState()
    const quiet = day('2026-01-01', { metrics: { ...perfectMetrics(), socialMin: 5 } })
    const loud = day('2026-01-01', { metrics: { ...perfectMetrics(), socialMin: 400 } })
    expect(scoreDay(quiet, state.targets).score).toBeGreaterThan(
      scoreDay(loud, state.targets).score,
    )
  })

  it('lets a scheduled recovery day satisfy the hours and training standards', () => {
    const state = makeState()
    const rest = day('2026-01-01', {
      metrics: { ...perfectMetrics(), acmrHours: 0 },
      checks: { ...MANUAL_CHECKS },
      restDay: true,
    })
    expect(scoreDay(rest, state.targets).score).toBe(100)
  })

  it('pillar points always sum to 100', () => {
    const total = CHECKLIST.reduce((s, c) => s + c.points, 0)
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
        : day(date, { metrics: { ...perfectMetrics(), acmrHours: 0, steps: 0, protein: 0 } })
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
    // l_avoid is bound to Sales, which sits under ACMR, under Wealth.
    expect(scores.get('acmr_sales')!.loopHits).toBe(2)
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
        deal('a', { entity: 'acmr', stage: 'lead', value: 1000, probability: 100 }),
        deal('b', { entity: 'onemedia', stage: 'lead', value: 9000, probability: 100 }),
      ],
    })
    expect(pipeline(state, 'acmr', TODAY).value).toBe(1000)
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
