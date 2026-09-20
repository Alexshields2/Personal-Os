import { Fragment, useMemo, useState } from 'react'
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
} from '../components/ui'
import { Sparkline } from '../components/charts'
import TrackerSheet from '../components/TrackerSheet'
import TimeLog from '../components/TimeLog'
import DayEdges, { SLEEP_IDS, WAKE_IDS } from '../components/DayEdges'
import { IconChevron, IconFlame, IconPlus, IconTrash } from '../components/icons'
import { MAX_PRIORITIES, METRIC_BY_KEY, PILLARS, PRIORITY_RANK, PRIORITY_TAGS } from '../lib/config'
import type { ChecklistItem } from '../lib/types'
import { addDays, dayNumber, formatLong, formatShort, todayISO, weekStartISO } from '../lib/date'
import { num } from '../lib/format'
import { actions, byTime, emptyDay, emptySlots, emptyWeek, useStore } from '../lib/store'
import {
  currentStreak,
  isItemDone,
  isLogged,
  planStatus,
  scoreDay,
  tasksTouchedOn,
} from '../lib/selectors'
import type { AppState, DayEntry, Priority, Targets } from '../lib/types'

/**
 * The day in three tabs. Plan is the morning: the week's notes, the SOP, the
 * big three. Time is the quarter-hour log, filled in as the day goes. Review
 * is the night: the non-negotiables checked off, the three graded, the day
 * closed. Each one is short on purpose — a form that takes ten minutes stops
 * getting filled in by day nine.
 */
type View = 'plan' | 'time' | 'review'

