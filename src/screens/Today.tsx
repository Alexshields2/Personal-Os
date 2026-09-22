import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Card,
  Check,
  Empty,
  GrowText,
  Meter,
  SectionTitle,
  Segmented,
  Stepper,
} from '../components/ui'
import TimeLog from '../components/TimeLog'
import { IconChevron, IconPlay, IconPlus, IconStop, IconTrash } from '../components/icons'
import {
  ACCOUNT_LABEL,
  CLOTHES_CHECK,
  PURSE_LABEL,
  READ_CHECK,
  VISION_IMAGE_MAX_PX,
  VISION_IMAGE_QUALITY,
} from '../lib/config'
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
import { dayProgress, lastGymSets, missedGymCount, todoFor } from '../lib/selectors'
import { downscaleImage } from '../lib/image'
import { loadVoices, pickVoice, scoreVoice, speak } from '../lib/speech'
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
          {!future && <DayBar date={date} />}
          <IdentityCard date={date} day={day} readable={!future} />
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

// ----------------------------------------------------------------- the day

/**
 * One bar over everything the day asks for. It names what is left rather
 * than only counting it, so the answer to "what now" is on the same line.
 */
function DayBar({ date }: { date: string }) {
  const state = useStore()
  const progress = dayProgress(state, date)
  const left = progress.parts.filter((p) => !p.done)

  return (
    <div className="day-bar">
      <div className="day-bar-head">
        <span className="t-cap">The day</span>
        <span className="t-foot muted">
          {progress.done} of {progress.total} · {Math.round(progress.pct)}%
        </span>
      </div>
      <Meter pct={progress.pct} />
      <p className="t-foot muted" style={{ marginTop: 8 }}>
        {left.length === 0
          ? 'Everything done.'
          : `Left: ${left.slice(0, 3).map((p) => p.label).join(', ')}${
              left.length > 3 ? ` and ${left.length - 3} more` : ''
            }`}
      </p>
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

// ----------------------------------------------------------------- identity

/**
 * Who this is all for, at the top of every day: your own words, a picture,
 * and a tick for having actually read it. The play button reads it aloud
 * with the browser's own voice — no account, no network, nothing leaves the
 * device.
 */
function IdentityCard({ date, day, readable }: { date: string; day: DayEntry; readable: boolean }) {
  const state = useStore()
  const { title, text, image } = state.identity
  const [editing, setEditing] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [note, setNote] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const read = Boolean(day.checks[READ_CHECK])
  const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window

  // The list arrives asynchronously on most browsers — the first read is
  // usually empty, with a "voiceschanged" event along shortly after.
  useEffect(() => loadVoices(setVoices), [])

  // A voice that keeps reading after you have moved on is a bug you can hear.
  useEffect(() => {
    return () => {
      if (canSpeak) window.speechSynthesis.cancel()
    }
  }, [canSpeak])

  const play = () => {
    if (speak(`${title}. ${text}`, voices, state.identity.voice, () => setSpeaking(false))) {
      setSpeaking(true)
    }
  }

  const stop = () => {
    if (canSpeak) window.speechSynthesis.cancel()
    setSpeaking(false)
  }

  // English voices, best first, so the top of the list is the one it would
  // have picked anyway.
  const choices = voices
    .map((v) => ({ voice: v, score: scoreVoice(v) }))
    .filter((v) => v.score >= 0)
    .sort((a, b) => b.score - a.score || a.voice.name.localeCompare(b.voice.name))
  const chosen = pickVoice(voices, state.identity.voice)

  const attach = async (file: File | undefined) => {
    if (!file) return
    try {
      // Downscaled before it is stored: the whole app is one document that
      // syncs as a blob, and a full-size photo would dwarf everything else.
      const data = await downscaleImage(file, VISION_IMAGE_MAX_PX, VISION_IMAGE_QUALITY)
      actions.setIdentity({ image: data })
      setNote('')
    } catch {
      setNote("That file couldn't be read as an image.")
    }
  }

  return (
    <>
      <SectionTitle
        title={title || 'The top of the day'}
        action={<EditToggle editing={editing} onToggle={() => setEditing(!editing)} />}
      />
      <Card className="identity">
        {image !== '' && <img className="identity-img" src={image} alt="" />}
        <div className="card-pad">
          {editing ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <input
                className="input"
                value={title}
                aria-label="Title"
                placeholder="Alex 4.0"
                onChange={(e) => actions.setIdentity({ title: e.target.value })}
              />
              <textarea
                className="input"
                style={{ minHeight: 160 }}
                value={text}
                aria-label="What it says"
                placeholder="Who you are becoming, in your own words. Read it every morning."
                onChange={(e) => actions.setIdentity({ text: e.target.value })}
              />
              {canSpeak && choices.length > 0 && (
                <label className="identity-voice">
                  <span className="t-cap">Voice</span>
                  <select
                    className="input"
                    value={state.identity.voice}
                    aria-label="Voice"
                    onChange={(e) => {
                      const name = e.target.value
                      actions.setIdentity({ voice: name })
                      // Say a line in it, because a voice name tells you nothing.
                      speak('This is how it sounds.', voices, name, () => setSpeaking(false))
                    }}
                  >
                    <option value="">
                      Automatic{chosen ? ` — ${chosen.name}` : ''}
                    </option>
                    {choices.map(({ voice }) => (
                      <option key={voice.name} value={voice.name}>
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn btn-sm" onClick={() => fileRef.current?.click()}>
                  {image ? 'Change photo' : 'Add photo'}
                </button>
                {image !== '' && (
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => actions.setIdentity({ image: '' })}
                  >
                    Remove photo
                  </button>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                aria-label="Photo"
                onChange={(e) => {
                  void attach(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
              {note !== '' && (
                <p className="t-foot" style={{ color: 'var(--warning)' }} role="status">
                  {note}
                </p>
              )}
            </div>
          ) : text.trim() === '' ? (
            <Empty>Nothing written yet. Tap Edit and put it in your own words.</Empty>
          ) : (
            <p className="identity-text">{text}</p>
          )}
        </div>
        {canSpeak && !editing && text.trim() !== '' && (
          <div className="identity-play">
            <button className="btn btn-block" onClick={speaking ? stop : play}>
              {speaking ? (
                <IconStop style={{ width: 15, height: 15 }} />
              ) : (
                <IconPlay style={{ width: 15, height: 15 }} />
              )}
              {speaking ? 'Stop' : 'Listen'}
            </button>
          </div>
        )}
        {readable && !editing && (
          <button
            className="row"
            style={{ borderTop: '1px solid var(--hairline)' }}
            role="checkbox"
            aria-checked={read}
            onClick={() => actions.toggleCheck(date, READ_CHECK)}
          >
            <Check on={read} />
            <span className="row-main">
              <span className="row-title" style={{ opacity: read ? 0.55 : 1 }}>
                Read it today
              </span>
            </span>
          </button>
        )}
      </Card>
    </>
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
  const missedCount = list.filter((h) => day.habitMissed[h.id]).length

  return (
    <>
      <SectionTitle
        title={
          list.length
            ? `Habits · ${done}/${list.length}${missedCount ? ` · ${missedCount} missed` : ''}`
            : 'Habits'
        }
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
              const missed = Boolean(day.habitMissed[h.id])
              return (
                <div className="row" key={h.id}>
                  <button
                    className="habit-main"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={h.label}
                    onClick={() => actions.markHabit(date, h.id, on ? null : 'done')}
                  >
                    <Check on={on} />
                    <span className="row-main">
                      <span
                        className="row-title"
                        style={{
                          opacity: on || missed ? 0.55 : 1,
                          textDecoration: missed ? 'line-through' : undefined,
                        }}
                      >
                        {h.label}
                      </span>
                      {missed && <span className="row-sub">Missed — noted</span>}
                    </span>
                  </button>
                  <button
                    className="btn btn-quiet btn-sm habit-x"
                    aria-pressed={missed}
                    aria-label={`Missed ${h.label}`}
                    onClick={() => actions.markHabit(date, h.id, missed ? null : 'missed')}
                  >
                    ✕
                  </button>
                </div>
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
        title={
          day.gymMissed ? 'Gym · missed' : logged ? `Gym · ${logged}/${list.length} logged` : 'Gym'
        }
        action={
          <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {!editing && !logged && !day.gymMissed && (
              <button
                className="btn btn-quiet btn-sm"
                onClick={() => actions.setGymMissed(date, true)}
              >
                Missed gym
              </button>
            )}
            <EditToggle editing={editing} onToggle={() => setEditing(!editing)} />
          </span>
        }
      />
      <Card>
        {list.length === 0 && !editing && !day.gymMissed && (
          <Empty>No exercises yet. Tap Edit to add one.</Empty>
        )}

        {!editing && day.gymMissed ? (
          <MissedGym date={date} day={day} />
        ) : editing ? (
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
      {!editing && !day.gymMissed && list.length > 0 && (
        <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
          Faint numbers are last session's — the ones to beat.
        </p>
      )}
    </>
  )
}

/**
 * A missed session, on the record: marked on purpose, with a line for why
 * and the running count, so a miss reads as a miss rather than a blank day.
 */
function MissedGym({ date, day }: { date: string; day: DayEntry }) {
  const state = useStore()
  const count = missedGymCount(state, date)

  return (
    <div className="rows">
      <div className="row">
        <span className="row-main">
          <span className="row-title">Missed gym — noted</span>
          <span className="row-sub">
            {count <= 1 ? 'The only miss in the last 30 days' : `${count} missed in the last 30 days`}
          </span>
        </span>
        <button className="btn btn-sm" onClick={() => actions.setGymMissed(date, false)}>
          Undo
        </button>
      </div>
      <div style={{ padding: 13 }}>
        <input
          className="input"
          placeholder="Why? (optional)"
          aria-label="Why the gym was missed"
          value={day.gymMissedWhy}
          onChange={(e) => actions.updateDay(date, { gymMissedWhy: e.target.value })}
        />
      </div>
    </div>
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
  const clothes = Boolean(day.checks[CLOTHES_CHECK])

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
            onClick={() => actions.toggleCheck(date, CLOTHES_CHECK)}
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
        <div className="card-pad" style={{ borderTop: '1px solid var(--hairline)' }}>
          <div className="t-cap" style={{ marginBottom: 8 }}>
            Journal
          </div>
          <textarea
            className="input"
            style={{ minHeight: 120 }}
            value={day.endJournal}
            aria-label="End of day journal"
            placeholder="How the day actually went. Written at the end, not planned at the start."
            onChange={(e) => actions.updateDay(date, { endJournal: e.target.value })}
          />
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
