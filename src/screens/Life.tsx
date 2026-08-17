import { useState } from 'react'
import {
  Card,
  Check,
  Empty,
  Field,
  SectionTitle,
  Segmented,
  Sheet,
  TextField,
} from '../components/ui'
import { IconChevron, IconPlus, IconTrash, IconWarn } from '../components/icons'
import { CONNECTION_LABEL } from '../lib/config'
import { formatShort, todayISO } from '../lib/date'
import { uid } from '../lib/format'
import { actions, useStore } from '../lib/store'
import { upkeepStatus } from '../lib/selectors'
import type { Book, ConnectionStatus, Goal } from '../lib/types'

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
          What you're aiming at, what you're reading, who you want to know, and the upkeep
          that keeps slipping.
        </p>
      </header>

      <Upkeep dueNow={dueNow} />
      <Goals />
      <Books />
      <Connections />
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

function Books() {
  const state = useStore()
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<Book['status'] | 'all'>('all')

  const cycle = (b: Book): Book['status'] =>
    b.status === 'queued' ? 'reading' : b.status === 'reading' ? 'done' : 'queued'

  const add = () => {
    if (!title.trim()) return
    actions.setBooks([
      ...state.books,
      { id: uid(), title: title.trim(), status: 'queued', notes: '' },
    ])
    setTitle('')
  }

  const shown = state.books.filter((b) => filter === 'all' || b.status === filter)

  return (
    <>
      <SectionTitle title={`Books · ${state.books.filter((b) => b.status === 'done').length} read`} />
      <div style={{ marginBottom: 12 }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'reading', label: 'Reading' },
            { value: 'queued', label: 'Queued' },
            { value: 'done', label: 'Read' },
          ]}
        />
      </div>
      <Card>
        {shown.length === 0 ? (
          <Empty>Nothing here.</Empty>
        ) : (
          <div className="rows">
            {shown.map((b) => (
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
                  <span className="row-title" style={{ opacity: b.status === 'done' ? 0.55 : 1 }}>
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
        <div
          style={{ display: 'flex', gap: 8, padding: 13, borderTop: '1px solid var(--hairline)' }}
        >
          <input
            className="input"
            placeholder="Add a book"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn" onClick={add} disabled={!title.trim()} aria-label="Add book">
            <IconPlus style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Tap the circle to move a book queued → reading → read.
      </p>
    </>
  )
}

// -------------------------------------------------------------- connections

const NEXT_STATUS: Record<ConnectionStatus, ConnectionStatus> = {
  target: 'reachedOut',
  reachedOut: 'connected',
  connected: 'target',
}

function Connections() {
  const state = useStore()
  const [adding, setAdding] = useState(false)

  return (
    <>
      <SectionTitle
        title="People to connect with"
        action={
          <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>
            Add
          </button>
        }
      />
      <Card>
        {state.connections.length === 0 ? (
          <Empty>Nobody on the list yet.</Empty>
        ) : (
          <div className="rows">
            {state.connections.map((c) => (
              <div className="row" key={c.id}>
                <span className="row-main">
                  <span className="row-title">{c.name}</span>
                  {c.why && <span className="row-sub">{c.why}</span>}
                </span>
                <button
                  className={`pill ${c.status === 'connected' ? 'pill-accent' : ''}`}
                  onClick={() =>
                    actions.setConnections(
                      state.connections.map((x) =>
                        x.id === c.id ? { ...x, status: NEXT_STATUS[x.status] } : x,
                      ),
                    )
                  }
                >
                  {CONNECTION_LABEL[c.status]}
                  <IconChevron style={{ width: 11, height: 11 }} />
                </button>
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() =>
                    actions.setConnections(state.connections.filter((x) => x.id !== c.id))
                  }
                  aria-label={`Remove ${c.name}`}
                >
                  <IconTrash style={{ width: 16, height: 16 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Tap the status to move someone target → reached out → connected.
      </p>
      {adding && <ConnectionSheet onClose={() => setAdding(false)} />}
    </>
  )
}

function ConnectionSheet({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const [name, setName] = useState('')
  const [why, setWhy] = useState('')

  const save = () => {
    if (name.trim()) {
      actions.setConnections([
        ...state.connections,
        { id: uid(), name: name.trim(), why: why.trim(), status: 'target' },
      ])
    }
    onClose()
  }

  return (
    <Sheet title="Add person" onClose={onClose}>
      <TextField label="Name" value={name} onChange={setName} placeholder="Who" />
      <TextField
        label="Why"
        value={why}
        onChange={setWhy}
        placeholder="What the relationship is worth, and the way in"
        multiline
      />
      <button className="btn btn-primary btn-block" onClick={save} disabled={!name.trim()}>
        Add
      </button>
    </Sheet>
  )
}
