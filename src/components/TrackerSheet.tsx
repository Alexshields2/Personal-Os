import { useState } from 'react'
import { Card, Check, Empty, SectionTitle, Stepper } from './ui'
import { IconPlus, IconTrash } from './icons'
import { actions, useStore } from '../lib/store'
import { uid } from '../lib/format'
import { SLEEP_IDS, WAKE_IDS } from './DayEdges'
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
  // Wake, shut-off and in-bed are asked in Plan and Review, at the moment you
  // can actually answer them — so they are not asked again here.
  const stats = trackerStats(state, date).filter((s) => !DAY_EDGE_IDS.includes(s.tracker.id))

  if (stats.length === 0) {
    return (
      <>
        <SectionTitle title="The sheet" />
        <Card>
          <Empty>No trackers yet. Add the handful you actually watch, right here.</Empty>
          <div style={{ padding: '0 14px 14px' }}>
            <AddTracker />
          </div>
        </Card>
      </>
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
        <div style={{ padding: 13, borderTop: '1px solid var(--hairline)' }}>
          <AddTracker />
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
  const state = useStore()
  const note = state.days[date]?.trackerNotes?.[stat.tracker.id] ?? ''
  const { tracker, value, hit, streak, rate, average } = stat

  const rename = (label: string) => {
    actions.setTrackers(state.trackers.map((t) => (t.id === tracker.id ? { ...t, label } : t)))
  }
  const remove = () => {
    if (confirm(`Delete "${tracker.label}"? Days already logged against it lose that value.`))
      actions.setTrackers(state.trackers.filter((t) => t.id !== tracker.id))
  }

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
        <input
          className="input input-plain tk-label"
          value={tracker.label}
          onChange={(e) => rename(e.target.value)}
        />
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

        <button className="btn btn-quiet btn-danger btn-sm" onClick={remove} aria-label="Delete tracker">
          <IconTrash style={{ width: 14, height: 14 }} />
        </button>
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

const DAY_EDGE_IDS = [...WAKE_IDS, ...SLEEP_IDS]

const ADD_KIND_LABEL: Record<Tracker['kind'], string> = {
  check: 'Check',
  number: 'Number',
  rating: 'Rating /10',
  time: 'Time',
  text: 'Text',
}

/**
 * Add a tracker right where you use it — no trip to Settings. Settings still
 * has the finer controls (group, target, direction) for when those matter;
 * this is for the moment you notice you want to watch something new.
 */
function AddTracker() {
  const state = useStore()
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<Tracker['kind']>('check')

  const add = () => {
    if (!label.trim()) return
    actions.setTrackers([
      ...state.trackers,
      {
        id: uid(),
        label: label.trim(),
        kind,
        unit: '',
        target: kind === 'rating' ? 7 : kind === 'time' ? 0 : 1,
        direction: 'atLeast',
        group: '',
        archived: false,
      },
    ])
    setLabel('')
    setKind('check')
  }

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <input
        className="input"
        style={{ flex: '1 1 160px' }}
        placeholder="Add something to watch"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
      <select
        className="input"
        style={{ width: 110, flex: 'none' }}
        value={kind}
        onChange={(e) => setKind(e.target.value as Tracker['kind'])}
      >
        {(Object.keys(ADD_KIND_LABEL) as Tracker['kind'][]).map((k) => (
          <option key={k} value={k}>
            {ADD_KIND_LABEL[k]}
          </option>
        ))}
      </select>
      <button className="btn" onClick={add} disabled={!label.trim()} aria-label="Add tracker">
        <IconPlus style={{ width: 16, height: 16 }} />
      </button>
    </div>
  )
}
