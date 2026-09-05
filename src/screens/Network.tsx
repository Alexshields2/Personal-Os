import { useState } from 'react'
import {
  Card,
  Check,
  Empty,
  Field,
  SectionTitle,
  Segmented,
  Sheet,
  Stat,
  TextField,
} from '../components/ui'
import { IconChevron, IconWarn } from '../components/icons'
import { CADENCE_OPTIONS, CONNECTION_LABEL, cadenceLabel } from '../lib/config'
import { formatShort, todayISO } from '../lib/date'
import { uid } from '../lib/format'
import { actions, useStore } from '../lib/store'
import { contactStatus, contactsDue } from '../lib/selectors'
import type { Connection, ConnectionStatus } from '../lib/types'

type Filter = 'all' | ConnectionStatus | 'due'

const STATUSES: ConnectionStatus[] = ['inner', 'connected', 'reachedOut', 'target']

/**
 * The network. A list of names is a memory aid; a list of names with a cadence
 * is a system — the difference is that the second one tells you when you've let
 * something go quiet, which is the only failure mode that actually matters here.
 */
export default function Network() {
  const state = useStore()
  const due = contactsDue(state)
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const shown =
    filter === 'all'
      ? state.connections
      : filter === 'due'
        ? due
        : state.connections.filter((c) => c.status === filter)

  const ordered =
    filter === 'due'
      ? shown
      : [...shown].sort(
          (a, b) =>
            STATUSES.indexOf(a.status) - STATUSES.indexOf(b.status) ||
            a.name.localeCompare(b.name),
        )

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            Who you know
          </span>
        </div>
        <h1 className="t-large">Network</h1>
        <p className="t-sub">
          The people who matter, and when you last actually spoke to them. Set a cadence and
          the ones going quiet come to you.
        </p>
      </header>

      <div className="grid-3">
        <Stat label="People" value={String(state.connections.length)} />
        <Stat
          label="Inner circle"
          value={String(state.connections.filter((c) => c.status === 'inner').length)}
        />
        <Stat
          label="Due a call"
          value={String(due.length)}
          accent={due.length > 0 ? 'var(--warning)' : undefined}
        />
      </div>

      <div style={{ margin: '18px 0 12px' }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'due', label: `Due · ${due.length}` },
            { value: 'inner', label: 'Inner' },
            { value: 'connected', label: 'Connected' },
            { value: 'target', label: 'Targets' },
          ]}
        />
      </div>

      <SectionTitle
        title={`${ordered.length} ${ordered.length === 1 ? 'person' : 'people'}`}
        action={
          <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>
            Add
          </button>
        }
      />
      <Card>
        {ordered.length === 0 ? (
          <Empty>
            {filter === 'due' ? 'Nobody is overdue. Rare and worth noticing.' : 'Nobody here yet.'}
          </Empty>
        ) : (
          <div className="rows">
            {ordered.map((c) => (
              <ConnectionRow key={c.id} connection={c} onOpen={() => setOpen(c.id)} />
            ))}
          </div>
        )}
      </Card>

      {adding && <AddSheet onClose={() => setAdding(false)} />}
      {open && <PersonSheet id={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function ConnectionRow({
  connection,
  onOpen,
}: {
  connection: Connection
  onOpen: () => void
}) {
  const s = contactStatus(connection)

  const when = !s.tracked
    ? connection.lastContact
      ? `Last spoke ${formatShort(connection.lastContact)}`
      : 'No contact logged'
    : s.daysSince === null
      ? `${cadenceLabel(connection.cadenceDays)} · never logged`
      : s.due
        ? `Due — ${s.daysSince} days since you spoke`
        : `${cadenceLabel(connection.cadenceDays)} · due in ${s.dueIn} days`

  return (
    <div className="row">
      <button onClick={onOpen} aria-label={`Open ${connection.name}`} style={{ display: 'flex' }}>
        <Check on={connection.status === 'connected' || connection.status === 'inner'} />
      </button>
      <button className="row-main" style={{ textAlign: 'left' }} onClick={onOpen}>
        <span className="row-title">{connection.name}</span>
        <span className="row-sub">
          {connection.role ? `${connection.role} · ` : ''}
          {CONNECTION_LABEL[connection.status]} · {when}
        </span>
      </button>
      {s.due ? (
        <button
          className="btn btn-sm"
          onClick={() => actions.logContact(connection.id)}
          title="Log a conversation today"
        >
          Log
        </button>
      ) : (
        <button onClick={onOpen} aria-label="Open" style={{ display: 'flex' }}>
          <IconChevron style={{ width: 16, height: 16, opacity: 0.5 }} />
        </button>
      )}
    </div>
  )
}

// ------------------------------------------------------------------- sheets

function AddSheet({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [why, setWhy] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>('target')
  const [cadence, setCadence] = useState(0)

  const save = () => {
    if (!name.trim()) return
    actions.setConnections([
      ...state.connections,
      {
        id: uid(),
        name: name.trim(),
        role: role.trim(),
        why: why.trim(),
        status,
        lastContact: '',
        cadenceDays: cadence,
        notes: '',
      },
    ])
    onClose()
  }

  return (
    <Sheet title="Add someone" onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField label="Name" value={name} onChange={setName} placeholder="Who" />
        <TextField
          label="Role"
          value={role}
          onChange={setRole}
          placeholder="What they do, or where they sit"
        />
        <TextField
          label="Why they matter"
          value={why}
          onChange={setWhy}
          placeholder="Be specific — vague reasons never get acted on"
          multiline
        />
        <Field label="Where it stands">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'target', label: 'Target' },
              { value: 'reachedOut', label: 'Reached out' },
              { value: 'connected', label: 'Connected' },
              { value: 'inner', label: 'Inner' },
            ]}
          />
        </Field>
        <CadencePicker value={cadence} onChange={setCadence} />
        <button className="btn btn-primary btn-block" onClick={save} disabled={!name.trim()}>
          Add
        </button>
      </div>
    </Sheet>
  )
}

