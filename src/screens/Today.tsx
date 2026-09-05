import { useMemo, useState } from 'react'
import {
  Card,
  CardHead,
  Check,
  Empty,
  Meter,
  Ring,
  SectionTitle,
  Segmented,
  Stepper,
  TextField,
} from '../components/ui'
import { Sparkline } from '../components/charts'
import TrackerSheet from '../components/TrackerSheet'
import { IconChevron, IconFlame, IconPlus, IconTrash } from '../components/icons'
import {
  CHECKLIST,
  CORE_QUESTIONS,
  ENERGY_LABEL,
  MAX_PRIORITIES,
  METRIC_BY_KEY,
  MORNING,
  PILLARS,
  PRIORITY_RANK,
  PRIORITY_TAGS,
  PROTOCOL_DAYS,
  ROTATING_QUESTIONS,
  SHUTDOWN,
} from '../lib/config'
import type { ChecklistItem, PillarId } from '../lib/config'
import { addDays, blockHours, dayNumber, formatLong, fromISO, todayISO } from '../lib/date'
import { dayIntent } from '../lib/nav'
import { num } from '../lib/format'
import { actions, emptyDay, emptySlots, useStore } from '../lib/store'
import { currentStreak, isItemDone, isLogged, planStatus, scoreDay } from '../lib/selectors'
import type { AppState, DayEntry, Priority, Targets } from '../lib/types'

/**
 * The day runs in three passes: commit to it in the morning, log what happened,
 * then sit with it at night. They are separate on purpose — the morning form
 * has to be fast, and the night form has to be honest, and one screen doing
 * both ends up being neither.
 */
type View = 'plan' | 'log' | 'review'

export default function Today() {
  const state = useStore()
  const [date, setDate] = useState(todayISO())
  // An explicit hand-off from Home or Alex wins; otherwise the hour decides.
  const [view, setView] = useState<View>(
    () => dayIntent.take() ?? (new Date().getHours() < 12 ? 'plan' : 'log'),
  )

  const day = state.days[date] ?? emptyDay(date)
  const score = scoreDay(day, state.targets)
  const plan = planStatus(day)
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
              {plan.set > 0 && ` · ${plan.done}/${plan.set} priorities`}
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
          value={view}
          onChange={setView}
          options={[
            { value: 'plan', label: plan.set ? `Plan · ${plan.set}` : 'Plan' },
            { value: 'log', label: `Log · ${score.score}` },
            { value: 'review', label: 'Review' },
          ]}
        />
      </div>

      {view === 'plan' && <PlanView date={date} day={day} onDone={() => setView('log')} />}
      {view === 'log' && <LogView date={date} day={day} state={state} />}
      {view === 'review' && <ReviewView date={date} day={day} state={state} />}
    </div>
  )
}

// ------------------------------------------------------------------- pieces