export default function Today() {
  const state = useStore()
  const [date, setDate] = useState(todayISO())
  // Mornings open on the plan, evenings on the review.
  const [view, setView] = useState<View>(() => (new Date().getHours() < 12 ? 'plan' : 'review'))

  const day = state.days[date] ?? emptyDay(date)
  const score = scoreDay(day, state.targets, state.checklist)
  // Tomorrow can be planned but not logged or graded — there is nothing to
  // grade yet, and offering the form invites fiction.
  const future = date > todayISO()
  const activeView: View = future ? 'plan' : view
  const plan = planStatus(day)
  const dayNo = dayNumber(state.startDate, date)
  const streak = currentStreak(state, todayISO())

  const recent = useMemo(() => {
    const out: number[] = []
    for (let i = 13; i >= 0; i--) {
      const d = state.days[addDays(date, -i)]
      out.push(isLogged(d) ? scoreDay(d, state.targets, state.checklist).score : 0)
    }
    return out
  }, [state.days, state.targets, state.checklist, date])

  const inWindow = dayNo >= 1 && dayNo <= state.targets.protocolDays

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            {inWindow ? `Day ${dayNo} of ${state.targets.protocolDays}` : 'Outside the protocol window'}
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
            disabled={date >= addDays(todayISO(), 7)}
          >
            <IconChevron style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <p className="t-sub" style={{ marginTop: 2 }}>
          {formatLong(date)}
          {day.restDay && ' · scheduled recovery'}
        </p>
      </header>

      {/* A day that hasn't happened has nothing to score — showing 2/100 for
          tomorrow reads as a verdict rather than an empty form. */}
      {future ? (
        <Card className="card-pad">
          <div className="t-cap">Planning ahead</div>
          <div className="t-head" style={{ marginTop: 4 }}>{formatLong(date)}</div>
          <p className="t-foot muted" style={{ marginTop: 6 }}>
            Set the three and the shape now. It gets scored on the day, not before.
          </p>
        </Card>
      ) : (
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
      )}

      <div style={{ marginTop: 18 }}>
        <Segmented
          value={activeView}
          onChange={setView}
          options={
            future
              ? [{ value: 'plan', label: 'Plan ahead' }]
              : [
                  { value: 'plan', label: plan.set ? `Plan · ${plan.set}` : 'Plan' },
                  { value: 'time', label: 'Time' },
                  { value: 'review', label: `Review · ${score.score}` },
                ]
          }
        />
      </div>

      {activeView === 'plan' && (
        <PlanView date={date} day={day} onPickDate={setDate} />
      )}
      {activeView === 'time' && <TimeLog date={date} day={day} />}

      {activeView === 'review' && (
        <ReviewView
          date={date}
          day={day}
          state={state}
          onPlanTomorrow={() => {
            setDate(addDays(date, 1))
            setView('plan')
          }}
        />
      )}
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
          <Empty>No three were set for this day.</Empty>
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

// --------------------------------------------------------------------- plan

/**
 * The week in a sentence, written once and read every morning. Lives on the
 * week rather than the day, so Monday's thinking is still in front of you on
 * Thursday instead of scrolling away with the date.
 */
function WeekPlan({ date }: { date: string }) {
  const state = useStore()
  const weekStart = weekStartISO(date)
  const week = state.weeks[weekStart] ?? emptyWeek(weekStart)

  return (
    <>
      <SectionTitle
        title="This week"
        action={<span className="t-foot muted">{formatShort(weekStart)}</span>}
      />
      <Card className="card-pad">
        <textarea
          className="input"
          style={{ minHeight: 78 }}
          value={week.plan}
          placeholder="What has to happen this week. Notes, not tasks."
          onChange={(e) => actions.updateWeek(weekStart, { plan: e.target.value })}
        />
      </Card>
    </>
  )
}

/**
 * The morning SOP, grouped the way it is written: everything at 06:00, then
 * 06:20, then the gym, then ready, then deep work. A block's time is edited
 * on its header and moves every step in it; a step added with a time lands
 * in that block. Order is settled when a time field is left, not while it is
 * being typed in, so the field being edited never jumps out from under you.
 */
function MorningCard({ date, day }: { date: string; day: DayEntry }) {
  const state = useStore()
  const ritual = state.morningRitual
  const done = ritual.filter((m) => day.checks[m.id]).length

  const blocks: { key: string; at: string; items: typeof ritual }[] = []
  for (const m of ritual) {
    const at = m.at ?? ''
    const last = blocks[blocks.length - 1]
    if (last && last.at === at) last.items.push(m)
    else blocks.push({ key: m.id, at, items: [m] })
  }

  const retime = (items: typeof ritual, at: string) => {
    const ids = new Set(items.map((m) => m.id))
    actions.setMorningRitual(ritual.map((m) => (ids.has(m.id) ? { ...m, at: at || undefined } : m)))
  }
  const settle = () => actions.setMorningRitual(byTime(state.morningRitual))

  return (
    <>
      <SectionTitle
        title="Morning"
        action={<span className="t-foot muted">{done}/{ritual.length}</span>}
      />
      <Card>
        {ritual.length === 0 ? (
          <div style={{ padding: 14 }}>
            <Empty>Nothing set. Add what actually opens your day, right here.</Empty>
          </div>
        ) : (
          <div className="rows">
            {blocks.map((b) => (
              <Fragment key={b.key}>
                <div className="row-group sop-head">
                  <input
                    type="time"
                    className="input input-plain sop-time"
                    value={b.at}
                    aria-label="Block time"
                    onChange={(e) => retime(b.items, e.target.value)}
                    onBlur={settle}
                  />
                  <span className="t-foot muted">
                    {b.items.filter((m) => day.checks[m.id]).length}/{b.items.length}
                  </span>
                </div>
                {b.items.map((m) => {
                  const on = Boolean(day.checks[m.id])
                  return (
                    <div key={m.id} className="row">
                      <button
                        onClick={() => actions.toggleCheck(date, m.id)}
                        role="checkbox"
                        aria-checked={on}
                        aria-label={m.label}
                        style={{ display: 'flex' }}
                      >
                        <Check on={on} />
                      </button>
                      <input
                        className="input input-plain row-main"
                        style={{ opacity: on ? 0.55 : 1 }}
                        value={m.label}
                        onChange={(e) =>
                          actions.setMorningRitual(
                            ritual.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)),
                          )
                        }
                      />
                      <button
                        className="btn btn-quiet btn-danger"
                        onClick={() => actions.removeMorningItem(m.id)}
                        aria-label="Remove"
                      >
                        <IconTrash style={{ width: 15, height: 15 }} />
                      </button>
                    </div>
                  )
                })}
              </Fragment>
            ))}
          </div>
        )}
        <AddMorningStep defaultAt={blocks[blocks.length - 1]?.at ?? ''} />
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Win the morning before the rest of the world gets access to you.
      </p>
    </>
  )
}