function CadencePicker({
  value,
  onChange,
}: {
  value: number
  onChange: (n: number) => void
}) {
  return (
    <Field label="Stay in touch">
      <div className="chips">
        {CADENCE_OPTIONS.map((d) => (
          <button
            key={d}
            className="chip"
            aria-pressed={value === d}
            onClick={() => onChange(d)}
          >
            {cadenceLabel(d)}
          </button>
        ))}
      </div>
    </Field>
  )
}

function PersonSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useStore()
  const c = state.connections.find((x) => x.id === id)
  if (!c) return null
  const s = contactStatus(c)

  return (
    <Sheet title={c.name} onClose={onClose}>
      <div style={{ display: 'grid', gap: 16 }}>
        {s.tracked && (
          <Card className="card-pad">
            <div className="insight-title" style={{ color: s.due ? 'var(--warning)' : undefined }}>
              {s.due && <IconWarn style={{ width: 15, height: 15, marginRight: 6 }} />}
              {s.daysSince === null
                ? 'No conversation logged yet'
                : s.due
                  ? `${s.daysSince} days since you spoke`
                  : `Due again in ${s.dueIn} days`}
            </div>
            <div className="insight-body" style={{ marginTop: 4 }}>
              {cadenceLabel(c.cadenceDays)}
              {c.lastContact && ` · last logged ${formatShort(c.lastContact)}`}
            </div>
            <button
              className="btn btn-primary btn-block"
              style={{ marginTop: 12 }}
              onClick={() => actions.logContact(c.id)}
            >
              Spoke today
            </button>
          </Card>
        )}

        <TextField
          label="Role"
          value={c.role}
          onChange={(role) => actions.updateConnection(c.id, { role })}
          placeholder="What they do"
        />
        <TextField
          label="Why they matter"
          value={c.why}
          onChange={(why) => actions.updateConnection(c.id, { why })}
          multiline
        />

        <Field label="Where it stands">
          <Segmented
            value={c.status}
            onChange={(status: ConnectionStatus) => actions.updateConnection(c.id, { status })}
            options={[
              { value: 'target', label: 'Target' },
              { value: 'reachedOut', label: 'Reached out' },
              { value: 'connected', label: 'Connected' },
              { value: 'inner', label: 'Inner' },
            ]}
          />
        </Field>

        <CadencePicker
          value={c.cadenceDays}
          onChange={(cadenceDays) => actions.updateConnection(c.id, { cadenceDays })}
        />

        <Field label="Last spoke">
          <input
            className="input"
            type="date"
            max={todayISO()}
            value={c.lastContact}
            onChange={(e) => actions.updateConnection(c.id, { lastContact: e.target.value })}
          />
        </Field>

        <TextField
          label="Notes"
          value={c.notes}
          onChange={(notes) => actions.updateConnection(c.id, { notes })}
          placeholder="What you know about them, what they're working on"
          multiline
        />

        <button
          className="btn btn-danger btn-block"
          onClick={() => {
            actions.setConnections(state.connections.filter((x) => x.id !== c.id))
            onClose()
          }}
        >
          Remove
        </button>
      </div>
    </Sheet>
  )
}
