import { beforeEach, describe, expect, it } from 'vitest'
import { HABITS } from './config'
import { hoursMinutes, sleepMinutes } from './date'
import { day, daysMap, makeState, task } from './fixtures'
import { lastGymSets, todoFor } from './selectors'
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
        '2026-09-20': { date: '2026-09-20', trackers: { tk_bed: 23 * 60 + 15 }, notes: 'old note', journal: '' },
        '2026-09-21': { date: '2026-09-21', trackers: { tk_wake: 6 * 60 + 5 }, notes: '', journal: 'kept' },
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
    expect(out.days['2026-09-21'].wakeTime).toBe('06:05')
    expect(out.days['2026-09-21'].bedtime).toBe('23:15')
  })

  it('folds old day notes into the notes the page shows', () => {
    expect(out.days['2026-09-20'].journal).toBe('old note')
    expect(out.days['2026-09-21'].journal).toBe('kept')
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