/** Time and words for a new step. The time defaults to the last block's. */
function AddMorningStep({ defaultAt }: { defaultAt: string }) {
  const [label, setLabel] = useState('')
  const [at, setAt] = useState<string | null>(null)
  const time = at ?? defaultAt
  const add = () => {
    if (!label.trim()) return
    actions.addMorningItem(label.trim(), time)
    setLabel('')
  }
  return (
    <div style={{ display: 'flex', gap: 8, padding: 13, borderTop: '1px solid var(--hairline)' }}>
      <input
        type="time"
        className="input input-time"
        value={time}
        aria-label="Time for the new step"
        onChange={(e) => setAt(e.target.value)}
      />
      <input
        className="input"
        style={{ flex: 1, minWidth: 0 }}
        placeholder="Add to the morning"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
      <button className="btn" onClick={add} disabled={!label.trim()} aria-label="Add">
        <IconPlus style={{ width: 16, height: 16 }} />
      </button>
    </div>
  )
}

function PlanView({
  date,
  day,
  onPickDate,
}: {
  date: string
  day: DayEntry
  onPickDate: (date: string) => void
}) {
  const plan = planStatus(day)

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <Segmented
          value={date === todayISO() ? 'today' : date === addDays(todayISO(), 1) ? 'tomorrow' : 'other'}
          onChange={(v: string) => {
            if (v === 'today') onPickDate(todayISO())
            if (v === 'tomorrow') onPickDate(addDays(todayISO(), 1))
          }}
          options={[
            { value: 'today', label: 'Plan today' },
            { value: 'tomorrow', label: 'Plan tomorrow' },
            ...(date !== todayISO() && date !== addDays(todayISO(), 1)
              ? [{ value: 'other', label: formatLong(date) }]
              : []),
          ]}
        />
      </div>

      <WeekPlan date={date} />

      <DayEdges
        date={date}
        ids={WAKE_IDS}
        title="Woke at"
        hint=""
      />

      <MorningCard date={date} day={day} />

      <SectionTitle title="The big three" />
      <PriorityCard date={date} day={day} mode="plan" />
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Three is the limit on purpose. A list of ten is a wish; three is a commitment.
      </p>

      <div style={{ marginTop: 16 }}>
        <button
          className={`btn btn-block ${day.planned ? '' : 'btn-primary'}`}
          disabled={plan.set === 0 && !day.planned}
          onClick={() => actions.updateDay(date, { planned: !day.planned })}
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

// ------------------------------------------------------------------- review

/**
 * Every standard the day is scored on, checked off in one list. Yes/no ones
 * are a tap. The ones that are really a number — office hours, calories,
 * sleep, water, pages, scrolling — take the number and tick themselves once
 * it clears the target, so each thing is logged once, in one place, and the
 * score can never disagree with what was entered.
 */
function NonNegotiables({ date, day, state }: { date: string; day: DayEntry; state: AppState }) {
  const items = state.checklist
  const done = items.filter((i) => isItemDone(i, day, state.targets)).length
  const meals = state.trackers.find((t) => t.id === 'tk_meals' && !t.archived)
  // Meals sit under calories, or at the end if calories has been removed.
  const mealsAfter = (items.find((i) => i.id === 'calories') ?? items[items.length - 1])?.id
  const groups = PILLARS.map((p) => ({ ...p, items: items.filter((i) => i.pillar === p.id) })).filter(
    (g) => g.items.length > 0,
  )

  return (
    <>
      <SectionTitle
        title="Non-negotiables"
        action={
          <span className="t-foot muted">
            {done} of {items.length}
          </span>
        }
      />
      <Card>
        {items.length === 0 ? (
          <Empty>No standards set. Add them in Settings.</Empty>
        ) : (
          <div className="rows">
            {groups.map((g) => (
              <Fragment key={g.id}>
                <div className="row-group t-cap">{g.label}</div>
                {g.items.map((item) => (
                  <Fragment key={item.id}>
                    <StandardRow item={item} date={date} day={day} targets={state.targets} />
                    {meals && item.id === mealsAfter && (
                      <div className="row" style={{ flexWrap: 'wrap' }}>
                        <span className="row-main">
                          <span className="row-title">Meals</span>
                          <span className="row-sub">What you actually ate</span>
                        </span>
                        <input
                          className="input"
                          style={{ flex: '1 1 220px' }}
                          value={day.trackerNotes?.[meals.id] ?? ''}
                          placeholder="Eggs, chicken and rice, protein shake…"
                          onChange={(e) => actions.setTrackerNote(date, meals.id, e.target.value)}
                        />
                      </div>
                    )}
                  </Fragment>
                ))}
              </Fragment>
            ))}
          </div>
        )}
      </Card>
    </>
  )
}

function StandardRow({
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

  // The gym is a yes, a planned rest, or not yet — never a number.
  if (item.id === 'training') {
    return (
      <div className="row">
        <Check on={done} />
        <span className="row-main">
          <span className="row-title" style={{ opacity: done ? 0.6 : 1 }}>
            {item.label}
          </span>
          <span className="row-sub">
            {day.restDay ? 'Scheduled recovery — no penalty' : day.trained ? 'Trained' : 'Did you train?'}
          </span>
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            className="btn btn-sm"
            aria-pressed={day.trained}
            style={day.trained ? { background: 'var(--won)', color: 'var(--on-accent)' } : undefined}
            onClick={() => actions.updateDay(date, { trained: !day.trained, restDay: false })}
          >
            Yes
          </button>
          <button
            className="btn btn-sm"
            aria-pressed={day.restDay}
            style={day.restDay ? { background: 'var(--fill-strong)' } : undefined}
            onClick={() => actions.updateDay(date, { restDay: !day.restDay, trained: false })}
          >
            Rest
          </button>
        </div>
      </div>
    )
  }

  // A number is graded off the number, so the tick fills or clears it rather
  // than drifting out of step with what was logged.
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
        <button onClick={quick} aria-label={`${item.label} — set to target`} style={{ display: 'flex' }}>
          <Check on={done} />
        </button>
        <span className="row-main">
          <span className="row-title" style={{ opacity: done ? 0.6 : 1 }}>
            {item.label}
          </span>
          <span className="row-sub">
            {item.invert ? 'At most' : 'Target'} {num(target, spec.dp)}
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

  return (
    <button
      className="row"
      onClick={() => actions.toggleCheck(date, item.id)}
      role="checkbox"
      aria-checked={done}
    >
      <Check on={done} />
      <span className="row-main">
        <span className="row-title" style={{ opacity: done ? 0.6 : 1 }}>
          {item.label}
        </span>
        {item.hint && <span className="row-sub">{item.hint}</span>}
      </span>
    </button>
  )
}

/**
 * Every task that touched this day, in one place, each with a one-tap link
 * to the goal it moved forward. This is the cause; goalContribution (read on
 * Goals) is the effect — a straight count of what actually got tagged,
 * nothing inferred.
 */
function DayLog({ date, state }: { date: string; state: AppState }) {
  const tasks = tasksTouchedOn(state, date)
  const openGoals = state.goals.filter((g) => !g.done)

  return (
    <>
      <SectionTitle
        title="Today's log"
        action={<span className="t-foot muted">{tasks.length} task{tasks.length === 1 ? '' : 's'}</span>}
      />
      <Card>
        {tasks.length === 0 ? (
          <Empty>Nothing scheduled or finished today.</Empty>
        ) : (
          <div className="rows">
            {tasks.map((t) => (
              <div className="row" key={t.id}>
                <span className="row-main">
                  <span className="row-title" style={{ opacity: t.done ? 1 : 0.55 }}>
                    {t.title}
                  </span>
                  <span className="row-sub">{t.done ? 'Done' : 'Not done'}</span>
                </span>
                <select
                  className="input"
                  style={{ width: 160, flex: 'none' }}
                  value={t.goalId}
                  onChange={(e) => actions.updateTask(t.id, { goalId: e.target.value })}
                >
                  <option value="">No goal</option>
                  {openGoals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Tag what each one was actually for. Goals adds these up so you can see what's feeding
        what, and what's just noise.
      </p>
    </>
  )
}

function ReviewView({
  date,
  day,
  state,
  onPlanTomorrow,
}: {
  date: string
  day: DayEntry
  state: AppState
  onPlanTomorrow: () => void
}) {
  const touched = tasksTouchedOn(state, date).length > 0

  return (
    <>
      <NonNegotiables date={date} day={day} state={state} />

      <SectionTitle title="How the three went" />
      <PriorityCard date={date} day={day} mode="grade" />

      {touched && <DayLog date={date} state={state} />}

      {/* Only there if you have switched a tracker on in Settings. */}
      <TrackerSheet date={date} hideWhenEmpty />

      <DayEdges
        date={date}
        ids={SLEEP_IDS}
        title="End of day"
        hint="Recorded at night, when you actually know them."
      />

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

      <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
        <button
          className={`btn btn-block ${day.closed ? '' : 'btn-primary'}`}
          onClick={() => actions.updateDay(date, { closed: !day.closed })}
        >
          {day.closed ? 'Day closed — reopen' : 'Close the day'}
        </button>
        <button className="btn btn-block" onClick={onPlanTomorrow}>
          Plan tomorrow
        </button>
      </div>
    </>
  )
}
