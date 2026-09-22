import { describe, expect, it } from 'vitest'
import { goal, makeState } from './fixtures'
import { goalBand, goalBoard } from './selectors'
import { hydrate } from './store'

/**
 * Goals carry a date, not a bucket. The date is the timeframe, and it moves
 * the goal up the page on its own as it gets closer — which is the whole
 * reason for taking "ten years" and "three years" out.
 */
describe('a goal sits where its date puts it', () => {
  const TODAY = '2026-09-22'

  it('reads the date rather than anything anyone chose', () => {
    expect(goalBand(goal('a', { due: '2026-09-01' }), TODAY)).toBe('overdue')
    expect(goalBand(goal('b', { due: '2026-10-10' }), TODAY)).toBe('month')
    expect(goalBand(goal('c', { due: '2026-12-01' }), TODAY)).toBe('quarter')
    expect(goalBand(goal('d', { due: '2027-06-01' }), TODAY)).toBe('year')
    expect(goalBand(goal('e', { due: '2031-01-01' }), TODAY)).toBe('later')
    expect(goalBand(goal('f'), TODAY)).toBe('undated')
  })

  it('puts a finished goal out of the way whatever its date', () => {
    expect(goalBand(goal('g', { due: '2026-09-01', done: true }), TODAY)).toBe('done')
  })

  it('groups and sorts the board soonest first', () => {
    const state = makeState({
      goals: [
        goal('later', { title: 'Later', due: '2027-01-01' }),
        goal('soon', { title: 'Soon', due: '2026-10-01' }),
        goal('none', { title: 'No date' }),
      ],
    })
    const board = goalBoard(state, TODAY)
    const band = (key: string) => board.bands.find((b) => b.key === key)
    expect(band('month')?.goals.map((p) => p.goal.id)).toEqual(['soon'])
    expect(band('year')?.goals.map((p) => p.goal.id)).toEqual(['later'])
    expect(band('undated')?.goals.map((p) => p.goal.id)).toEqual(['none'])
    expect(board.total).toBe(3)
  })
})

/**
 * v22 took out the goals and money targets the app shipped with — a €10M
 * bank, a €1M payout, 95kg. They were never anyone's but the app's.
 */
describe('v22 — the shipped ambitions go', () => {
  const doc = (targets: Record<string, number>) =>
    JSON.stringify({
      version: 21,
      goals: [
        { id: 'g1', title: '€10M in the Consulting.ie bank', horizon: 'tenYear', keyResults: [] },
        { id: 'g3', title: '95kg lean and muscular', horizon: 'threeYear', keyResults: [] },
        { id: 'mine', title: 'Ship this', horizon: 'year', due: '2026-12-31', keyResults: [] },
      ],
      targets,
      days: {},
    })

  const out = hydrate(
    doc({ bonusPool: 10_000_000, personalPayout: 1_000_000, netWorth: 5_000_000, bodyweightKg: 95 }),
  )

  it('drops the shipped goals and keeps the one you wrote', () => {
    expect(out.goals.map((g) => g.id)).toEqual(['mine'])
    expect(out.goals[0].due).toBe('2026-12-31')
  })

  it('zeroes the money targets that only charted them', () => {
    expect(out.targets.bonusPool).toBe(0)
    expect(out.targets.personalPayout).toBe(0)
    expect(out.targets.netWorth).toBe(0)
  })

  it('leaves a target you set yourself alone', () => {
    const mine = hydrate(
      doc({ bonusPool: 250_000, personalPayout: 80_000, netWorth: 5_000_000, bodyweightKg: 88 }),
    )
    expect(mine.targets.bonusPool).toBe(250_000)
    expect(mine.targets.personalPayout).toBe(80_000)
    expect(mine.targets.bodyweightKg).toBe(88)
  })

  it('takes the horizon bucket off the goals that had one', () => {
    expect('horizon' in out.goals[0]).toBe(false)
  })

  it('gives every goal somewhere to keep a picture', () => {
    expect(out.goals[0].image).toBe('')
  })
})
