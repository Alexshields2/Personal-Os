import { useMemo, useState } from 'react'
import {
  Card,
  Check,
  Empty,
  Meter,
  NumberField,
  SectionTitle,
  Stat,
  TextField,
} from '../components/ui'
import { IconChevron, IconPlus, IconTrash } from '../components/icons'
import { INNER_CIRCLE } from '../lib/config'
import { addDays, formatShort, todayISO, weekStartISO } from '../lib/date'
import { euro, uid } from '../lib/format'
import { actions, emptyWeek, useStore } from '../lib/store'
import { isLogged, scoreDay, weekRevenue } from '../lib/selectors'
import type { Book } from '../lib/types'

export default function Review() {
  const state = useStore()
  const [weekStart, setWeekStart] = useState(weekStartISO(todayISO()))
  const week = state.weeks[weekStart] ?? emptyWeek(weekStart)
  const money = weekRevenue(state, weekStart)

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  const scored = days
    .map((d) => state.days[d])
    .filter(isLogged)
    .map((d) => scoreDay(d, state.targets).score)
  const weekScore = scored.length ? scored.reduce((s, v) => s + v, 0) / scored.length : 0

  const set = (patch: Partial<typeof week>) => actions.updateWeek(weekStart, patch)
  const isThisWeek = weekStart === weekStartISO(todayISO())

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            Sunday · recovery and review
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 className="t-large" style={{ flex: 1 }}>
            {isThisWeek ? 'This week' : formatShort(weekStart)}
          </h1>
          <button
            className="btn btn-quiet"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
          >
            <IconChevron style={{ width: 18, height: 18, transform: 'rotate(180deg)' }} />
          </button>
          <button
            className="btn btn-quiet"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Next week"
            disabled={weekStart >= weekStartISO(todayISO())}
          >
            <IconChevron style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <p className="t-sub">
          {formatShort(weekStart)} – {formatShort(addDays(weekStart, 6))}
        </p>
      </header>

      <Card className="card-pad">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 10,
          }}
        >
          <span className="t-cap">Week score</span>
          <span className="t-title t-num">{weekScore.toFixed(0)}</span>
        </div>
        <Meter pct={weekScore} />
        <div style={{ display: 'flex', gap: 6, marginTop: 14 }}>
          {days.map((d) => {
            const entry = state.days[d]
            const s = isLogged(entry) ? scoreDay(entry, state.targets).score : 0
            return (
              <div key={d} style={{ flex: 1, textAlign: 'center' }}>
                {/* Absolute fill rather than a flex child: percentage heights
                    on flex items don't reliably resolve, and the bar has to
                    grow from the baseline. */}
                <div
                  style={{
                    position: 'relative',
                    height: 34,
                    borderRadius: 5,
                    background: 'var(--seq-track)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      height: `${s}%`,
                      background: 'var(--accent)',
                      borderRadius: '4px 4px 0 0',
                      transition: 'height 0.7s var(--ease)',
                    }}
                  />
                </div>
                <div className="t-cap" style={{ marginTop: 5 }}>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'][days.indexOf(d)]}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <SectionTitle title="Body" />
      <Card className="card-pad">
        <div className="grid-2" style={{ marginBottom: 14 }}>
          <NumberField
            label="Morning weight (kg)"
            value={week.weightKg}
            onChange={(v) => set({ weightKg: v })}
            placeholder="0"
          />
          <NumberField
            label="Waist (cm)"
            value={week.waistCm}
            onChange={(v) => set({ waistCm: v })}
            placeholder="0"
          />
        </div>
        {week.weightKg > 0 && (
          <p className="t-foot" style={{ marginBottom: 14 }}>
            {week.weightKg < state.targets.bodyweightKg
              ? `${(state.targets.bodyweightKg - week.weightKg).toFixed(1)}kg to ${state.targets.bodyweightKg}kg lean.`
              : `At or above the ${state.targets.bodyweightKg}kg target — hold quality.`}
          </p>
        )}
        <TextField
          label="Strength review"
          value={week.strengthNote}
          onChange={(v) => set({ strengthNote: v })}
          placeholder="Lifts up, lifts stalled, what to change"
          multiline
        />
        <div className="rows" style={{ marginTop: 12 }}>
          <ToggleRow
            label="Progress photos taken"
            on={week.photos}
            onToggle={() => set({ photos: !week.photos })}
          />
        </div>
      </Card>

      <SectionTitle title="ACMR" />
      <Card className="card-pad">
        <div className="grid-2" style={{ marginBottom: 6 }}>
          <Stat label="Revenue" value={euro(money.total)} sub="From the ledger" />
          <Stat label="Cash collected" value={euro(money.cash)} sub="From the ledger" />
        </div>
        <div className="grid-2" style={{ marginTop: 12 }}>
          <Stat label="ACMR" value={euro(money.acmr)} />
          <Stat label="1Media" value={euro(money.onemedia)} />
        </div>
        <div className="grid-2" style={{ marginTop: 14 }}>
          <NumberField
            label="Deals closed"
            value={week.dealsClosed}
            onChange={(v) => set({ dealsClosed: v })}
            placeholder="0"
          />
          <NumberField
            label="Qualified opportunities"
            value={week.qualifiedOpps}
            onChange={(v) => set({ qualifiedOpps: v })}
            placeholder="0"
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <NumberField
            label="New pipeline (€)"
            value={week.newPipeline}
            onChange={(v) => set({ newPipeline: v })}
            placeholder="0"
          />
        </div>
        <div className="stack" style={{ display: 'grid', gap: 14, marginTop: 14 }}>
          <TextField
            label="Biggest win"
            value={week.biggestWin}
            onChange={(v) => set({ biggestWin: v })}
            multiline
          />
          <TextField
            label="Biggest bottleneck"
            value={week.biggestBottleneck}
            onChange={(v) => set({ biggestBottleneck: v })}
            multiline
          />
          <TextField
            label="Next week's main target"
            value={week.nextTarget}
            onChange={(v) => set({ nextTarget: v })}
          />
        </div>
      </Card>

      <SectionTitle title="Personal" />
      <Card className="card-pad">
        <TextField
          label="Spending review"
          value={week.spendingNote}
          onChange={(v) => set({ spendingNote: v })}
          placeholder="What went out, what shouldn't have"
          multiline
        />
        <div style={{ marginTop: 14 }}>
          <TextField
            label="Book notes"
            value={week.bookNotes}
            onChange={(v) => set({ bookNotes: v })}
            placeholder="What you'll actually apply"
            multiline
          />
        </div>
        <div className="rows" style={{ marginTop: 12 }}>
          <ToggleRow
            label="Proper time with Bella / family"
            on={week.familyTime}
            onToggle={() => set({ familyTime: !week.familyTime })}
          />
          <ToggleRow
            label="Upcoming week planned"
            on={week.planned}
            onToggle={() => set({ planned: !week.planned })}
          />
        </div>
      </Card>

      <Books />

      <SectionTitle title="Still seeing" />
      <Card className="card-pad">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {INNER_CIRCLE.map((p) => (
            <span className="pill" key={p}>
              {p}
            </span>
          ))}
        </div>
        <p className="t-foot muted" style={{ marginTop: 12 }}>
          Everything outside this list waits until day 126. Keep these ones strong.
        </p>
      </Card>
    </div>
  )
}

function ToggleRow({
  label,
  on,
  onToggle,
}: {
  label: string
  on: boolean
  onToggle: () => void
}) {
  return (
    <button
      className="row"
      style={{ paddingLeft: 0, paddingRight: 0 }}
      onClick={onToggle}
      role="checkbox"
      aria-checked={on}
    >
      <Check on={on} />
      <span className="row-main">
        <span className="row-title" style={{ opacity: on ? 0.6 : 1 }}>
          {label}
        </span>
      </span>
    </button>
  )
}

function Books() {
  const state = useStore()
  const [title, setTitle] = useState('')

  const cycle = (b: Book): Book['status'] =>
    b.status === 'queued' ? 'reading' : b.status === 'reading' ? 'done' : 'queued'

  return (
    <>
      <SectionTitle title="Books" />
      <Card>
        {state.books.length === 0 ? (
          <Empty>No books yet.</Empty>
        ) : (
          <div className="rows">
            {state.books.map((b) => (
              <div className="row" key={b.id}>
                <button
                  onClick={() =>
                    actions.setBooks(
                      state.books.map((x) => (x.id === b.id ? { ...x, status: cycle(x) } : x)),
                    )
                  }
                  aria-label="Cycle status"
                  style={{ display: 'flex' }}
                >
                  <Check on={b.status === 'done'} />
                </button>
                <span className="row-main">
                  <span className="row-title" style={{ opacity: b.status === 'done' ? 0.6 : 1 }}>
                    {b.title}
                  </span>
                  <span className="row-sub">
                    {b.status === 'reading'
                      ? 'Reading now'
                      : b.status === 'done'
                        ? 'Finished'
                        : 'Queued'}
                  </span>
                </span>
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => actions.setBooks(state.books.filter((x) => x.id !== b.id))}
                  aria-label="Remove book"
                >
                  <IconTrash style={{ width: 16, height: 16 }} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, padding: 13, borderTop: '1px solid var(--hairline)' }}>
          <input
            className="input"
            placeholder="Add a book"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') add()
            }}
          />
          <button className="btn" onClick={add} disabled={!title.trim()}>
            <IconPlus style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </Card>
    </>
  )

  function add() {
    if (!title.trim()) return
    actions.setBooks([
      ...state.books,
      { id: uid(), title: title.trim(), status: 'queued', notes: '' },
    ])
    setTitle('')
  }
}
