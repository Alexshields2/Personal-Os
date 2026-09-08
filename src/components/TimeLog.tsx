import { useMemo, useState } from 'react'
import { Card, SectionTitle } from './ui'
import { actions } from '../lib/store'
import { minutesOfDay, todayISO } from '../lib/date'
import type { DayEntry } from '../lib/types'

/**
 * The day in quarter hours, as actually spent.
 *
 * Deliberately not a timer: every slot is a plain field keyed by its clock
 * time, so filling in 09:15 at four in the afternoon is the same operation as
 * filling it in live. Honest backfill beats a stopwatch nobody keeps running.
 *
 * Only the hours you ask for are rendered — a full day is 96 rows, and most of
 * them are asleep.
 */

const SLOT_MIN = 15
const DEFAULT_FROM = 6
const DEFAULT_TO = 23

function slotsForHour(hour: number): string[] {
  const h = String(hour).padStart(2, '0')
  return ['00', '15', '30', '45'].map((m) => `${h}:${m}`)
}

/** The quarter hour a given clock time falls inside. */
function currentSlot(): string {
  const now = new Date()
  const m = Math.floor(now.getMinutes() / SLOT_MIN) * SLOT_MIN
  return `${String(now.getHours()).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function TimeLog({ date, day }: { date: string; day: DayEntry }) {
  const isToday = date === todayISO()
  const now = isToday ? currentSlot() : ''

  const filledHours = useMemo(
    () => Object.keys(day.timeLog).map((s) => Number(s.slice(0, 2))),
    [day.timeLog],
  )

  // Widen the default window to cover anything already logged outside it, so
  // a 05:30 entry never becomes invisible just because the window starts at 6.
  const [from, setFrom] = useState(() => Math.min(DEFAULT_FROM, ...filledHours, DEFAULT_FROM))
  const [to, setTo] = useState(() => Math.max(DEFAULT_TO, ...filledHours, DEFAULT_TO))

  const hours = useMemo(
    () => Array.from({ length: to - from + 1 }, (_, i) => from + i),
    [from, to],
  )

  const logged = Object.values(day.timeLog).filter((s) => s.text.trim() !== '')
  const rated = logged.filter((s) => s.rating > 0)
  const avg = rated.length
    ? rated.reduce((sum, s) => sum + s.rating, 0) / rated.length
    : 0
  const mins = logged.length * SLOT_MIN

  return (
    <>
      <SectionTitle
        title="The day, in quarter hours"
        action={
          <span className="t-foot muted">
            {logged.length
              ? `${Math.floor(mins / 60)}h ${mins % 60}m logged${avg ? ` · avg ${avg.toFixed(1)}` : ''}`
              : 'nothing logged'}
          </span>
        }
      />
      <Card>
        {from > 0 && (
          <button className="btn btn-quiet btn-block btn-sm" onClick={() => setFrom(Math.max(0, from - 3))}>
            ↑ earlier
          </button>
        )}
        <div className="tl-grid">
          {hours.map((h) => (
            <div key={h} className="tl-hourgroup">
              {slotsForHour(h).map((slot) => (
                <SlotRow
                  key={slot}
                  date={date}
                  slot={slot}
                  entry={day.timeLog[slot]}
                  isNow={slot === now}
                  isPast={!isToday || minutesOfDay(slot) <= minutesOfDay(now || '23:59')}
                />
              ))}
            </div>
          ))}
        </div>
        {to < 23 && (
          <button className="btn btn-quiet btn-block btn-sm" onClick={() => setTo(Math.min(23, to + 3))}>
            ↓ later
          </button>
        )}
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Fill these in whenever — now, or hours later. The rating is how well that
        quarter hour was spent, 1 to 10, and only appears once there's something to rate.
      </p>
    </>
  )
}

function SlotRow({
  date,
  slot,
  entry,
  isNow,
  isPast,
}: {
  date: string
  slot: string
  entry: { text: string; rating: number } | undefined
  isNow: boolean
  isPast: boolean
}) {
  const text = entry?.text ?? ''
  const rating = entry?.rating ?? 0

  return (
    <div className="tl-row" data-now={isNow} data-filled={text.trim() !== ''}>
      <span className="tl-time t-num">{slot}</span>
      <input
        className="input input-plain tl-text"
        value={text}
        placeholder={isNow ? 'what are you doing right now?' : isPast ? '—' : ''}
        onChange={(e) => actions.setTimeLogSlot(date, slot, { text: e.target.value })}
      />
      {text.trim() !== '' && (
        <select
          className="input tl-rate"
          value={rating}
          aria-label={`How well ${slot} was spent`}
          onChange={(e) => actions.setTimeLogSlot(date, slot, { rating: Number(e.target.value) })}
        >
          <option value={0}>–</option>
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
