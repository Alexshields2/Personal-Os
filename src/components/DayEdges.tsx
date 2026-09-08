import { Card, SectionTitle } from './ui'
import { actions, useStore } from '../lib/store'
import { minutesToTime, timeToMinutes } from './TrackerSheet'

/**
 * The two ends of the day, asked at the moment you can actually answer them:
 * when you woke, and when you shut off and went to bed.
 *
 * These read the same time trackers the sheet used to hold, so nothing is
 * duplicated — they are just surfaced at the right moment instead of all
 * being asked at midnight.
 */

/** Time trackers belonging to the morning and the night respectively. */
export const WAKE_IDS = ['tk_wake']
export const SLEEP_IDS = ['tk_shutoff', 'tk_bed']

export default function DayEdges({
  date,
  ids,
  title,
  hint,
}: {
  date: string
  ids: string[]
  title: string
  hint: string
}) {
  const state = useStore()
  const shown = state.trackers.filter((t) => ids.includes(t.id) && !t.archived)
  if (shown.length === 0) return null

  const day = state.days[date]

  return (
    <>
      <SectionTitle title={title} />
      <Card>
        <div className="rows">
          {shown.map((t) => {
            const mins = day?.trackers?.[t.id] ?? 0
            const hit =
              mins > 0 && (t.direction === 'atMost' ? mins <= t.target : mins >= t.target)
            return (
              <div className="row" key={t.id}>
                <span className="row-main">
                  <span className="row-title">{t.label}</span>
                  <span className="row-sub">
                    {t.direction === 'atMost' ? 'by' : 'from'} {minutesToTime(t.target)}
                  </span>
                </span>
                <input
                  className="input input-time"
                  type="time"
                  value={mins ? minutesToTime(mins) : ''}
                  aria-label={t.label}
                  style={hit ? { color: 'var(--won)' } : undefined}
                  onChange={(e) =>
                    actions.setTrackerValue(date, t.id, timeToMinutes(e.target.value))
                  }
                />
              </div>
            )
          })}
        </div>
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        {hint}
      </p>
    </>
  )
}
