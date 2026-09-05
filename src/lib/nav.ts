/**
 * A one-shot hand-off between screens. Home and Alex both want to drop you
 * straight into the morning form or the night one, but the screens are rendered
 * by id with no props, and threading a parameter through the shell for a value
 * that lives for a single render would cost more than it is worth.
 *
 * The value is taken exactly once, so a later re-render of Today doesn't snap
 * the user back to a view they have since navigated away from.
 */
export type DayView = 'plan' | 'log' | 'review'

let pending: DayView | null = null

export const dayIntent = {
  set(view: DayView) {
    pending = view
  },
  take(): DayView | null {
    const v = pending
    pending = null
    return v
  },
}