/** The tag picker that follows a priority or a block around. */
function TagPicker({
  value,
  onChange,
}: {
  value: Priority['tag']
  onChange: (t: Priority['tag']) => void
}) {
  return (
    <div className="chips">
      {PRIORITY_TAGS.map((t) => (
        <button
          key={t.id}
          className="chip chip-sm"
          aria-pressed={value === t.id}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/**
 * One priority slot. In `plan` mode it is a text field you commit to; in
 * `grade` mode the text is fixed and all you can do is say whether it happened.
 * Separating the two is what stops the evening quietly rewriting the morning.
 */
function PrioritySlot({
  date,
  priority,
  index,
  mode,
  removable,
}: {
  date: string
  priority: Priority
  index: number
  mode: 'plan' | 'grade'
  removable: boolean
}) {
  const rank = PRIORITY_RANK[index] ?? `Also ${index + 1}`

  if (mode === 'grade') {
    return (
      <button
        className="row"
        onClick={() => actions.updatePriority(date, priority.id, { done: !priority.done })}
        role="checkbox"
        aria-checked={priority.done}
      >
        <Check on={priority.done} />
        <span className="row-main">
          <span className="row-title" style={{ opacity: priority.done ? 0.55 : 1 }}>
            {priority.text}
          </span>
          <span className="row-sub">
            {rank}
            {index === 0 && !priority.done ? ' · this was the day' : ''}
          </span>
        </span>
      </button>
    )
  }

  return (
    <div className={`prio${index === 0 ? ' prio-one' : ''}`}>
      <div className="prio-top">
        <span className="prio-rank">{rank}</span>
        {removable && (
          <button
            className="btn btn-quiet btn-danger"
            style={{ marginLeft: 'auto', padding: '2px 6px' }}
            onClick={() => actions.removePriority(date, priority.id)}
            aria-label="Remove priority"
          >
            <IconTrash style={{ width: 15, height: 15 }} />
          </button>
        )}
      </div>
      <input
        className="input"
        value={priority.text}
        placeholder={
          index === 0
            ? 'If only one thing gets done today…'
            : index === 1
              ? 'Second most important'
              : 'Third'
        }
        onChange={(e) => actions.updatePriority(date, priority.id, { text: e.target.value })}
      />
      {priority.text.trim() !== '' && (
        <TagPicker
          value={priority.tag}
          onChange={(tag) => actions.updatePriority(date, priority.id, { tag })}
        />
      )}
    </div>
  )
}

/**
 * Three slots minimum, however few are stored — a day that has never been
 * planned still needs somewhere to write the plan.
 */
function PriorityCard({ date, day, mode }: { date: string; day: DayEntry; mode: 'plan' | 'grade' }) {
  const slots = day.priorities.length ? day.priorities : emptySlots(date)

  if (mode === 'grade') {
    const filled = slots.filter((p) => p.text.trim() !== '')
    if (filled.length === 0) {
      return (
        <Card>
          <Empty>
            No plan was set for this day. That is itself the finding — unplanned days are
            tracked in Patterns.
          </Empty>
        </Card>
      )
    }
    const done = filled.filter((p) => p.done).length
    return (
      <Card>
        <CardHead
          title={`${done} of ${filled.length} kept`}
          action={
            <span style={{ width: 92 }}>
              <Meter pct={(done / filled.length) * 100} />
            </span>
          }
        />
        <div className="rows" style={{ borderTop: '1px solid var(--hairline)' }}>
          {filled.map((p) => (
            <PrioritySlot
              key={p.id}
              date={date}
              priority={p}
              index={slots.indexOf(p)}
              mode="grade"
              removable={false}
            />
          ))}
        </div>
      </Card>
    )
  }

  return (
    <Card>
      {slots.map((p, i) => (
        <PrioritySlot
          key={p.id}
          date={date}
          priority={p}
          index={i}
          mode="plan"
          removable={i >= 3}
        />
      ))}
      {slots.length < MAX_PRIORITIES && (
        <div style={{ padding: '4px 13px 13px' }}>
          <button className="btn btn-quiet btn-sm" onClick={() => actions.addPriority(date)}>
            <IconPlus style={{ width: 14, height: 14 }} />
            Add another
          </button>
        </div>
      )}
    </Card>
  )
}

/** The intended shape of the day. Optional — the three still work without it. */
function BlockCard({ date, day }: { date: string; day: DayEntry }) {
  const planned = day.blocks.reduce((s, b) => s + blockHours(b.start, b.end), 0)

  if (day.blocks.length === 0) {
    return (
      <Card>
        <Empty>No shape set for the day.</Empty>
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: 13,
            borderTop: '1px solid var(--hairline)',
            justifyContent: 'center',
          }}
        >
          <button className="btn btn-sm" onClick={() => actions.seedBlocks(date)}>
            Use my default shape
          </button>
          <button className="btn btn-sm" onClick={() => actions.addBlock(date)}>
            Add a block
          </button>
        </div>
      </Card>
    )
  }

  return (
    <Card>
      {day.blocks.map((b) => (
        <div className="block" key={b.id}>
          <div style={{ display: 'grid', gap: 5 }}>
            <input
              className="input input-time"
              type="time"
              value={b.start}
              onChange={(e) => actions.updateBlock(date, b.id, { start: e.target.value })}
              aria-label="Start"
            />
            <input
              className="input input-time"
              type="time"
              value={b.end}
              onChange={(e) => actions.updateBlock(date, b.id, { end: e.target.value })}
              aria-label="End"
            />
          </div>
          <div style={{ display: 'grid', gap: 7, minWidth: 0 }}>
            <input
              className="input input-plain"
              value={b.label}
              placeholder="What happens in this block"
              onChange={(e) => actions.updateBlock(date, b.id, { label: e.target.value })}
            />
            <TagPicker value={b.tag} onChange={(tag) => actions.updateBlock(date, b.id, { tag })} />
          </div>
          <button
            className="btn btn-quiet btn-danger"
            onClick={() => actions.removeBlock(date, b.id)}
            aria-label="Remove block"
          >
            <IconTrash style={{ width: 16, height: 16 }} />
          </button>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: 13,
          borderTop: '1px solid var(--hairline)',
        }}
      >
        <span className="t-foot muted">{num(planned, 1)} hours planned</span>
        <button className="btn btn-quiet btn-sm" onClick={() => actions.addBlock(date)}>
          <IconPlus style={{ width: 14, height: 14 }} />
          Add block
        </button>
      </div>
    </Card>
  )
}

// --------------------------------------------------------------------- plan

function PlanView({
  date,
  day,
  onDone,
}: {
  date: string
  day: DayEntry
  onDone: () => void
}) {
  const plan = planStatus(day)
  const morningDone = MORNING.filter((m) => day.checks[m.id]).length

  return (
    <>
      <SectionTitle title="The three" />
      <PriorityCard date={date} day={day} mode="plan" />
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Three is the limit on purpose. A list of ten is a wish; three is a commitment.
      </p>

      <SectionTitle title="Shape of the day" />
      <BlockCard date={date} day={day} />

      <SectionTitle title={`Morning · ${morningDone}/${MORNING.length}`} />
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

      <div style={{ marginTop: 16 }}>
        <button
          className={`btn btn-block ${day.planned ? '' : 'btn-primary'}`}
          disabled={plan.set === 0 && !day.planned}
          onClick={() => {
            actions.updateDay(date, { planned: !day.planned })
            if (!day.planned) onDone()
          }}
        >
          {day.planned ? 'Plan committed — reopen' : 'Commit to the day'}
        </button>
      </div>

      <p className="t-foot muted" style={{ textAlign: 'center', marginTop: 14 }}>
        Now close the app. Everything else gets logged tonight.
      </p>
    </>
  )
}

// ---------------------------------------------------------------------- log

function LogView({ date, day, state }: { date: string; day: DayEntry; state: AppState }) {
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

      <p className="t-foot muted" style={{ textAlign: 'center', marginTop: 16 }}>
        Same inputs. Every day. Then go to Review.
      </p>
    </>
  )
}

// ------------------------------------------------------------------- review

function ReviewView({ date, day, state }: { date: string; day: DayEntry; state: AppState }) {
  const tomorrow = addDays(date, 1)
  const tomorrowDay = state.days[tomorrow] ?? emptyDay(tomorrow)
  const tomorrowSet = planStatus(tomorrowDay).set > 0
  const rotating = ROTATING_QUESTIONS[fromISO(date).getDay()]
  const questions = [...CORE_QUESTIONS, rotating]
  const activeLoops = state.loops.filter((l) => !l.archived)

  return (
    <>
      <SectionTitle title="How the plan went" />
      <PriorityCard date={date} day={day} mode="grade" />

      <TrackerSheet date={date} />

      <SectionTitle title="Journal" />
      <Card className="card-pad">
        <textarea
          className="input"
          style={{ minHeight: 132 }}
          value={day.journal}
          placeholder="The day, in your own words. Nobody else reads this."
          onChange={(e) => actions.updateDay(date, { journal: e.target.value })}
        />
      </Card>

      <SectionTitle title="Energy" />
      <Card className="card-pad">
        <div className="energy">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              aria-pressed={day.energy === n}
              onClick={() => actions.updateDay(date, { energy: day.energy === n ? 0 : n })}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="t-foot muted" style={{ marginTop: 9, textAlign: 'center' }}>
          {day.energy ? ENERGY_LABEL[day.energy] : 'How much was in the tank today'}
        </p>
      </Card>

      <SectionTitle title="Three lines" />
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
          <TextField
            label="The lesson"
            value={day.lesson}
            onChange={(v) => actions.updateDay(date, { lesson: v })}
            placeholder="What today teaches tomorrow"
            multiline
          />
        </div>
      </Card>

      <SectionTitle
        title="Which loops ran today?"
        action={<span className="t-foot muted">{day.loops.length} tagged</span>}
      />
      <Card className="card-pad">
        <div className="chips">
          {activeLoops.map((l) => (
            <button
              key={l.id}
              className="chip"
              aria-pressed={day.loops.includes(l.id)}
              onClick={() => actions.toggleLoop(date, l.id)}
              title={l.note}
            >
              {l.label}
            </button>
          ))}
        </div>
        <p className="t-foot muted" style={{ marginTop: 12 }}>
          Tag them honestly or the pattern engine has nothing to find. Edit the list in
          Settings.
        </p>
      </Card>

      <SectionTitle title="Questions" />
      <Card>
        {questions.map((q) => (
          <div className="qa" key={q.id}>
            <div className="qa-q">{q.q}</div>
            {q.hint && <div className="t-foot muted">{q.hint}</div>}
            <textarea
              className="input"
              style={{ minHeight: 62 }}
              value={day.answers[q.id] ?? ''}
              placeholder="…"
              onChange={(e) => actions.setAnswer(date, q.id, e.target.value)}
            />
          </div>
        ))}
      </Card>

      <SectionTitle title="Tomorrow's three" />
      <PriorityCard date={tomorrow} day={tomorrowDay} mode="plan" />
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Set tonight, waiting in the morning. Deciding what matters at 7am is how days get
        handed to whoever shouts loudest.
      </p>

      <SectionTitle title="Shutdown" />
      <Card>
        <div className="rows">
          {SHUTDOWN.map((s) => {
            const on = s.derived ? tomorrowSet : Boolean(day.checks[s.id])
            return (
              <button
                key={s.id}
                className="row"
                onClick={() => !s.derived && actions.toggleCheck(date, s.id)}
                role="checkbox"
                aria-checked={on}
                disabled={s.derived}
              >
                <Check on={on} locked={s.derived} />
                <span className="row-main">
                  <span className="row-title" style={{ opacity: on ? 0.55 : 1 }}>
                    {s.label}
                  </span>
                  {s.hint && <span className="row-sub">{s.hint}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      <div style={{ marginTop: 16 }}>
        <button
          className={`btn btn-block ${day.closed ? '' : 'btn-primary'}`}
          onClick={() => actions.updateDay(date, { closed: !day.closed })}
        >
          {day.closed ? 'Day closed — reopen' : 'Close the day'}
        </button>
      </div>

      <p className="t-foot muted" style={{ textAlign: 'center', marginTop: 16 }}>
        Answered honestly, this is the part that compounds.
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
