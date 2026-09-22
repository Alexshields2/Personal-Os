import { beforeEach, describe, expect, it } from 'vitest'
import { HABITS } from './config'
import { hoursMinutes, sleepMinutes } from './date'
import { day, daysMap, makeState, task } from './fixtures'
import { EMPTY_METRICS } from './types'
import { consistency, dayProgress, lastGymSets, missedGymCount, progressTone, todoFor } from './selectors'
import { actions, getState, hydrate } from './store'

/**
 * The one-page day. The arithmetic worth pinning down is the part the page
 * does for you — hours slept, calorie and protein totals, whether it was a
 * gym day — and the rules for which of Work's tasks land on the to-do.
 */

describe('sleep', () => {
  it('wraps midnight', () => {
    expect(sleepMinutes('23:30', '06:00')).toBe(390)
    expect(sleepMinutes('00:30', '06:00')).toBe(330)
  })

  it('waits for both times', () => {
    expect(sleepMinutes('', '06:00')).toBeNull()
    expect(sleepMinutes('23:00', '')).toBeNull()
  })

  it('reads as hours and minutes', () => {
    expect(hoursMinutes(390)).toBe('6h 30m')
    expect(hoursMinutes(420)).toBe('7h')
  })
})

describe('the to-do list comes from Work', () => {
  const TODAY = '2026-09-22'
  const YESTERDAY = '2026-09-21'
  const state = makeState({
    tasks: [
      task('today', { title: 'Scheduled today', scheduled: TODAY }),
      task('carried', { title: 'Left open yesterday', scheduled: YESTERDAY }),
      task('finished', { title: 'Done yesterday', scheduled: YESTERDAY, done: true, doneDate: YESTERDAY }),
      task('due', { title: 'Due today, never scheduled', due: TODAY }),
      task('later', { title: 'Due next week', due: '2026-09-29' }),
      task('tomorrow', { title: 'Tomorrow', scheduled: '2026-09-23' }),
      task('early', { title: 'Done today, planned last week', scheduled: '2026-09-15', done: true, doneDate: TODAY }),
    ],
  })

  it("puts today's, the carried-over and the due on today — done ones last", () => {
    const ids = todoFor(state, TODAY, TODAY).map((t) => t.id)
    expect(new Set(ids)).toEqual(new Set(['today', 'carried', 'due', 'early']))
    expect(ids[ids.length - 1]).toBe('early')
  })

  it('shows a past day as it was, without dragging open work back onto it', () => {
    const ids = todoFor(state, YESTERDAY, TODAY).map((t) => t.id)
    expect(new Set(ids)).toEqual(new Set(['carried', 'finished']))
  })
})

describe('missed gym days', () => {
  it('counts the misses in the last 30 days, and only those', () => {
    const state = makeState({
      days: daysMap([
        day('2026-08-01', { gymMissed: true }), // too long ago
        day('2026-09-01', { gymMissed: true }),
        day('2026-09-20', { gymMissed: true }),
        day('2026-09-21', { trained: true }),
      ]),
    })
    expect(missedGymCount(state, '2026-09-22')).toBe(2)
  })
})

describe('the day bar', () => {
  const D = '2026-09-22'

  it('counts every part of the day, and names what is left', () => {
    const state = makeState({
      morningRitual: HABITS.map((h) => ({ ...h })),
      days: daysMap([
        day(D, {
          checks: { read_identity: true, m_cold: true, lay_out_clothes: true },
          habitMissed: { m_journal: true },
          bedtime: '23:30',
          wakeTime: '06:00',
          trained: true,
          metrics: { ...EMPTY_METRICS, waterL: 3.5, consultingHours: 8 },
          food: [{ id: 'f', what: 'Eggs', kcal: 300, protein: 20 }],
        }),
      ]),
      tasks: [task('t1', { title: 'Call John', scheduled: D, done: true })],
    })
    const p = dayProgress(state, D, D)
    // Read, sleep, 3 habits, gym, the to-do, water, food, office, tomorrow, clothes.
    expect(p.total).toBe(12)
    // Everything above except the two habits not done and tomorrow's list.
    expect(p.done).toBe(9)
    expect(p.points.filter((x) => x.state !== 'done').map((x) => x.label)).toEqual([
      'Morning journal',
      'Read 10 pages',
      "Tomorrow's to-do",
    ])
    // A habit marked missed is not the same as one nobody answered.
    expect(p.points.find((x) => x.label === 'Morning journal')?.state).toBe('missed')
  })

  it('is empty on a day with nothing logged', () => {
    const p = dayProgress(makeState(), D, D)
    expect(p.done).toBe(0)
    expect(p.pct).toBe(0)
  })
})

