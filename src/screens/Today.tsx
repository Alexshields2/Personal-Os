import { useMemo, useState } from 'react'
import { Card, Check, Empty, GrowText, SectionTitle, Segmented, Stepper } from '../components/ui'
import TimeLog from '../components/TimeLog'
import { IconChevron, IconPlus, IconTrash } from '../components/icons'
import { ACCOUNT_LABEL, PURSE_LABEL } from '../lib/config'
import {
  addDays,
  formatLong,
  formatShort,
  hoursMinutes,
  sleepMinutes,
  todayISO,
  weekStartISO,
} from '../lib/date'
import { euro, num, uid } from '../lib/format'
import { actions, emptyDay, emptyWeek, newTask, useStore } from '../lib/store'
import { lastGymSets, todoFor } from '../lib/selectors'
import { ACCOUNT_OWNER, BANK_ACCOUNTS } from '../lib/types'
import type { AccountId, DayEntry, Exercise, Purse, Targets } from '../lib/types'

/**
 * The whole day on one page, top to bottom in the order it happens: the
 * week's notes and today's, how you slept, the to-do, habits, the gym, food
 * and water, the close-out, and what was spent. The quarter-hour log is the
 * only other tab. Nothing is scored here — every section is something you
 * actually log.
 */
type View = 'day' | 'time'

const CLOTHES = 'lay_out_clothes'

