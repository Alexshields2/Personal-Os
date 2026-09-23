import { useMemo, useState } from 'react'
import {
  Card,
  Check,
  Meter,
  NumberField,
  SectionTitle,
  Segmented,
  Stat,
  TextField,
} from '../components/ui'
import { IconChevron } from '../components/icons'
import { INNER_CIRCLE } from '../lib/config'
import { addDays, formatShort, fromISO, todayISO, weekStartISO } from '../lib/date'
import { euro } from '../lib/format'
import { DAYS_START, actions, emptyWeek, useStore } from '../lib/store'
import { useTopOnChange } from '../lib/scroll'
import { consistency, dayProgress, progressTone, weekRevenue } from '../lib/selectors'

type View = 'board' | 'week'

export default function Review() {
  const state = useStore()
  const [view, setView] = useState<View>('board')
  useTopOnChange(view)
  const [weekStart, setWeekStart] = useState(weekStartISO(todayISO()))
  const week = state.weeks[weekStart] ?? emptyWeek(weekStart)
  const money = weekRevenue(state, weekStart)

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  )

  // The same points the day is measured by, so the week and the day can
  // never disagree. Days before the app started are not counted against you.
  const scored = days
    .filter((d) => d >= DAYS_START && d <= todayISO())
    .map((d) => dayProgress(state, d).pct)
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
            {view === 'board' ? 'Review' : isThisWeek ? 'This week' : formatShort(weekStart)}
          </h1>
          <button
            className="btn btn-quiet"
            onClick={() => setWeekStart(addDays(weekStart, -7))}
            aria-label="Previous week"
            hidden={view === 'board'}
          >
            <IconChevron style={{ width: 18, height: 18, transform: 'rotate(180deg)' }} />
          </button>
          <button
            className="btn btn-quiet"
            onClick={() => setWeekStart(addDays(weekStart, 7))}
            aria-label="Next week"
            disabled={weekStart >= weekStartISO(todayISO())}
            hidden={view === 'board'}
          >
            <IconChevron style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <p className="t-sub">
          {view === 'board'
            ? 'Every day since this started, point by point'
            : `${formatShort(weekStart)} – ${formatShort(addDays(weekStart, 6))}`}
        </p>
      </header>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'board', label: 'Board' },
          { value: 'week', label: 'The week' },
        ]}
      />

      {view === 'board' && <Board />}
      {view === 'week' && (
        <>

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
            const s = d >= DAYS_START && d <= todayISO() ? dayProgress(state, d).pct : 0
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

      <SectionTitle title="Consulting.ie" />
      <Card className="card-pad">
        <div className="grid-2" style={{ marginBottom: 6 }}>
          <Stat label="Revenue" value={euro(money.total)} sub="From the ledger" />
          <Stat label="Cash collected" value={euro(money.cash)} sub="From the ledger" />
        </div>
        <div className="grid-2" style={{ marginTop: 12 }}>
          <Stat label="Consulting.ie" value={euro(money.consulting)} />
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
            label="Proper time with Caoimhe / family"
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
        </>
      )}
    </div>
  )
}

// -------------------------------------------------------------------- board

const SPANS: { value: string; label: string; days: number }[] = [
  { value: '7', label: '7 days', days: 7 },
  { value: '14', label: '2 weeks', days: 14 },
  { value: '30', label: '30 days', days: 30 },
]

/**
 * Every point of the day against every day, since the day this started.
 *
 * A single day's score says how today went; this says whether it holds. The
 * rate on the right of each row is the whole point of the board — one glance
 * tells you which habit is real and which one is a story you tell yourself.
 */
function Board() {
  const state = useStore()
  const today = todayISO()
  const [span, setSpan] = useState('14')
  const days = SPANS.find((s) => s.value === span)?.days ?? 14
  // Never earlier than the day the app's history starts — empty columns
  // before that would read as days you failed rather than days that predate it.
  const start = addDays(today, -(days - 1))
  const from = start < DAYS_START ? DAYS_START : start
  const board = useMemo(() => consistency(state, from, today), [state, from, today])
  const tone = progressTone(board.average)

  return (
    <>
      <div style={{ marginTop: 16 }}>
        <Segmented value={span} onChange={setSpan} options={SPANS} />
      </div>

      <div className="day-bar" data-tone={tone} style={{ marginTop: 14 }}>
        <div className="day-bar-head">
          <span className="t-cap">
            {board.dates.length} day{board.dates.length === 1 ? '' : 's'} · average
          </span>
          <span className="day-bar-score">{Math.round(board.average)}%</span>
        </div>
        <Meter pct={board.average} />
      </div>

      <SectionTitle title="Every day, point by point" />
      <Card>
        <div className="cboard-scroll">
          <table className="cboard">
            <thead>
              <tr>
                <th className="cboard-label cboard-corner" scope="col">
                  <span className="t-cap">Point</span>
                </th>
                {board.dates.map((date) => (
                  <th key={date} scope="col">
                    <span className="cboard-dow">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'][fromISO(date).getDay()]}
                    </span>
                    <span className="cboard-day">{Number(date.slice(8))}</span>
                  </th>
                ))}
                <th className="cboard-rate" scope="col">
                  <span className="t-cap">Rate</span>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="cboard-score-row">
                <th className="cboard-label" scope="row">
                  Score
                </th>
                {board.scores.map((score, i) => (
                  <td key={board.dates[i]}>
                    <span className="cboard-score" data-tone={progressTone(score)}>
                      {Math.round(score)}
                    </span>
                  </td>
                ))}
                <td className="cboard-rate">{Math.round(board.average)}%</td>
              </tr>
              {board.rows.map((row) => (
                <tr key={row.key}>
                  <th className="cboard-label" scope="row">
                    {row.label}
                  </th>
                  {row.cells.map((cell, i) => (
                    <td key={board.dates[i]}>
                      <span className="cboard-cell" data-state={cell}>
                        {cell === 'missed' ? '✕' : ''}
                      </span>
                    </td>
                  ))}
                  <td className="cboard-rate" data-tone={progressTone(row.rate)}>
                    {Math.round(row.rate)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        A filled dot is done, a cross is one you marked missed, an empty circle is
        nothing logged.
      </p>
    </>
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