describe('the board', () => {
  const state = makeState({
    morningRitual: HABITS.map((h) => ({ ...h })),
    days: daysMap([
      day('2026-09-22', { checks: { m_cold: true }, trained: true }),
      day('2026-09-23', { habitMissed: { m_cold: true }, gymMissed: true }),
    ]),
  })
  const board = consistency(state, '2026-09-22', '2026-09-23', '2026-09-23')

  it('lines every point up against every day', () => {
    expect(board.dates).toEqual(['2026-09-22', '2026-09-23'])
    expect(board.rows.every((r) => r.cells.length === 2)).toBe(true)
  })

  it('tells done, missed and never-answered apart', () => {
    expect(board.rows.find((r) => r.label === 'Cold shower')?.cells).toEqual(['done', 'missed'])
    expect(board.rows.find((r) => r.key === 'gym')?.cells).toEqual(['done', 'missed'])
    expect(board.rows.find((r) => r.key === 'water')?.cells).toEqual(['none', 'none'])
  })

  it('rates each row over the days shown', () => {
    expect(board.rows.find((r) => r.label === 'Cold shower')?.rate).toBe(50)
    expect(board.rows.find((r) => r.key === 'water')?.rate).toBe(0)
  })

  it('averages the day scores', () => {
    expect(board.scores).toHaveLength(2)
    expect(board.average).toBeCloseTo((board.scores[0] + board.scores[1]) / 2, 5)
  })

  it('goes red, amber, green', () => {
    expect(progressTone(0)).toBe('bad')
    expect(progressTone(39)).toBe('bad')
    expect(progressTone(40)).toBe('mid')
    expect(progressTone(79)).toBe('mid')
    expect(progressTone(80)).toBe('good')
    expect(progressTone(100)).toBe('good')
  })
})

describe('last session', () => {
  it('is the most recent earlier day that logged the exercise', () => {
    const state = makeState({
      days: daysMap([
        day('2026-09-01', { gym: { ex_incline: [{ kg: 60, reps: 8 }] } }),
        day('2026-09-03', { gym: { ex_incline: [{ kg: 62.5, reps: 8 }] } }),
        // A day with only empty sets doesn't count as a session.
        day('2026-09-04', { gym: { ex_incline: [{ kg: null, reps: null }] } }),
        day('2026-09-05', { gym: { ex_pullup: [{ kg: 0, reps: 10 }] } }),
      ]),
    })
    const last = lastGymSets(state, '2026-09-05')
    expect(last.ex_incline.date).toBe('2026-09-03')
    expect(last.ex_incline.sets[0].kg).toBe(62.5)
    // Only sessions before the day being logged.
    expect(last.ex_pullup).toBeUndefined()
  })
})

describe('what the page works out for you', () => {
  const D = '2026-09-22'

  beforeEach(() => {
    actions.replaceAll(makeState())
  })

  it('turns bed and wake times into hours slept', () => {
    actions.setSleep(D, { bedtime: '23:30' })
    expect(getState().days[D].metrics.sleepHours).toBe(0)
    actions.setSleep(D, { wakeTime: '06:00' })
    const saved = getState().days[D]
    expect(saved.metrics.sleepHours).toBe(6.5)
    expect(saved.bedtime).toBe('23:30')
    expect(saved.wakeTime).toBe('06:00')
  })

  it('makes it a gym day once a set is logged, and not before', () => {
    actions.setGymSet(D, 'ex_incline', 1, { kg: 60 })
    let saved = getState().days[D]
    expect(saved.gym.ex_incline).toEqual([
      { kg: null, reps: null },
      { kg: 60, reps: null },
    ])
    expect(saved.trained).toBe(true)
    actions.setGymSet(D, 'ex_incline', 1, { kg: null })
    saved = getState().days[D]
    expect(saved.trained).toBe(false)
  })

  it('puts a missed session on the record, and a logged set takes it back off', () => {
    actions.setGymMissed(D, true)
    let saved = getState().days[D]
    expect(saved.gymMissed).toBe(true)
    expect(saved.trained).toBe(false)
    actions.setGymSet(D, 'ex_squat', 0, { reps: 5 })
    saved = getState().days[D]
    expect(saved.gymMissed).toBe(false)
    expect(saved.trained).toBe(true)
  })

  it('marks a habit done, missed, or neither', () => {
    actions.markHabit(D, 'm_cold', 'missed')
    expect(getState().days[D].habitMissed.m_cold).toBe(true)
    expect(getState().days[D].checks.m_cold).toBe(false)
    actions.markHabit(D, 'm_cold', 'done')
    expect(getState().days[D].habitMissed.m_cold).toBe(false)
    expect(getState().days[D].checks.m_cold).toBe(true)
    actions.markHabit(D, 'm_cold', null)
    expect(getState().days[D].checks.m_cold).toBe(false)
    expect(getState().days[D].habitMissed.m_cold).toBe(false)
  })

  it('totals the food log into calories and protein', () => {
    actions.setFood(D, [
      { id: 'a', what: 'Eggs', kcal: 300, protein: 20 },
      { id: 'b', what: 'Shake', kcal: 200, protein: 40 },
    ])
    const saved = getState().days[D]
    expect(saved.metrics.calories).toBe(500)
    expect(saved.metrics.protein).toBe(60)
  })
})

