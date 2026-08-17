import { useMemo, useState } from 'react'
import {
  Card,
  CardHead,
  Check,
  Meter,
  Ring,
  SectionTitle,
  Segmented,
  Stepper,
  TextField,
} from '../components/ui'
import { Sparkline } from '../components/charts'
import { IconChevron, IconFlame } from '../components/icons'
import { CHECKLIST, METRIC_BY_KEY, MORNING, PILLARS, PROTOCOL_DAYS } from '../lib/config'
import type { ChecklistItem, PillarId } from '../lib/config'
import { addDays, dayNumber, formatLong, todayISO } from '../lib/date'
import { num } from '../lib/format'
import { actions, emptyDay, useStore } from '../lib/store'
import { currentStreak, isItemDone, isLogged, scoreDay } from '../lib/selectors'
import type { AppState, DayEntry, Targets } from '../lib/types'

type Form = 'morning' | 'evening'

export default function Today() {
  const state = useStore()
  const [date, setDate] = useState(todayISO())
  // Before 11am the morning form is the one you want open.
  const [form, setForm] = useState<Form>(new Date().getHours() < 11 ? 'morning' : 'evening')

  const day = state.days[date] ?? emptyDay(date)
  const score = scoreDay(day, state.targets)
  const dayNo = dayNumber(state.startDate, date)
  const streak = currentStreak(state, todayISO())

  const recent = useMemo(() => {
    const out: number[] = []
    for (let i = 13; i >= 0; i--) {
      const d = state.days[addDays(date, -i)]
      out.push(isLogged(d) ? scoreDay(d, state.targets).score : 0)
    }
    return out
  }, [state.days, state.targets, date])

  const inWindow = dayNo >= 1 && dayNo <= PROTOCOL_DAYS
  const morningDone = MORNING.filter((m) => day.checks[m.id]).length

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            {inWindow ? `Day ${dayNo} of ${PROTOCOL_DAYS}` : 'Outside the protocol window'}
          </span>
          {streak > 0 && (
            <span className="pill pill-accent">
              <IconFlame style={{ width: 12, height: 12 }} />
              {streak} day{streak === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h1 className="t-large" style={{ flex: 1 }}>
            {date === todayISO() ? 'Today' : formatLong(date)}
          </h1>
          <button
            className="btn btn-quiet"
            onClick={() => setDate(addDays(date, -1))}
            aria-label="Previous day"
          >
            <IconChevron style={{ width: 18, height: 18, transform: 'rotate(180deg)' }} />
          </button>
          <button
            className="btn btn-quiet"
            onClick={() => setDate(addDays(date, 1))}
            aria-label="Next day"
            disabled={date >= todayISO()}
          >
            <IconChevron style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <p className="t-sub" style={{ marginTop: 2 }}>
          {formatLong(date)}
          {day.restDay && ' · scheduled recovery'}
        </p>
      </header>

      <Card className="card-pad">
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Ring pct={score.score} size={124} stroke={11}>
            <div className="hero" style={{ fontSize: 38 }}>
              {score.score}
            </div>
            <div className="t-cap" style={{ marginTop: 2 }}>
              of 100
            </div>
          </Ring>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-head" style={{ marginBottom: 3 }}>
              {score.score >= 80 ? 'Winning day' : score.score >= 50 ? 'Half a day' : 'Not yet'}
            </div>
            <div className="t-foot" style={{ marginBottom: 12 }}>
              {score.done} of {score.total} standards met
            </div>
            <div style={{ display: 'grid', gap: 9 }}>
              {score.pillars.map((p) => (
                <div key={p.id}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 12,
                      marginBottom: 4,
                    }}
                  >
                    <span className="dim">{p.label}</span>
                    <span className="t-num muted">
                      {p.earned}/{p.possible}
                    </span>
                  </div>
                  <Meter pct={(p.earned / p.possible) * 100} />
                </div>
              ))}
            </div>
          </div>
        </div>
        {recent.some((v) => v > 0) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid var(--hairline)',
            }}
          >
            <span className="t-cap">Last 14 days</span>
            <Sparkline values={recent} />
          </div>
        )}
      </Card>

      <div style={{ marginTop: 18 }}>
        <Segmented
          value={form}
          onChange={setForm}
          options={[
            { value: 'morning', label: `Morning · ${morningDone}/${MORNING.length}` },
            { value: 'evening', label: 'End of day' },
          ]}
        />
      </div>

      {form === 'morning' ? (
        <MorningForm date={date} day={day} onDone={() => setForm('evening')} />
      ) : (
        <EveningForm date={date} day={day} state={state} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------- morning

function MorningForm({
  date,
  day,
  onDone,
}: {
  date: string
  day: DayEntry
  onDone: () => void
}) {
  const all = MORNING.every((m) => day.checks[m.id])
  return (
    <>
      <SectionTitle title="Morning" />
      <Card>
        <div className="rows">
          {MORNING.map((m) => (
            <button
              key={m.id}
              className="row"
              onClick={() => actions.toggleCheck(date, m.id)}
              role="checkbox"
              aria-checked={Boolean(day.checks[m.id])}
            >
              <Check on={Boolean(day.checks[m.id])} />
              <span className="row-main">
                <span className="row-title" style={{ opacity: day.checks[m.id] ? 0.55 : 1 }}>
                  {m.label}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Card>

      <p className="t-foot muted" style={{ padding: '14px 4px 0' }}>
        That's the whole morning. Everything else gets logged tonight — don't sit in the app
        during the day.
      </p>

      {all && (
        <button className="btn btn-block" style={{ marginTop: 14 }} onClick={onDone}>
          Go to the end-of-day form
        </button>
      )}
    </>
  )
}

// ---------------------------------------------------------------- evening

function EveningForm({
  date,
  day,
  state,
}: {
  date: string
  day: DayEntry
  state: AppState
}) {
  return (
    <>
      <SectionTitle title="Training" />
      <Card>
        <div className="rows">
          <button
            className="row"
            onClick={() => actions.updateDay(date, { trained: !day.trained, restDay: false })}
            role="checkbox"
            aria-checked={day.trained}
          >
            <Check on={day.trained} />
            <span className="row-main">
              <span className="row-title">Trained today</span>
              <span className="row-sub">Counts toward the 108 workouts</span>
            </span>
          </button>
          <button
            className="row"
            onClick={() => actions.updateDay(date, { restDay: !day.restDay, trained: false })}
            role="checkbox"
            aria-checked={day.restDay}
          >
            <Check on={day.restDay} />
            <span className="row-main">
              <span className="row-title">Scheduled recovery day</span>
              <span className="row-sub">Recovery is part of training — no penalty</span>
            </span>
          </button>
        </div>
      </Card>

      {PILLARS.map((p) => (
        <PillarCard key={p.id} pillar={p.id} label={p.label} date={date} day={day} state={state} />
      ))}

      <SectionTitle title="Two lines" />
      <Card className="card-pad">
        <div style={{ display: 'grid', gap: 14 }}>
          <TextField
            label="Biggest win"
            value={day.biggestWin}
            onChange={(v) => actions.updateDay(date, { biggestWin: v })}
            placeholder="What actually moved"
            multiline
          />
          <TextField
            label="Biggest mistake"
            value={day.biggestMistake}
            onChange={(v) => actions.updateDay(date, { biggestMistake: v })}
            placeholder="Name it, don't repeat it"
            multiline
          />
        </div>
      </Card>

      <div style={{ marginTop: 14 }}>
        <button
          className={`btn btn-block ${day.closed ? '' : 'btn-primary'}`}
          onClick={() => actions.updateDay(date, { closed: !day.closed })}
        >
          {day.closed ? 'Day closed — reopen' : 'Close the day'}
        </button>
      </div>

      <p className="t-foot muted" style={{ textAlign: 'center', marginTop: 16 }}>
        Same inputs. Every day.
      </p>
    </>
  )
}

// ---------------------------------------------------------------- pillars

function PillarCard({
  pillar,
  label,
  date,
  day,
  state,
}: {
  pillar: PillarId
  label: string
  date: string
  day: DayEntry
  state: AppState
}) {
  const items = CHECKLIST.filter((i) => i.pillar === pillar)
  const earned = items.reduce(
    (s, i) => s + (isItemDone(i, day, state.targets) ? i.points : 0),
    0,
  )
  const possible = items.reduce((s, i) => s + i.points, 0)

  return (
    <>
      <SectionTitle title={label} />
      <Card>
        <CardHead
          title={`${earned} / ${possible} points`}
          action={
            <span style={{ width: 92 }}>
              <Meter pct={(earned / possible) * 100} />
            </span>
          }
        />
        <div className="rows" style={{ borderTop: '1px solid var(--hairline)' }}>
          {items.map((item) => (
            <ItemRow key={item.id} item={item} date={date} day={day} targets={state.targets} />
          ))}
        </div>
      </Card>
    </>
  )
}

function ItemRow({
  item,
  date,
  day,
  targets,
}: {
  item: ChecklistItem
  date: string
  day: DayEntry
  targets: Targets
}) {
  const done = isItemDone(item, day, targets)

  // Rows with a number are graded off the number, so the tick fills or clears
  // it rather than drifting out of sync with the logged value.
  if (item.metric) {
    const spec = METRIC_BY_KEY[item.metric]
    const target = targets[item.metric as keyof Targets] as number
    const value = day.metrics[item.metric]
    const quick = () => {
      if (item.invert) actions.setMetric(date, item.metric!, done ? target + spec.step : 0)
      else actions.setMetric(date, item.metric!, done ? 0 : target)
    }
    return (
      <div className="row row-metric">
        <button
          onClick={quick}
          aria-label={`${item.label} — set to target`}
          style={{ display: 'flex' }}
        >
          <Check on={done} />
        </button>
        <span className="row-main">
          <span className="row-title" style={{ opacity: done ? 0.6 : 1 }}>
            {item.label}
          </span>
          <span className="row-sub">
            {item.invert ? 'Ceiling' : 'Target'} {num(target, spec.dp)}
            {spec.unit && ` ${spec.unit}`}
            {item.hint ? ` · ${item.hint}` : ''}
          </span>
        </span>
        <Stepper
          value={value}
          step={spec.step}
          dp={spec.dp}
          suffix={spec.unit}
          onChange={(v) => actions.setMetric(date, item.metric!, v)}
        />
      </div>
    )
  }

  const derived = item.id === 'training'
  return (
    <button
      className="row"
      onClick={() => !derived && actions.toggleCheck(date, item.id)}
      role="checkbox"
      aria-checked={done}
      disabled={derived}
    >
      <Check on={done} locked={derived} />
      <span className="row-main">
        <span className="row-title" style={{ opacity: done ? 0.6 : 1 }}>
          {item.label}
        </span>
        {derived && <span className="row-sub">Set in the Training card above</span>}
      </span>
      <span className="row-value muted">{item.points}</span>
    </button>
  )
}
