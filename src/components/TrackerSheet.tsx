import { Card, Check, Empty, SectionTitle, Stepper } from './ui'
import { actions, useStore } from '../lib/store'
import { trackerStats } from '../lib/selectors'
import type { Tracker } from '../lib/types'

/**
 * The nightly sheet — the spreadsheet this app replaced, with the arithmetic
 * done for you. A habit, a rating, a time and a number are one object here, so
 * they share a streak rule and a single place to edit them.
 *
 * Green is the only hue in the app and it means exactly one thing: you hit it.
 * That is why it needs no legend.
 */
export default function TrackerSheet({ date }: { date: string }) {
  const state = useStore()
  const stats = trackerStats(state, date)

  if (stats.length === 0) {
    return (
      <Card>
        <Empty>
          No trackers yet. Add the handful you actually watch in Settings — a tracker you
          didn't choose never gets ticked.
        </Empty>
      </Card>
    )
  }

  const won = stats.filter((s) => s.hit).length
  const scoreable = stats.filter((s) => s.tracker.kind !== 'text').length

  // Preserve the order they were defined in, but gather each group together.
  const groups: { name: string; items: typeof stats }[] = []
  for (const s of stats) {
    const name = s.tracker.group || 'Other'
    const existing = groups.find((g) => g.name === name)
    if (existing) existing.items.push(s)
    else groups.push({ name, items: [s] })
  }

  return (
    <>
      <SectionTitle
        title="The sheet"
        action={
          <span className={`pill${won === scoreable && scoreable > 0 ? ' pill-won' : ''}`}>
            {won}/{scoreable}
          </span>
        }
      />
      <Card>
        <div className="sheet-grid">
          {groups.map((g) => (
            <div key={g.name}>
              <div className="tk-group t-cap">{g.name}</div>
              {g.items.map((s) => (
                <TrackerRow key={s.tracker.id} date={date} stat={s} />
              ))}
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

function TrackerRow({
  date,
  stat,
}: {
  date: string
  stat: ReturnType<typeof trackerStats>[number]
}) {
  // Read at the top: a hook behind a `kind === 'text'` branch would run on some
  // renders and not others.
  const note = useStore().days[date]?.trackerNotes?.[stat.tracker.id] ?? ''
  const { tracker, value, hit, streak, rate, average } = stat

  const sub = (() => {
    if (tracker.kind === 'text') return ''
    const bits: string[] = []
    bits.push(`${targetLabel(tracker)}`)
    if (rate > 0) bits.push(`${Math.round(rate)}% of days`)
    if (average !== null) bits.push(`avg ${formatValue(tracker, average)}`)
    return bits.join(' · ')
  })()

  return (
    <div className="tk-row" data-won={hit}>
      <span className="tk-main">
        <span className="tk-label">{tracker.label}</span>
        {sub && <span className="tk-sub">{sub}</span>}
      </span>

      <span className="tk-control">
        {streak >= 2 && <span className="tk-streak">{streak}d</span>}

        {tracker.kind === 'check' && (
          <button
            onClick={() => actions.toggleTracker(date, tracker.id)}
            aria-label={tracker.label}
            aria-pressed={hit}
            style={{ display: 'flex' }}
          >
            <Check on={hit} />
          </button>
        )}

        {tracker.kind === 'number' && (
          <Stepper
            value={value}
            step={tracker.unit === '€' ? 100 : 1}
            dp={0}
            suffix={tracker.unit}
            onChange={(v) => actions.setTrackerValue(date, tracker.id, v)}
          />
        )}

        {tracker.kind === 'time' && (
          <input
            className="input input-time"
            type="time"
            value={value ? minutesToTime(value) : ''}
            onChange={(e) =>
              actions.setTrackerValue(date, tracker.id, timeToMinutes(e.target.value))
            }
            aria-label={tracker.label}
          />
        )}
      </span>

      {tracker.kind === 'rating' && (
        <div style={{ gridColumn: '1 / -1', paddingTop: 4 }}>
          <div className="rating">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                aria-pressed={value === n}
                data-won={n >= tracker.target}
                onClick={() => actions.setTrackerValue(date, tracker.id, value === n ? 0 : n)}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {tracker.kind === 'text' && (
        <div style={{ gridColumn: '1 / -1', paddingTop: 4 }}>
          <input
            className="input"
            value={note}
            placeholder="In one line"
            onChange={(e) => actions.setTrackerNote(date, tracker.id, e.target.value)}
          />
        </div>
      )}
    </div>
  )
}

function targetLabel(tracker: Tracker): string {
  const dir = tracker.direction === 'atMost' ? 'under' : 'at least'
  if (tracker.kind === 'check') return 'every day'
  if (tracker.kind === 'rating') return `${dir} ${tracker.target}/10`
  if (tracker.kind === 'time') return `by ${minutesToTime(tracker.target)}`
  // A ceiling of zero is "none at all"; a floor of zero means no target.
  if (tracker.direction === 'atMost' && tracker.target === 0) return 'none'
  if (tracker.direction === 'atLeast' && tracker.target <= 0) return 'just record it'
  return `${dir} ${tracker.target}${tracker.unit ? ` ${tracker.unit}` : ''}`
}

function formatValue(tracker: Tracker, v: number): string {
  if (tracker.kind === 'time') return minutesToTime(Math.round(v))
  if (tracker.kind === 'rating') return `${v.toFixed(1)}/10`
  return `${Math.round(v)}${tracker.unit ? ` ${tracker.unit}` : ''}`
}

/** Times are stored as minutes since midnight so they can be averaged. */
export function minutesToTime(mins: number): string {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)))
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}