/**
 * v20 cut the day down to one page. The risks worth a test: the old SOP
 * surviving (or being put back by an older step), a habit you added yourself
 * being dropped, and logged times or notes going missing on the way.
 */
describe('v20 — one page', () => {
  const out = hydrate(
    JSON.stringify({
      version: 19,
      morningRitual: [
        { id: 'm_alarm', label: 'Alarm off', at: '06:00' },
        { id: 'm_cold', label: 'Cold shower', at: '06:00' },
        { id: 'my_step', label: 'MY OWN HABIT' },
      ],
      days: {
        '2026-09-22': { date: '2026-09-22', trackers: { tk_bed: 23 * 60 + 15 }, notes: 'old note', journal: '' },
        '2026-09-23': { date: '2026-09-23', trackers: { tk_wake: 6 * 60 + 5 }, notes: '', journal: 'kept' },
      },
    }),
  )

  it('swaps the SOP for the habits, keeping your own', () => {
    expect(out.morningRitual.map((m) => m.id)).toEqual([...HABITS.map((h) => h.id), 'my_step'])
    expect(out.morningRitual.map((m) => m.label)).toEqual([
      'Cold shower',
      'Morning journal',
      'Read 10 pages',
      'MY OWN HABIT',
    ])
  })

  it("carries the wake time over, and last night's bedtime onto the morning", () => {
    expect(out.days['2026-09-23'].wakeTime).toBe('06:05')
    expect(out.days['2026-09-23'].bedtime).toBe('23:15')
  })

  it('folds old day notes into the notes the page shows', () => {
    expect(out.days['2026-09-22'].journal).toBe('old note')
    expect(out.days['2026-09-23'].journal).toBe('kept')
  })

  it('starts the gym list', () => {
    expect(out.workout.map((e) => e.name)).toContain('Incline bench')
    expect(out.workout.every((e) => e.sets === 3)).toBe(true)
  })

  it('does not let an older migration put the SOP back', () => {
    const old = hydrate(
      JSON.stringify({ version: 16, morningRitual: [{ id: 'm_alarm', label: 'Alarm off' }], days: {} }),
    )
    expect(old.morningRitual.map((m) => m.id)).toEqual(HABITS.map((h) => h.id))
  })
})

/**
 * v21 cleared the days logged before the one-page version, which were sample
 * data and older shapes. Only days: the week's notes, tasks, money and the
 * gym list are not touched.
 */
describe('v21 — days before 22 Sep are cleared', () => {
  const out = hydrate(
    JSON.stringify({
      version: 20,
      days: {
        '2026-09-10': { date: '2026-09-10', journal: 'old' },
        '2026-09-21': { date: '2026-09-21', journal: 'also old' },
        '2026-09-22': { date: '2026-09-22', journal: 'kept' },
        '2026-09-23': { date: '2026-09-23', journal: 'kept too' },
      },
      weeks: { '2026-09-14': { weekStart: '2026-09-14', plan: 'week notes stay' } },
      tasks: [{ id: 't', title: 'Task stays', scheduled: '2026-09-01' }],
    }),
  )

  it('drops the days before, and keeps the rest', () => {
    expect(Object.keys(out.days).sort()).toEqual(['2026-09-22', '2026-09-23'])
  })

  it('leaves weeks and tasks alone', () => {
    expect(out.weeks['2026-09-14'].plan).toBe('week notes stay')
    expect(out.tasks).toHaveLength(1)
  })

  it('starts the top of the day off', () => {
    expect(out.identity.title).toBe('Alex 4.0')
    expect(out.identity.text).toBe('')
  })
})