export default function Today({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const state = useStore()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [view, setView] = useState<View>('day')

  const day = state.days[date] ?? emptyDay(date)
  // Tomorrow can be planned — notes and to-dos — but not logged.
  const future = date > today

  const title =
    date === today
      ? 'Today'
      : date === addDays(today, 1)
        ? 'Tomorrow'
        : date === addDays(today, -1)
          ? 'Yesterday'
          : formatShort(date)

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 className="t-large" style={{ flex: 1 }}>
            {title}
          </h1>
          {date !== today && (
            <button className="btn btn-sm" onClick={() => setDate(today)}>
              Today
            </button>
          )}
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
            disabled={date >= addDays(today, 7)}
          >
            <IconChevron style={{ width: 18, height: 18 }} />
          </button>
        </div>
        <p className="t-sub" style={{ marginTop: 2 }}>
          {formatLong(date)}
        </p>
      </header>

      <Segmented
        value={view}
        onChange={setView}
        options={[
          { value: 'day', label: 'Today' },
          { value: 'time', label: 'Every 15 min' },
        ]}
      />

      {view === 'time' ? (
        <TimeLog date={date} day={day} />
      ) : (
        <>
          <Notes date={date} day={day} />
          {!future && <Sleep date={date} day={day} targets={state.targets} />}
          <Todo date={date} onOpenWork={() => onNavigate?.('work')} />
          {!future && (
            <>
              <Habits date={date} day={day} />
              <Gym date={date} day={day} />
              <FoodAndWater date={date} day={day} targets={state.targets} />
              <EndOfDay date={date} day={day} targets={state.targets} />
              <MoneySpent date={date} />
            </>
          )}
        </>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ helpers

/** "12", "12.5" and "12,5" are numbers; blank is "not logged". */
function parseNum(raw: string): number | null {
  const t = raw.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/**
 * A text field and a plus button. Enter adds too. Used for every "add one"
 * row on the page, so they all behave the same.
 */
function AddRow({
  placeholder,
  onAdd,
  divider = false,
}: {
  placeholder: string
  onAdd: (text: string) => void
  divider?: boolean
}) {
  const [text, setText] = useState('')
  const add = () => {
    if (!text.trim()) return
    onAdd(text.trim())
    setText('')
  }
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: 13,
        borderTop: divider ? '1px solid var(--hairline)' : 'none',
      }}
    >
      <input
        className="input"
        style={{ flex: 1, minWidth: 0 }}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
      />
      <button className="btn" onClick={add} disabled={!text.trim()} aria-label="Add">
        <IconPlus style={{ width: 16, height: 16 }} />
      </button>
    </div>
  )
}

function EditToggle({ editing, onToggle }: { editing: boolean; onToggle: () => void }) {
  return (
    <button className="btn btn-quiet btn-sm" onClick={onToggle}>
      {editing ? 'Done' : 'Edit'}
    </button>
  )
}

// -------------------------------------------------------------------- notes

/**
 * The week's notes sit above the day's. The week's live on the week, so
 * Monday's thinking is still in front of you on Thursday.
 */
function Notes({ date, day }: { date: string; day: DayEntry }) {
  const state = useStore()
  const weekStart = weekStartISO(date)
  const week = state.weeks[weekStart] ?? emptyWeek(weekStart)

  return (
    <>
      <SectionTitle
        title="This week"
        action={<span className="t-foot muted">w/c {formatShort(weekStart)}</span>}
      />
      <Card className="card-pad">
        <textarea
          className="input"
          style={{ minHeight: 72 }}
          value={week.plan}
          placeholder="Notes for the week."
          onChange={(e) => actions.updateWeek(weekStart, { plan: e.target.value })}
        />
      </Card>

      <SectionTitle title="Notes" />
      <Card className="card-pad">
        <textarea
          className="input"
          style={{ minHeight: 72 }}
          value={day.journal}
          placeholder="Notes for the day."
          onChange={(e) => actions.updateDay(date, { journal: e.target.value })}
        />
      </Card>
    </>
  )
}

// -------------------------------------------------------------------- sleep

/** Two clock times in, hours slept out. Both belong to the morning they end. */
function Sleep({ date, day, targets }: { date: string; day: DayEntry; targets: Targets }) {
  const mins = sleepMinutes(day.bedtime, day.wakeTime)
  const hit = mins !== null && mins >= targets.sleepHours * 60

  return (
    <>
      <SectionTitle title="Sleep" />
      <Card>
        <div className="rows">
          <div className="row">
            <span className="row-main">
              <span className="row-title">Asleep last night</span>
            </span>
            <input
              type="time"
              className="input input-time"
              value={day.bedtime}
              aria-label="Asleep last night"
              onChange={(e) => actions.setSleep(date, { bedtime: e.target.value })}
            />
          </div>
          <div className="row">
            <span className="row-main">
              <span className="row-title">Woke up</span>
            </span>
            <input
              type="time"
              className="input input-time"
              value={day.wakeTime}
              aria-label="Woke up"
              onChange={(e) => actions.setSleep(date, { wakeTime: e.target.value })}
            />
          </div>
          <div className="row">
            <span className="row-main">
              <span className="row-title">Slept</span>
              <span className="row-sub">Target {num(targets.sleepHours, 2)} h</span>
            </span>
            <span className="sleep-total" data-hit={hit}>
              {mins === null ? '—' : hoursMinutes(mins)}
            </span>
          </div>
        </div>
      </Card>
    </>
  )
}

// -------------------------------------------------------------------- to-do

/**
 * Work's tasks for the day. Adding one here adds it to Work, ticking it here
 * ticks it there — one list, two ways in.
 */
function Todo({ date, onOpenWork }: { date: string; onOpenWork: () => void }) {
  const state = useStore()
  const tasks = todoFor(state, date)
  const done = tasks.filter((t) => t.done).length

  return (
    <>
      <SectionTitle
        title={tasks.length ? `To-do · ${done}/${tasks.length}` : 'To-do'}
        action={
          <button className="btn btn-quiet btn-sm" onClick={onOpenWork}>
            Open Work
            <IconChevron style={{ width: 14, height: 14 }} />
          </button>
        }
      />
      <Card>
        {tasks.length > 0 && (
          <div className="rows">
            {tasks.map((t) => {
              const late = !t.done && t.scheduled !== date
              return (
                <div className="row" key={t.id}>
                  <button
                    onClick={() => actions.toggleTask(t.id)}
                    role="checkbox"
                    aria-checked={t.done}
                    aria-label={t.title}
                    style={{ display: 'flex' }}
                  >
                    <Check on={t.done} />
                  </button>
                  <span className="row-main">
                    <span className="row-title" style={{ opacity: t.done ? 0.55 : 1 }}>
                      {t.title}
                    </span>
                    {late && (
                      <span className="row-sub">
                        {t.scheduled ? `From ${formatShort(t.scheduled)}` : `Due ${formatShort(t.due)}`}
                      </span>
                    )}
                  </span>
                  <button
                    className="btn btn-quiet btn-danger"
                    onClick={() => actions.removeTask(t.id)}
                    aria-label={`Delete ${t.title}`}
                  >
                    <IconTrash style={{ width: 15, height: 15 }} />
                  </button>
                </div>
              )
            })}
          </div>
        )}
        <AddRow
          placeholder="Add a to-do"
          divider={tasks.length > 0}
          onAdd={(title) => actions.addTask(newTask(title, { scheduled: date }))}
        />
      </Card>
    </>
  )
}

// ------------------------------------------------------------------- habits

function Habits({ date, day }: { date: string; day: DayEntry }) {
  const state = useStore()
  const list = state.morningRitual
  const [editing, setEditing] = useState(false)
  const done = list.filter((h) => day.checks[h.id]).length

  return (
    <>
      <SectionTitle
        title={list.length ? `Habits · ${done}/${list.length}` : 'Habits'}
        action={<EditToggle editing={editing} onToggle={() => setEditing(!editing)} />}
      />
      <Card>
        {list.length === 0 && !editing && <Empty>No habits yet. Tap Edit to add one.</Empty>}
        {list.length > 0 && (
          <div className="rows">
            {list.map((h) => {
              const on = Boolean(day.checks[h.id])
              if (editing) {
                return (
                  <div className="row" key={h.id}>
                    <GrowText
                      className="row-main"
                      value={h.label}
                      ariaLabel="Habit"
                      onChange={(label) =>
                        actions.setMorningRitual(list.map((x) => (x.id === h.id ? { ...x, label } : x)))
                      }
                    />
                    <button
                      className="btn btn-quiet btn-danger"
                      onClick={() => actions.removeMorningItem(h.id)}
                      aria-label={`Delete ${h.label}`}
                    >
                      <IconTrash style={{ width: 15, height: 15 }} />
                    </button>
                  </div>
                )
              }
              return (
                <button
                  className="row"
                  key={h.id}
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => actions.toggleCheck(date, h.id)}
                >
                  <Check on={on} />
                  <span className="row-main">
                    <span className="row-title" style={{ opacity: on ? 0.55 : 1 }}>
                      {h.label}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
        {editing && (
          <AddRow
            placeholder="Add a habit"
            divider={list.length > 0}
            onAdd={(label) => actions.addMorningItem(label)}
          />
        )}
      </Card>
    </>
  )
}

// ---------------------------------------------------------------------- gym

/**
 * One number box that keeps what you type while you type it. A controlled
 * number input rewrites "62." to "62" on every keystroke, which makes 62.5
 * impossible to enter — so the text is held locally until the field is left,
 * and the number is saved as soon as it parses.
 */
function NumCell({
  value,
  placeholder,
  label,
  decimal,
  onChange,
}: {
  value: number | null | undefined
  placeholder: number | null | undefined
  label: string
  decimal: boolean
  onChange: (v: number | null) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value === null || value === undefined ? '' : String(value))
  return (
    <input
      className="input gym-cell"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={shown}
      placeholder={placeholder === null || placeholder === undefined ? '' : String(placeholder)}
      aria-label={label}
      onFocus={() => setDraft(shown)}
      onChange={(e) => {
        setDraft(e.target.value)
        const n = parseNum(e.target.value)
        if (n !== null || e.target.value.trim() === '') onChange(n === null ? null : Math.max(0, n))
      }}
      onBlur={() => setDraft(null)}
    />
  )
}

function Gym({ date, day }: { date: string; day: DayEntry }) {
  const state = useStore()
  const list = state.workout
  const [editing, setEditing] = useState(false)
  const last = useMemo(() => lastGymSets(state, date), [state, date])
  const logged = list.filter((ex) =>
    (day.gym[ex.id] ?? []).some((s) => s.kg !== null || s.reps !== null),
  ).length

  const update = (id: string, patch: Partial<Exercise>) =>
    actions.setWorkout(list.map((ex) => (ex.id === id ? { ...ex, ...patch } : ex)))

  return (
    <>
      <SectionTitle
        title={logged ? `Gym · ${logged}/${list.length} logged` : 'Gym'}
        action={<EditToggle editing={editing} onToggle={() => setEditing(!editing)} />}
      />
      <Card>
        {list.length === 0 && !editing && <Empty>No exercises yet. Tap Edit to add one.</Empty>}

        {editing ? (
          <>
            {list.length > 0 && (
              <div className="rows">
                {list.map((ex) => (
                  <div className="row" key={ex.id} style={{ flexWrap: 'wrap' }}>
                    <GrowText
                      className="row-main"
                      value={ex.name}
                      ariaLabel="Exercise"
                      onChange={(name) => update(ex.id, { name })}
                    />
                    <Stepper
                      value={ex.sets}
                      step={1}
                      dp={0}
                      suffix="sets"
                      onChange={(v) => update(ex.id, { sets: Math.min(10, Math.max(1, Math.round(v))) })}
                    />
                    <button
                      className="btn btn-quiet btn-danger"
                      onClick={() => actions.setWorkout(list.filter((x) => x.id !== ex.id))}
                      aria-label={`Delete ${ex.name}`}
                    >
                      <IconTrash style={{ width: 15, height: 15 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <AddRow
              placeholder="Add an exercise"
              divider={list.length > 0}
              onAdd={(name) => actions.setWorkout([...list, { id: uid(), name, sets: 3 }])}
            />
          </>
        ) : (
          list.map((ex) => {
            const sets = day.gym[ex.id] ?? []
            const prev = last[ex.id]
            const cols = Array.from({ length: ex.sets }, (_, i) => i)
            return (
              <div className="gym-ex" key={ex.id}>
                <div className="gym-head">
                  <span className="row-title">{ex.name}</span>
                  {prev && <span className="t-foot muted">Last: {formatShort(prev.date)}</span>}
                </div>
                <div
                  className="gym-grid"
                  style={{ gridTemplateColumns: `38px repeat(${ex.sets}, minmax(0, 1fr))` }}
                >
                  <span />
                  {cols.map((i) => (
                    <span className="t-cap gym-col" key={`h${i}`}>
                      Set {i + 1}
                    </span>
                  ))}
                  <span className="t-foot muted gym-label">kg</span>
                  {cols.map((i) => (
                    <NumCell
                      key={`kg${i}`}
                      decimal
                      label={`${ex.name} set ${i + 1} kg`}
                      value={sets[i]?.kg}
                      placeholder={prev?.sets[i]?.kg}
                      onChange={(kg) => actions.setGymSet(date, ex.id, i, { kg })}
                    />
                  ))}
                  <span className="t-foot muted gym-label">reps</span>
                  {cols.map((i) => (
                    <NumCell
                      key={`r${i}`}
                      decimal={false}
                      label={`${ex.name} set ${i + 1} reps`}
                      value={sets[i]?.reps}
                      placeholder={prev?.sets[i]?.reps}
                      onChange={(reps) => actions.setGymSet(date, ex.id, i, { reps })}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </Card>
      {!editing && list.length > 0 && (
        <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
          Faint numbers are last session's — the ones to beat.
        </p>
      )}
    </>
  )
}

// ------------------------------------------------------------ food & water

function FoodAndWater({ date, day, targets }: { date: string; day: DayEntry; targets: Targets }) {
  const [what, setWhat] = useState('')
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const canAdd = what.trim() !== '' || parseNum(kcal) !== null || parseNum(protein) !== null

  const add = () => {
    if (!canAdd) return
    actions.setFood(date, [
      ...day.food,
      {
        id: uid(),
        what: what.trim(),
        kcal: Math.max(0, parseNum(kcal) ?? 0),
        protein: Math.max(0, parseNum(protein) ?? 0),
      },
    ])
    setWhat('')
    setKcal('')
    setProtein('')
  }

  return (
    <>
      <SectionTitle title="Food & water" />
      <Card>
        <div className="rows">
          <div className="row">
            <span className="row-main">
              <span className="row-title">Water</span>
              <span className="row-sub">Target {num(targets.waterL, 2)} L</span>
            </span>
            <Stepper
              value={day.metrics.waterL}
              step={0.25}
              dp={2}
              suffix="L"
              onChange={(v) => actions.setMetric(date, 'waterL', v)}
            />
          </div>

          {day.food.map((f) => (
            <div className="row" key={f.id}>
              <span className="row-main">
                <span className="row-title">{f.what || 'Food'}</span>
                <span className="row-sub">
                  {num(f.kcal)} kcal · {num(f.protein)} g protein
                </span>
              </span>
              <button
                className="btn btn-quiet btn-danger"
                onClick={() => actions.setFood(date, day.food.filter((x) => x.id !== f.id))}
                aria-label={`Delete ${f.what || 'food'}`}
              >
                <IconTrash style={{ width: 15, height: 15 }} />
              </button>
            </div>
          ))}

          <div className="food-add">
            <input
              className="input food-what"
              placeholder="What you ate"
              value={what}
              onChange={(e) => setWhat(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <input
              className="input"
              inputMode="numeric"
              placeholder="kcal"
              aria-label="Calories"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <input
              className="input"
              inputMode="numeric"
              placeholder="Protein g"
              aria-label="Protein in grams"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button className="btn" onClick={add} disabled={!canAdd} aria-label="Add food">
              <IconPlus style={{ width: 16, height: 16 }} />
            </button>
          </div>

          <div className="row">
            <span className="row-main">
              <span className="row-title">Today</span>
              <span className="row-sub">
                Targets {num(targets.calories)} kcal · {num(targets.protein)} g protein
              </span>
            </span>
            <span className="row-value">
              {num(day.metrics.calories)} kcal · {num(day.metrics.protein)} g
            </span>
          </div>
        </div>
      </Card>
    </>
  )
}

// --------------------------------------------------------------- end of day

function EndOfDay({ date, day, targets }: { date: string; day: DayEntry; targets: Targets }) {
  const state = useStore()
  const tomorrow = addDays(date, 1)
  const planned = state.tasks.filter((t) => t.scheduled === tomorrow)
  const clothes = Boolean(day.checks[CLOTHES])

  return (
    <>
      <SectionTitle title="End of day" />
      <Card>
        <div className="rows">
          <div className="row">
            <Check on={planned.length > 0} locked />
            <span className="row-main">
              <span className="row-title">Plan tomorrow's to-do</span>
              <span className="row-sub">
                {planned.length
                  ? `${planned.length} set for ${formatShort(tomorrow)}`
                  : 'Ticks itself once one is added'}
              </span>
            </span>
          </div>
          {planned.map((t) => (
            <div className="row" key={t.id}>
              <span className="row-main" style={{ paddingLeft: 37 }}>
                <span className="row-title">{t.title}</span>
              </span>
              <button
                className="btn btn-quiet btn-danger"
                onClick={() => actions.removeTask(t.id)}
                aria-label={`Delete ${t.title}`}
              >
                <IconTrash style={{ width: 15, height: 15 }} />
              </button>
            </div>
          ))}
          <AddRow
            placeholder="Add a to-do for tomorrow"
            onAdd={(title) => actions.addTask(newTask(title, { scheduled: tomorrow }))}
          />
          <button
            className="row"
            role="checkbox"
            aria-checked={clothes}
            onClick={() => actions.toggleCheck(date, CLOTHES)}
          >
            <Check on={clothes} />
            <span className="row-main">
              <span className="row-title" style={{ opacity: clothes ? 0.55 : 1 }}>
                Lay out clothes
              </span>
            </span>
          </button>
          <div className="row">
            <span className="row-main">
              <span className="row-title">Hours in office</span>
              <span className="row-sub">Target {num(targets.consultingHours, 1)} h</span>
            </span>
            <Stepper
              value={day.metrics.consultingHours}
              step={0.5}
              dp={1}
              suffix="h"
              onChange={(v) => actions.setMetric(date, 'consultingHours', v)}
            />
          </div>
        </div>
      </Card>
    </>
  )
}

// -------------------------------------------------------------- money spent

const PURSES: Purse[] = ['personal', 'consulting', 'onemedia']

/**
 * Spending logged here is an expense in the Money ledger — same entry, same
 * list. Pick the account it came out of and who it was for; if those differ
 * (a 1Media lunch on the personal card), Money counts it as owed back.
 */
function MoneySpent({ date }: { date: string }) {
  const state = useStore()
  const spent = state.ledger.filter((e) => e.date === date && e.kind === 'expense')
  const total = spent.reduce((s, e) => s + e.amount, 0)

  const [what, setWhat] = useState('')
  const [amount, setAmount] = useState('')
  const [account, setAccount] = useState<AccountId>('personalAib')
  const [purse, setPurse] = useState<Purse>('personal')
  const value = parseNum(amount)
  const owner = ACCOUNT_OWNER[account]
  const owedBack = owner !== undefined && owner !== purse

  const add = () => {
    if (value === null || value <= 0) return
    actions.addLedger({
      id: uid(),
      date,
      entity: purse,
      kind: 'expense',
      amount: Math.round(value * 100) / 100,
      note: what.trim(),
      account,
    })
    setWhat('')
    setAmount('')
  }

  return (
    <>
      <SectionTitle
        title="Money spent"
        action={spent.length ? <span className="t-foot muted">{euro(total, 2)}</span> : undefined}
      />
      <Card>
        {spent.length > 0 && (
          <div className="rows">
            {spent.map((e) => (
              <div className="row" key={e.id}>
                <span className="row-main">
                  <span className="row-title">{e.note || 'Spent'}</span>
                  <span className="row-sub">
                    {PURSE_LABEL[e.entity]}
                    {e.account ? ` · ${ACCOUNT_LABEL[e.account]}` : ''}
                  </span>
                </span>
                <span className="row-value">{euro(e.amount, 2)}</span>
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => actions.removeLedger(e.id)}
                  aria-label={`Delete ${e.note || 'expense'}`}
                >
                  <IconTrash style={{ width: 15, height: 15 }} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div
          className="money-add"
          style={{ borderTop: spent.length ? '1px solid var(--hairline)' : 'none' }}
        >
          <input
            className="input money-what"
            placeholder="What it was"
            value={what}
            onChange={(e) => setWhat(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <input
            className="input"
            inputMode="decimal"
            placeholder="€ amount"
            aria-label="Amount in euro"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <select
            className="input"
            value={account}
            aria-label="Paid from"
            onChange={(e) => {
              const next = e.target.value as AccountId
              setAccount(next)
              setPurse(ACCOUNT_OWNER[next] ?? purse)
            }}
          >
            {BANK_ACCOUNTS.map((a) => (
              <option key={a} value={a}>
                {ACCOUNT_LABEL[a]}
              </option>
            ))}
          </select>
          <div className="money-for">
            <span className="t-foot muted">For</span>
            <div className="chips">
              {PURSES.map((p) => (
                <button
                  key={p}
                  className="chip chip-sm"
                  aria-pressed={purse === p}
                  onClick={() => setPurse(p)}
                >
                  {PURSE_LABEL[p]}
                </button>
              ))}
            </div>
          </div>
          {owedBack && (
            <p className="t-foot muted money-note">
              Paid from a {PURSE_LABEL[owner!]} account for {PURSE_LABEL[purse]} — Money counts
              it as owed back.
            </p>
          )}
          <button
            className="btn btn-primary money-log"
            onClick={add}
            disabled={value === null || value <= 0}
          >
            Log it
          </button>
        </div>
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Goes straight into the ledger in Money.
      </p>
    </>
  )
}
