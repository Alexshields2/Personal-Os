import { describe, expect, it } from 'vitest'
import { hydrate } from './store'

/**
 * The v17 cut trimmed the shipped standards from 27 to 11. The risk worth a
 * test is not that the cut happened — it is that it took a standard the user
 * added themselves with it.
 */
const V16 = JSON.stringify({
  version: 16,
  checklist: [
    { id: 'consulting_hours', label: '10 hours in office', pillar: 'business', points: 14, metric: 'consultingHours' },
    { id: 'measurable', label: 'Measurable progress produced', pillar: 'business', points: 6 },
    { id: 'grooming', label: 'Skincare / grooming', pillar: 'body', points: 1 },
    { id: 'steps', label: 'Steps', pillar: 'body', points: 4, metric: 'steps' },
    { id: 'notes', label: 'Took notes', pillar: 'mind', points: 3 },
    { id: 'goal_review', label: 'Goal review', pillar: 'mind', points: 4, metric: 'goalReviewMin' },
    { id: 'my_custom', label: 'MY OWN STANDARD', pillar: 'mind', points: 9 },
  ],
  targets: { pagesRead: 20 },
  trackers: [
    { id: 'tk_lies', label: 'Lies told today', kind: 'number', unit: '', target: 0, direction: 'atMost', group: 'Truth', archived: false },
  ],
  days: {},
})

describe('v17 — trimming the standards', () => {
  const out = hydrate(V16)

  it('drops the shipped standards that were cut', () => {
    const ids = out.checklist.map((c) => c.id)
    for (const gone of ['measurable', 'grooming', 'steps', 'notes', 'goal_review']) {
      expect(ids).not.toContain(gone)
    }
  })

  it('keeps a standard the user added themselves', () => {
    const mine = out.checklist.find((c) => c.id === 'my_custom')
    expect(mine).toBeDefined()
    expect(mine!.points).toBe(9)
  })

  it('lands on the trimmed list', () => {
    expect(out.checklist.some((c) => c.id === 'deep_work')).toBe(true)
    expect(out.checklist.some((c) => c.id === 'training')).toBe(true)
    // 11 shipped + the one custom
    expect(out.checklist).toHaveLength(12)
  })

  it('moves reading to 10 pages', () => {
    expect(out.targets.pagesRead).toBe(10)
    expect(out.checklist.find((c) => c.id === 'reading')!.label).toBe('Read 10 pages')
  })

  it('archives lies rather than deleting the history', () => {
    const lies = out.trackers.find((t) => t.id === 'tk_lies')
    expect(lies).toBeDefined()
    expect(lies!.archived).toBe(true)
  })

  it('adds the meals line', () => {
    expect(out.trackers.some((t) => t.id === 'tk_meals' && t.kind === 'text')).toBe(true)
  })

  it('stamps the new version', () => {
    expect(out.version).toBe(17)
  })
})
