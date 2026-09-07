import { writeFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import { DEFAULT_CHECKLIST } from './config'
import { addDays } from './date'
import { briefing } from './advisor'
import {
  agenda,
  breakdownSignals,
  carriedPriorities,
  domainScores,
  domainSeries,
  loopStats,
  monthGrid,
  oscillation,
  search,
  trackerStats,
  weekBoard,
} from './selectors'
import { day, daysMap, deal, makeState, perfectMetrics, priority, task } from './fixtures'

/**
 * A budget, not a benchmark.
 *
 * Everything on screen is derived on every render, and the store hands out a
 * new state object on every keystroke — so a selector that creeps into the tens
 * of milliseconds turns typing in the journal into a slideshow.
 *
 * Measured against a year of days, 300 tasks and 80 deals, every selector here
 * runs in well under a millisecond and a whole screen's worth together is about
 * 3ms. The budgets sit at roughly fifteen times that: loose enough that a slow,
 * noisy CI machine won't fail on jitter, tight enough to catch something going
 * quadratic. A test that fails on timing noise gets ignored, which is worse
 * than not having one.
 *
 * The last run's actual figures land in `perf-report.json`.
 */

const TODAY = '2026-12-31'
const YEAR = 365

/** A full year of logged days, which is more than the protocol will ever hold. */
function yearOfDays() {
  const manual = DEFAULT_CHECKLIST.filter((c) => !c.metric && c.id !== 'training').map((c) => c.id)
  return Array.from({ length: YEAR }, (_, i) => {
    const date = addDays(TODAY, -(YEAR - 1 - i))
    const q = (Math.sin(i / 3.3) * 0.5 + 0.5) * 0.8 + 0.1
    const checks: Record<string, boolean> = {}
    for (const id of manual) checks[id] = q > 0.5
    return day(date, {
      checks,
      metrics: { ...perfectMetrics(), sleepHours: 4 + 4 * q, steps: Math.round(11000 * q) },
      trained: q > 0.45,
      loops: q < 0.4 ? ['l_avoid', 'l_scroll'] : [],
      priorities: [
        priority(`${date}-1`, { text: 'Close the retainer', done: q > 0.6 }),
        priority(`${date}-2`, { text: 'Content batch', done: q > 0.5 }),
      ],
      trackers: { tk_cold: q > 0.5 ? 1 : 0, tk_focus: Math.round(q * 10) },
    })
  })
}

function bigState() {
  return makeState({
    startDate: addDays(TODAY, -YEAR),
    days: daysMap(yearOfDays()),
    tasks: Array.from({ length: 300 }, (_, i) =>
      task(`t${i}`, {
        title: `Task number ${i}`,
        scheduled: i % 3 === 0 ? addDays(TODAY, i % 7) : '',
        estimateMin: 30,
      }),
    ),
    deals: Array.from({ length: 80 }, (_, i) => deal(`d${i}`, { value: 1000 * i })),
  })
}

/** Runs `fn` a few times and returns the fastest, to blunt GC noise. */
function fastest(fn: () => unknown, runs = 3): number {
  let best = Infinity
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now()
    fn()
    best = Math.min(best, performance.now() - t0)
  }
  return best
}

describe('selector budgets at a year of data', () => {
  const state = bigState()
  // Vitest swallows console output from passing tests, so the measurements go
  // to a file. Seeing the headroom is the point — a budget you can't watch
  // creep is a budget you don't really have.
  const measured: Record<string, number> = {}
  afterAll(() => {
    try {
      writeFileSync('perf-report.json', JSON.stringify(measured, null, 2))
    } catch {
      /* Read-only checkout, or no filesystem. The assertions still ran. */
    }
  })

  const cases: [string, () => unknown, number][] = [
    ['oscillation', () => oscillation(state, TODAY), 15],
    ['domainScores', () => domainScores(state, TODAY), 15],
    ['domainSeries', () => domainSeries(state, TODAY), 15],
    ['loopStats', () => loopStats(state, TODAY), 15],
    ['carriedPriorities', () => carriedPriorities(state), 15],
    ['breakdownSignals', () => breakdownSignals(state), 15],
    ['trackerStats', () => trackerStats(state, TODAY), 15],
    ['weekBoard', () => weekBoard(state, addDays(TODAY, -3)), 15],
    ['agenda', () => agenda(state, TODAY, 30), 15],
    ['monthGrid', () => monthGrid(state, TODAY), 15],
    ['search', () => search(state, 'task'), 15],
    // The briefing calls most of the above, so its budget is the sum-ish.
    ['briefing', () => briefing(state, TODAY), 45],
  ]

  for (const [name, fn, budget] of cases) {
    it(`${name} stays under ${budget}ms`, () => {
      const ms = fastest(fn)
      measured[name] = Number(ms.toFixed(2))
      expect(ms).toBeLessThan(budget)
    })
  }

  it('a whole screen of selectors together stays interactive', () => {
    // Roughly what Alex computes on one render — about 3ms in practice. This is
    // the number that decides whether typing anywhere in the app feels instant.
    const ms = fastest(() => {
      oscillation(state, TODAY)
      domainScores(state, TODAY)
      weekBoard(state, TODAY)
      briefing(state, TODAY)
    })
    measured['one screen'] = Number(ms.toFixed(2))
    expect(ms).toBeLessThan(50)
  })
})
