import { useState } from 'react'
import { Card, Check, Empty, Field, SectionTitle, Sheet, TextField } from '../components/ui'
import { IconTrash, IconWarn } from '../components/icons'
import { formatShort, todayISO } from '../lib/date'
import { uid } from '../lib/format'
import { actions, useStore } from '../lib/store'
import { upkeepStatus } from '../lib/selectors'
import type { Goal } from '../lib/types'

export default function Life() {
  const state = useStore()
  const dueNow = state.upkeep.filter((u) => upkeepStatus(u).overdue).length

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            The long game
          </span>
        </div>
        <h1 className="t-large">Life</h1>
        <p className="t-sub">
          What you're aiming at, and the upkeep that keeps slipping. Reading lives in
          Learn; people live in Network.
        </p>
      </header>

      <Upkeep dueNow={dueNow} />
      <Goals />
    </div>
  )
}

// ------------------------------------------------------------------- upkeep

function Upkeep({ dueNow }: { dueNow: number }) {
  const state = useStore()
  const [adding, setAdding] = useState(false)

  return (
    <>
      <SectionTitle
        title="Upkeep"
        action={
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {dueNow > 0 && (
              <span className="pill" style={{ color: 'var(--warning)' }}>
                <IconWarn style={{ width: 12, height: 12 }} />
                {dueNow} due
              </span>
            )}
            <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>
              Add
            </button>
          </span>
        }
      />
      <Card>
        <div className="rows">
          {state.upkeep.map((u) => {
            const s = upkeepStatus(u)
            return (
              <div className="row" key={u.id}>
                <button
                  onClick={() =>
                    actions.setUpkeep(
                      state.upkeep.map((x) =>
                        x.id === u.id ? { ...x, lastDone: todayISO() } : x,
                      ),
                    )
                  }
                  aria-label={`Mark ${u.label} done today`}
                  style={{ display: 'flex' }}
                >
                  <Check on={!s.overdue} />
                </button>
                <span className="row-main">
                  <span className="row-title">{u.label}</span>
                  <span className="row-sub">
                    Every {u.intervalDays} days ·{' '}
                    {s.dueIn === null
                      ? 'never logged'
                      : s.dueIn > 0
                        ? `due in ${s.dueIn} day${s.dueIn === 1 ? '' : 's'}`
                        : s.dueIn === 0
                          ? 'due today'
                          : `overdue by ${-s.dueIn} day${s.dueIn === -1 ? '' : 's'}`}
                  </span>
                </span>
                <span
                  className="row-value"
                  style={{ color: s.overdue ? 'var(--warning)' : undefined }}
                >
                  {u.lastDone ? formatShort(u.lastDone) : '—'}
                </span>
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => actions.setUpkeep(state.upkeep.filter((x) => x.id !== u.id))}
                  aria-label={`Remove ${u.label}`}
                >
                  <IconTrash style={{ width: 16, height: 16 }} />
                </button>
              </div>
            )
          })}
          {state.upkeep.length === 0 && <Empty>Nothing on the schedule.</Empty>}
        </div>
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Tick one and the clock restarts from today.
      </p>
      {adding && <UpkeepSheet onClose={() => setAdding(false)} />}
    </>
  )
}

function UpkeepSheet({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const [label, setLabel] = useState('')
  const [interval, setInterval] = useState('14')

  const save = () => {
    const n = Number.parseInt(interval, 10)
    if (label.trim() && Number.isFinite(n) && n > 0) {
      actions.setUpkeep([
        ...state.upkeep,
        { id: uid(), label: label.trim(), intervalDays: n, lastDone: '' },
      ])
    }
    onClose()
  }

  return (
    <Sheet title="Add upkeep" onClose={onClose}>
      <TextField label="What" value={label} onChange={setLabel} placeholder="Haircut, dentist, barber" />
      <Field label="Every (days)">
        <input
          className="input t-num"
          inputMode="numeric"
          value={interval}
          onChange={(e) => setInterval(e.target.value.replace(/\D/g, ''))}
        />
      </Field>
      <button className="btn btn-primary btn-block" onClick={save} disabled={!label.trim()}>
        Add
      </button>
    </Sheet>
  )
}

// -------------------------------------------------------------------- goals

function Goals() {
  const state = useStore()
  const [adding, setAdding] = useState(false)
  const done = state.goals.filter((g) => g.done).length

  const toggle = (g: Goal) =>
    actions.setGoals(state.goals.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)))

  return (
    <>
      <SectionTitle
        title={`Goals · ${done}/${state.goals.length}`}
        action={
          <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>
            Add
          </button>
        }
      />
      <Card>
        {state.goals.length === 0 ? (
          <Empty>No goals yet.</Empty>
        ) : (
          <div className="rows">
            {state.goals.map((g) => (
              <div className="row" key={g.id}>
                <button onClick={() => toggle(g)} aria-label="Toggle goal" style={{ display: 'flex' }}>
                  <Check on={g.done} />
                </button>
                <span className="row-main">
                  <span className="row-title" style={{ opacity: g.done ? 0.55 : 1 }}>
                    {g.title}
                  </span>
                  {(g.note || g.due) && (
                    <span className="row-sub">
                      {g.due && `By ${formatShort(g.due)}`}
                      {g.due && g.note && ' · '}
                      {g.note}
                    </span>
                  )}
                </span>
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => actions.setGoals(state.goals.filter((x) => x.id !== g.id))}
                  aria-label="Remove goal"
                >
                  <IconTrash style={{ width: 16, height: 16 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
      {adding && <GoalSheet onClose={() => setAdding(false)} />}
    </>
  )
}

function GoalSheet({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [due, setDue] = useState('')

  const save = () => {
    if (title.trim()) {
      actions.setGoals([
        ...state.goals,
        { id: uid(), title: title.trim(), note: note.trim(), due, done: false },
      ])
    }
    onClose()
  }

  return (
    <Sheet title="Add goal" onClose={onClose}>
      <TextField label="Goal" value={title} onChange={setTitle} placeholder="What you're aiming at" />
      <TextField label="Why it matters" value={note} onChange={setNote} multiline />
      <Field label="Target date (optional)">
        <input
          className="input"
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
      </Field>
      <button className="btn btn-primary btn-block" onClick={save} disabled={!title.trim()}>
        Add goal
      </button>
    </Sheet>
  )
}

// -------------------------------------------------------------------- books
