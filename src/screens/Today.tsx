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
import TimeLog from '../components/TimeLog'
import DayEdges, { SLEEP_IDS, WAKE_IDS } from '../components/DayEdges'
import { IconChevron, IconFlame, IconPlus, IconTrash } from '../components/icons'
import {
  CORE_QUESTIONS,
  ENERGY_LABEL,
  MAX_PRIORITIES,
  METRIC_BY_KEY,
  PILLARS,
  PRIORITY_RANK,
  PRIORITY_TAGS,
  ROTATING_QUESTIONS,
} from '../lib/config'
import type { ChecklistItem, PillarId } from '../lib/types'
import { addDays, dayNumber, formatLong, formatShort, fromISO, todayISO, weekStartISO } from '../lib/date'
import { dayIntent } from '../lib/nav'
import { num } from '../lib/format'
import { actions, emptyDay, emptySlots, emptyWeek, useStore } from '../lib/store'
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
 * The day runs in three passes: commit to it in the morning, log what happened,
 * then sit with it at night. They are separate on purpose — the morning form
 * has to be fast, and the night form has to be honest, and one screen doing
 * both ends up being neither.
 */
type View = 'plan' | 'time' | 'review'

export default function Today() {
  const state = useStore()
  const [date, setDate] = useState(todayISO())
  // An explicit hand-off from Home or Alex wins; otherwise the hour decides.
  const [view, setView] = useState<View>(
    () => (dayIntent.take() as View | null) ?? (new Date().getHours() < 12 ? 'plan' : 'review'),
  )

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
  }, [state.days, state.targets, date])

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
        <PlanView
          date={date}
          day={day}
          onPickDate={setDate}
          onDone={() => !future && setView('review')}
        />
      )}
      {activeView === 'time' && <TimeLog date={date} day={day} />}

      {activeView === 'review' && (
        <>
          <DayBasics date={date} day={day} state={state} />
          <LogView date={date} day={day} state={state} />
          <ReviewView date={date} day={day} state={state} />
        </>
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

/** A one-line add row, reused under the morning and shutdown lists. */
function AddRitualItem({ onAdd, placeholder }: { onAdd: (label: string) => void; placeholder: string }) {
  const [label, setLabel] = useState('')
  const add = () => {
    if (!label.trim()) return
    onAdd(label.trim())
    setLabel('')
  }
  return (
    <div style={{ display: 'flex', gap: 8, padding: 13, borderTop: '1px solid var(--hairline)' }}>
      <input
        className="input"
        style={{ flex: 1 }}
        placeholder={placeholder}
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
  onDone,
  onPickDate,
}: {
  date: string
  day: DayEntry
  onDone: () => void
  onPickDate: (date: string) => void
}) {
  const state = useStore()
  const plan = planStatus(day)
  const ritual = state.morningRitual
  const morningDone = ritual.filter((m) => day.checks[m.id]).length

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

      <SectionTitle title={`Morning · ${morningDone}/${ritual.length}`} />
      <Card>
        {ritual.length === 0 ? (
          <div style={{ padding: 14 }}>
            <Empty>Nothing set. Add what actually opens your day, right here.</Empty>
          </div>
        ) : (
          <div className="rows">
            {ritual.map((m) => (
              <div key={m.id} className="row">
                <button
                  onClick={() => actions.toggleCheck(date, m.id)}
                  role="checkbox"
                  aria-checked={Boolean(day.checks[m.id])}
                  aria-label={m.label}
                  style={{ display: 'flex' }}
                >
                  <Check on={Boolean(day.checks[m.id])} />
                </button>
                <input
                  className="input input-plain row-main"
                  style={{ opacity: day.checks[m.id] ? 0.55 : 1 }}
                  value={m.label}
                  onChange={(e) => actions.setMorningRitual(ritual.map((x) => (x.id === m.id ? { ...x, label: e.target.value } : x)))}
                />
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => actions.removeMorningItem(m.id)}
                  aria-label="Remove"
                >
                  <IconTrash style={{ width: 15, height: 15 }} />
                </button>
              </div>
            ))}
          </div>
        )}
        <AddRitualItem onAdd={(label) => actions.addMorningItem(label)} placeholder="Add to the morning" />
      </Card>

      <SectionTitle title="The big three" />
      <PriorityCard date={date} day={day} mode="plan" />
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Three is the limit on purpose. A list of ten is a wish; three is a commitment.
      </p>

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

/**
 * The handful of numbers actually logged every day: did the gym happen, what
 * was eaten, how much sleep, how much water. Everything else in the review is
 * downstream of these.
 */
function DayBasics({ date, day, state }: { date: string; day: DayEntry; state: AppState }) {
  const meals = state.trackers.find((t) => t.id === 'tk_meals' && !t.archived)

  return (
    <>
      <SectionTitle title="The day" />
      <Card>
        <div className="rows">
          <div className="row">
            <span className="row-main">
              <span className="row-title">Gym</span>
              <span className="row-sub">
                {day.restDay ? 'Scheduled recovery — no penalty' : 'Counts toward the workouts'}
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

          {([
            ['calories', 'Calories', 'kcal', 50, 0],
            ['sleepHours', 'Sleep', 'h', 0.25, 2],
            ['waterL', 'Water', 'L', 0.25, 2],
          ] as const).map(([key, label, unit, step, dp]) => (
            <div className="row" key={key}>
              <span className="row-main">
                <span className="row-title">{label}</span>
                <span className="row-sub">
                  target {state.targets[key]} {unit}
                </span>
              </span>
              <Stepper
                value={day.metrics[key] || 0}
                step={step}
                dp={dp}
                suffix={unit}
                onChange={(v) => actions.setMetric(date, key, v)}
              />
            </div>
          ))}

          {meals && (
            <div className="row" style={{ flexWrap: 'wrap' }}>
              <span className="row-main">
                <span className="row-title">Meals</span>
                <span className="row-sub">what you actually ate</span>
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
        </div>
      </Card>
    </>
  )
}

function LogView({ date, day, state }: { date: string; day: DayEntry; state: AppState }) {
  return (
    <>
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

function ReviewView({ date, day, state }: { date: string; day: DayEntry; state: AppState }) {
  const tomorrow = addDays(date, 1)
  const tomorrowDay = state.days[tomorrow] ?? emptyDay(tomorrow)
  const tomorrowSet = planStatus(tomorrowDay).set > 0
  const rotating = ROTATING_QUESTIONS[fromISO(date).getDay()]
  const questions = state.nightlyQuestions.length ? state.nightlyQuestions : [...CORE_QUESTIONS, rotating]
  const activeLoops = state.loops.filter((l) => !l.archived)

  return (
    <>
      <SectionTitle title="How the plan went" />
      <PriorityCard date={date} day={day} mode="grade" />

      <TrackerSheet date={date} />

      <DayLog date={date} state={state} />

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

      <DayEdges
        date={date}
        ids={SLEEP_IDS}
        title="End of day"
        hint="Recorded at night, when you actually know them — not guessed at in the morning."
      />

      <SectionTitle title="Shutdown" />
      <Card>
        <div className="rows">
          {/* The one derived row — computed, so it stays fixed rather than editable. */}
          <button
            className="row"
            role="checkbox"
            aria-checked={tomorrowSet}
            disabled
          >
            <Check on={tomorrowSet} locked />
            <span className="row-main">
              <span className="row-title" style={{ opacity: tomorrowSet ? 0.55 : 1 }}>
                Tomorrow's three are set
              </span>
              <span className="row-sub">Filled in above</span>
            </span>
          </button>
          {state.shutdownRitual.map((s) => {
            const on = Boolean(day.checks[s.id])
            return (
              <div key={s.id} className="row">
                <button
                  onClick={() => actions.toggleCheck(date, s.id)}
                  role="checkbox"
                  aria-checked={on}
                  aria-label={s.label}
                  style={{ display: 'flex' }}
                >
                  <Check on={on} />
                </button>
                <input
                  className="input input-plain row-main"
                  style={{ opacity: on ? 0.55 : 1 }}
                  value={s.label}
                  onChange={(e) =>
                    actions.setShutdownRitual(
                      state.shutdownRitual.map((x) => (x.id === s.id ? { ...x, label: e.target.value } : x)),
                    )
                  }
                />
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => actions.removeShutdownItem(s.id)}
                  aria-label="Remove"
                >
                  <IconTrash style={{ width: 15, height: 15 }} />
                </button>
              </div>
            )
          })}
        </div>
        <AddRitualItem onAdd={(label) => actions.addShutdownItem(label)} placeholder="Add to shutdown" />
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
  const items = state.checklist.filter((i) => i.pillar === pillar)
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
        {derived && <span className="row-sub">Set with Gym above</span>}
      </span>
      <span className="row-value muted">{item.points}</span>
    </button>
  )
}
