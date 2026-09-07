import { useMemo, useState } from 'react'
import {
  Card,
  CardHead,
  Check,
  Empty,
  Field,
  Meter,
  NumberField,
  SectionTitle,
  Segmented,
  Sheet,
  Stat,
  TextField,
} from '../components/ui'
import WeekBoard from '../components/WeekBoard'
import { DueOverview } from './Finance'
import { IconChevron, IconPlus, IconTrash, IconWarn } from '../components/icons'
import {
  CLIENT_STATUS_LABEL,
  DEAL_STAGES,
  DEAL_STAGE_LABEL,
  ENTITY_LABEL,
  OPEN_STAGES,
  PRIORITY_TAGS,
  PROJECT_STATUS_LABEL,
  STALE_DEAL_DAYS,
} from '../lib/config'
import { daysBetween, formatShort, todayISO } from '../lib/date'
import { euro, euroCompact, uid } from '../lib/format'
import { actions, newTask, useStore } from '../lib/store'
import { clientBook, pipeline, projectProgress, taskQueue } from '../lib/selectors'
import type {
  ClientStatus,
  DealStage,
  MoneyEntity,
  Priority,
  ProjectStatus,
  Task,
} from '../lib/types'

type View = 'week' | 'tasks' | 'projects' | 'clients' | 'pipeline' | 'due'

export default function Work() {
  const state = useStore()
  const [view, setView] = useState<View>('week')
  const queue = useMemo(() => taskQueue(state), [state])
  const pipe = useMemo(() => pipeline(state), [state])

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            Both businesses
          </span>
        </div>
        <h1 className="t-large">Work</h1>
        <p className="t-sub">
          What's open, what's being built, who's paying, and what's coming. Revenue is a
          lagging number — the pipeline is the one that tells you about it early.
        </p>
      </header>

      <div className="grid-3">
        <Stat
          label="Open tasks"
          value={String(queue.openCount)}
          sub={queue.overdue.length ? `${queue.overdue.length} overdue` : 'none overdue'}
          accent={queue.overdue.length ? 'var(--warning)' : undefined}
        />
        <Stat
          label="Pipeline"
          value={euroCompact(pipe.weighted)}
          sub={`${euroCompact(pipe.value)} unweighted`}
        />
        <Stat
          label="Stale deals"
          value={String(pipe.stale.length)}
          sub={`no move in ${STALE_DEAL_DAYS}d`}
          accent={pipe.stale.length ? 'var(--warning)' : undefined}
        />
      </div>

      <div style={{ margin: '18px 0 12px' }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'tasks', label: `Tasks · ${queue.openCount}` },
            { value: 'projects', label: 'Projects' },
            { value: 'clients', label: 'Clients' },
            { value: 'pipeline', label: `Pipeline · ${pipe.open.length}` },
            { value: 'due', label: 'Due' },
          ]}
        />
      </div>

      {view === 'week' && <WeekBoard />}
      {view === 'tasks' && <Tasks />}
      {view === 'projects' && <Projects />}
      {view === 'clients' && <Clients />}
      {view === 'pipeline' && <PipelineView />}
      {view === 'due' && <DueOverview />}
    </div>
  )
}

// -------------------------------------------------------------------- tasks

function Tasks() {
  const state = useStore()
  const queue = useMemo(() => taskQueue(state), [state])
  const [title, setTitle] = useState('')
  const [tag, setTag] = useState<Priority['tag']>('consulting')
  const [showDone, setShowDone] = useState(false)

  const add = () => {
    if (!title.trim()) return
    actions.addTask(newTask(title.trim(), { entity: tag }))
    setTitle('')
  }

  const groups: { label: string; tasks: Task[]; warn?: boolean }[] = [
    { label: 'Overdue', tasks: queue.overdue, warn: true },
    { label: 'Today', tasks: queue.today },
    { label: 'Next seven days', tasks: queue.soon },
    { label: 'No date', tasks: queue.someday },
  ]

  return (
    <>
      <Card>
        <div style={{ display: 'grid', gap: 10, padding: 13 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Add a task"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button className="btn" onClick={add} disabled={!title.trim()} aria-label="Add task">
              <IconPlus style={{ width: 16, height: 16 }} />
            </button>
          </div>
          <div className="chips">
            {PRIORITY_TAGS.map((t) => (
              <button
                key={t.id}
                className="chip chip-sm"
                aria-pressed={tag === t.id}
                onClick={() => setTag(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {groups.map(
        (g) =>
          g.tasks.length > 0 && (
            <div key={g.label}>
              <SectionTitle
                title={g.label}
                action={
                  <span className="t-foot muted" style={g.warn ? { color: 'var(--warning)' } : {}}>
                    {g.tasks.length}
                  </span>
                }
              />
              <Card>
                <div className="rows">
                  {g.tasks.map((t) => (
                    <TaskRow key={t.id} task={t} />
                  ))}
                </div>
              </Card>
            </div>
          ),
      )}

      {queue.openCount === 0 && (
        <Card>
          <Empty>Nothing open. Either you're clear, or nothing is written down.</Empty>
        </Card>
      )}

      {queue.done.length > 0 && (
        <>
          <SectionTitle
            title={`Done · ${queue.done.length}`}
            action={
              <button className="btn btn-quiet btn-sm" onClick={() => setShowDone((v) => !v)}>
                {showDone ? 'Hide' : 'Show'}
              </button>
            }
          />
          {showDone && (
            <Card>
              <div className="rows">
                {queue.done.slice(0, 40).map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </>
  )
}

function TaskRow({ task }: { task: Task }) {
  const state = useStore()
  const project = state.projects.find((p) => p.id === task.projectId)
  const late = task.due && !task.done ? daysBetween(todayISO(), task.due) < 0 : false

  return (
    <div className="row">
      <button
        onClick={() => actions.toggleTask(task.id)}
        aria-label="Toggle task"
        style={{ display: 'flex' }}
      >
        <Check on={task.done} />
      </button>
      <span className="row-main">
        <span className="row-title" style={{ opacity: task.done ? 0.55 : 1 }}>
          {task.title}
        </span>
        <span className="row-sub" style={late ? { color: 'var(--warning)' } : undefined}>
          {task.entity === 'consulting' ? 'Consulting.ie' : task.entity === 'onemedia' ? '1Media' : 'Life'}
          {project && ` · ${project.name}`}
          {task.due && ` · ${late ? 'was due' : 'due'} ${formatShort(task.due)}`}
        </span>
      </span>
      <input
        className="input input-time"
        type="date"
        value={task.due}
        onChange={(e) => actions.updateTask(task.id, { due: e.target.value })}
        aria-label="Due date"
      />
      <button
        className="btn btn-quiet btn-danger"
        onClick={() => actions.removeTask(task.id)}
        aria-label="Remove task"
      >
        <IconTrash style={{ width: 15, height: 15 }} />
      </button>
    </div>
  )
}

// ----------------------------------------------------------------- projects

function Projects() {
  const state = useStore()
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const ordered = [...state.projects].sort((a, b) => {
    const rank: Record<ProjectStatus, number> = { active: 0, paused: 1, done: 2 }
    return rank[a.status] - rank[b.status] || a.name.localeCompare(b.name)
  })

  return (
    <>
      <SectionTitle
        title={`${ordered.length} project${ordered.length === 1 ? '' : 's'}`}
        action={
          <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>
            Add
          </button>
        }
      />
      <Card>
        {ordered.length === 0 ? (
          <Empty>No projects yet. A project is anything with more than one task in it.</Empty>
        ) : (
          <div className="rows">
            {ordered.map((p) => {
              const prog = projectProgress(state, p.id)
              const client = state.clients.find((c) => c.id === p.clientId)
              return (
                <button className="row" key={p.id} onClick={() => setOpen(p.id)}>
                  <Check on={p.status === 'done'} />
                  <span className="row-main">
                    <span className="row-title" style={{ opacity: p.status === 'done' ? 0.6 : 1 }}>
                      {p.name}
                    </span>
                    <span className="row-sub">
                      {p.entity === 'consulting' ? 'Consulting.ie' : p.entity === 'onemedia' ? '1Media' : 'Life'}
                      {client && ` · ${client.name}`} · {PROJECT_STATUS_LABEL[p.status]}
                      {prog && prog.total > 0 && ` · ${prog.done}/${prog.total} tasks`}
                      {p.due && ` · due ${formatShort(p.due)}`}
                    </span>
                  </span>
                  {prog && prog.total > 0 && (
                    <span style={{ width: 58 }}>
                      <Meter pct={prog.pct} />
                    </span>
                  )}
                  <IconChevron style={{ width: 16, height: 16, opacity: 0.5 }} />
                </button>
              )
            })}
          </div>
        )}
      </Card>
      {adding && <ProjectSheet onClose={() => setAdding(false)} />}
      {open && <ProjectDetail id={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function ProjectSheet({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const [name, setName] = useState('')
  const [entity, setEntity] = useState<Priority['tag']>('consulting')
  const [clientId, setClientId] = useState('')
  const [due, setDue] = useState('')

  const save = () => {
    if (!name.trim()) return
    actions.setProjects([
      ...state.projects,
      { id: uid(), entity, name: name.trim(), clientId, status: 'active', due, notes: '' },
    ])
    onClose()
  }

  return (
    <Sheet title="New project" onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField label="Name" value={name} onChange={setName} placeholder="What is it" />
        <Field label="Belongs to">
          <Segmented
            value={entity}
            onChange={setEntity}
            options={PRIORITY_TAGS.map((t) => ({ value: t.id, label: t.label }))}
          />
        </Field>
        <Field label="Client">
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">None</option>
            {state.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Due">
          <input
            className="input"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
        <button className="btn btn-primary btn-block" onClick={save} disabled={!name.trim()}>
          Create
        </button>
      </div>
    </Sheet>
  )
}

function ProjectDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useStore()
  const prog = projectProgress(state, id)
  const [title, setTitle] = useState('')
  if (!prog) return null
  const { project } = prog
  const tasks = state.tasks.filter((t) => t.projectId === id)

  const addTask = () => {
    if (!title.trim()) return
    actions.addTask(newTask(title.trim(), { projectId: id, entity: project.entity }))
    setTitle('')
  }

  return (
    <Sheet title={project.name} onClose={onClose}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Card className="card-pad">
          <CardHead title={`${prog.done} of ${prog.total} done`} />
          <div style={{ marginTop: 8 }}>
            <Meter pct={prog.pct} />
          </div>
        </Card>

        <Field label="Status">
          <Segmented
            value={project.status}
            onChange={(status: ProjectStatus) => actions.updateProject(id, { status })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'done', label: 'Done' },
            ]}
          />
        </Field>

        <Field label="Due">
          <input
            className="input"
            type="date"
            value={project.due}
            onChange={(e) => actions.updateProject(id, { due: e.target.value })}
          />
        </Field>

        <TextField
          label="Notes"
          value={project.notes}
          onChange={(notes) => actions.updateProject(id, { notes })}
          multiline
        />

        <div>
          <SectionTitle title="Tasks" />
          <Card>
            {tasks.length > 0 && (
              <div className="rows">
                {tasks.map((t) => (
                  <TaskRow key={t.id} task={t} />
                ))}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: 13,
                borderTop: tasks.length ? '1px solid var(--hairline)' : 'none',
              }}
            >
              <input
                className="input"
                placeholder="Add a task to this project"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
              />
              <button className="btn" onClick={addTask} disabled={!title.trim()} aria-label="Add">
                <IconPlus style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </Card>
        </div>

        <button
          className="btn btn-danger btn-block"
          onClick={() => {
            if (confirm(`Delete "${project.name}"? Its tasks become loose tasks.`)) {
              actions.setTasks(
                state.tasks.map((t) => (t.projectId === id ? { ...t, projectId: '' } : t)),
              )
              actions.setProjects(state.projects.filter((p) => p.id !== id))
              onClose()
            }
          }}
        >
          Delete project
        </button>
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------ clients

function Clients() {
  const state = useStore()
  const book = useMemo(() => clientBook(state), [state])
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const ordered = [...state.clients].sort((a, b) => {
    const rank: Record<ClientStatus, number> = { active: 0, prospect: 1, paused: 2, churned: 3 }
    return rank[a.status] - rank[b.status] || b.monthlyValue - a.monthlyValue
  })

  return (
    <>
      <div className="grid-3">
        <Stat label="MRR" value={euroCompact(book.mrr)} sub={`${book.active.length} active`} />
        <Stat
          label="Top client"
          value={`${Math.round(book.concentration)}%`}
          sub="share of MRR"
          accent={book.concentration > 40 ? 'var(--warning)' : undefined}
        />
        <Stat
          label="Renewals"
          value={String(book.renewalsDue.length)}
          sub="inside 30 days"
          accent={book.renewalsDue.length ? 'var(--warning)' : undefined}
        />
      </div>

      {book.concentration > 40 && book.active.length > 1 && (
        <Card className="card-pad" style={{ marginTop: 12 }}>
          <div className="insight-title" style={{ color: 'var(--warning)' }}>
            <IconWarn style={{ width: 15, height: 15, marginRight: 6 }} />
            One client is {Math.round(book.concentration)}% of your recurring revenue.
          </div>
          <div className="insight-body" style={{ marginTop: 4 }}>
            Concentration is the risk that doesn't feel like one until the call comes.
          </div>
        </Card>
      )}

      <SectionTitle
        title={`${ordered.length} client${ordered.length === 1 ? '' : 's'}`}
        action={
          <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>
            Add
          </button>
        }
      />
      <Card>
        {ordered.length === 0 ? (
          <Empty>No clients yet.</Empty>
        ) : (
          <div className="rows">
            {ordered.map((c) => {
              const renewIn = c.renewal ? daysBetween(todayISO(), c.renewal) : null
              return (
                <button className="row" key={c.id} onClick={() => setOpen(c.id)}>
                  <Check on={c.status === 'active'} />
                  <span className="row-main">
                    <span className="row-title">{c.name}</span>
                    <span className="row-sub">
                      {ENTITY_LABEL[c.entity]} · {CLIENT_STATUS_LABEL[c.status]}
                      {c.monthlyValue > 0 && ` · ${euro(c.monthlyValue)}/mo`}
                      {renewIn !== null &&
                        renewIn <= 30 &&
                        ` · renews in ${renewIn} day${renewIn === 1 ? '' : 's'}`}
                    </span>
                  </span>
                  <IconChevron style={{ width: 16, height: 16, opacity: 0.5 }} />
                </button>
              )
            })}
          </div>
        )}
      </Card>

      {adding && <ClientSheet onClose={() => setAdding(false)} />}
      {open && <ClientDetail id={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function ClientSheet({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const [name, setName] = useState('')
  const [entity, setEntity] = useState<MoneyEntity>('consulting')
  const [monthlyValue, setMonthly] = useState(0)
  const [status, setStatus] = useState<ClientStatus>('active')

  const save = () => {
    if (!name.trim()) return
    actions.setClients([
      ...state.clients,
      {
        id: uid(),
        entity,
        name: name.trim(),
        status,
        monthlyValue,
        since: todayISO(),
        renewal: '',
        notes: '',
      },
    ])
    onClose()
  }

  return (
    <Sheet title="Add a client" onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField label="Name" value={name} onChange={setName} placeholder="Who" />
        <Field label="Business">
          <Segmented
            value={entity}
            onChange={setEntity}
            options={[
              { value: 'consulting', label: 'Consulting.ie' },
              { value: 'onemedia', label: '1Media' },
            ]}
          />
        </Field>
        <Field label="Status">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'prospect', label: 'Prospect' },
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
            ]}
          />
        </Field>
        <NumberField
          label="Monthly value (€)"
          value={monthlyValue}
          onChange={setMonthly}
          placeholder="0 for project work"
        />
        <button className="btn btn-primary btn-block" onClick={save} disabled={!name.trim()}>
          Add
        </button>
      </div>
    </Sheet>
  )
}

function ClientDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useStore()
  const c = state.clients.find((x) => x.id === id)
  if (!c) return null

  return (
    <Sheet title={c.name} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Status">
          <Segmented
            value={c.status}
            onChange={(status: ClientStatus) => actions.updateClient(id, { status })}
            options={[
              { value: 'prospect', label: 'Prospect' },
              { value: 'active', label: 'Active' },
              { value: 'paused', label: 'Paused' },
              { value: 'churned', label: 'Churned' },
            ]}
          />
        </Field>
        <NumberField
          label="Monthly value (€)"
          value={c.monthlyValue}
          onChange={(monthlyValue) => actions.updateClient(id, { monthlyValue })}
        />
        <Field label="Renewal date">
          <input
            className="input"
            type="date"
            value={c.renewal}
            onChange={(e) => actions.updateClient(id, { renewal: e.target.value })}
          />
        </Field>
        <TextField
          label="Notes"
          value={c.notes}
          onChange={(notes) => actions.updateClient(id, { notes })}
          multiline
        />
        <button
          className="btn btn-danger btn-block"
          onClick={() => {
            actions.setClients(state.clients.filter((x) => x.id !== id))
            onClose()
          }}
        >
          Remove client
        </button>
      </div>
    </Sheet>
  )
}

// ----------------------------------------------------------------- pipeline

function PipelineView() {
  const state = useStore()
  const [entity, setEntity] = useState<MoneyEntity | 'all'>('all')
  const pipe = useMemo(
    () => pipeline(state, entity === 'all' ? undefined : entity),
    [state, entity],
  )
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Segmented
          value={entity}
          onChange={setEntity}
          options={[
            { value: 'all', label: 'Both' },
            { value: 'consulting', label: 'Consulting.ie' },
            { value: 'onemedia', label: '1Media' },
          ]}
        />
      </div>

      <div className="grid-3">
        <Stat label="Weighted" value={euroCompact(pipe.weighted)} sub="what to forecast on" />
        <Stat label="Win rate" value={`${Math.round(pipe.winRate)}%`} sub="of closed deals" />
        <Stat label="Average won" value={euroCompact(pipe.averageDeal)} />
      </div>

      {pipe.stale.length > 0 && (
        <>
          <SectionTitle
            title="Stopped moving"
            action={
              <span className="pill" style={{ color: 'var(--warning)' }}>
                <IconWarn style={{ width: 12, height: 12 }} />
                {pipe.stale.length}
              </span>
            }
          />
          <Card>
            {pipe.stale.map((d) => (
              <div className="insight" key={d.id}>
                <div className="insight-head">
                  <button className="insight-title" onClick={() => setOpen(d.id)}>
                    {d.name}
                  </button>
                  <span className="t-num muted">{euroCompact(d.value)}</span>
                </div>
                <div className="insight-body">
                  {DEAL_STAGE_LABEL[d.stage]} ·{' '}
                  {d.moved
                    ? `no movement in ${daysBetween(d.moved, todayISO())} days`
                    : 'never moved'}
                  {d.nextStep ? ` · next: ${d.nextStep}` : ' · no next step set'}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionTitle
        title="The pipeline"
        action={
          <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>
            Add deal
          </button>
        }
      />
      {pipe.stages
        .filter((s) => OPEN_STAGES.includes(s.id) || s.deals.length > 0)
        .map((stage) => (
          <Card key={stage.id} style={{ marginBottom: 10 }}>
            <CardHead
              title={`${stage.label} · ${stage.deals.length}`}
              action={<span className="t-num muted">{euroCompact(stage.value)}</span>}
            />
            {stage.deals.length === 0 ? (
              <Empty>Nothing here.</Empty>
            ) : (
              <div className="rows" style={{ borderTop: '1px solid var(--hairline)' }}>
                {stage.deals.map((d) => (
                  <button className="row" key={d.id} onClick={() => setOpen(d.id)}>
                    <span className="row-main">
                      <span className="row-title">{d.name}</span>
                      <span className="row-sub">
                        {ENTITY_LABEL[d.entity]} · {d.probability}%
                        {d.expectedClose && ` · closes ${formatShort(d.expectedClose)}`}
                        {d.nextStep && ` · ${d.nextStep}`}
                      </span>
                    </span>
                    <span className="row-value">{euroCompact(d.value)}</span>
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}

      {adding && <DealSheet onClose={() => setAdding(false)} />}
      {open && <DealDetail id={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function DealSheet({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const [name, setName] = useState('')
  const [entity, setEntity] = useState<MoneyEntity>('consulting')
  const [value, setValue] = useState(0)
  const [stage, setStage] = useState<DealStage>('lead')
  const [expectedClose, setClose] = useState('')

  const save = () => {
    if (!name.trim()) return
    actions.setDeals([
      ...state.deals,
      {
        id: uid(),
        entity,
        name: name.trim(),
        clientId: '',
        stage,
        value,
        probability: DEAL_STAGES.find((s) => s.id === stage)?.probability ?? 10,
        expectedClose,
        nextStep: '',
        moved: todayISO(),
        notes: '',
      },
    ])
    onClose()
  }

  return (
    <Sheet title="New deal" onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField label="Name" value={name} onChange={setName} placeholder="Who and what" />
        <Field label="Business">
          <Segmented
            value={entity}
            onChange={setEntity}
            options={[
              { value: 'consulting', label: 'Consulting.ie' },
              { value: 'onemedia', label: '1Media' },
            ]}
          />
        </Field>
        <NumberField label="Value (€)" value={value} onChange={setValue} />
        <Field label="Stage">
          <Segmented
            value={stage}
            onChange={setStage}
            options={OPEN_STAGES.map((id) => ({
              value: id,
              label: DEAL_STAGE_LABEL[id],
            }))}
          />
        </Field>
        <Field label="Expected close">
          <input
            className="input"
            type="date"
            value={expectedClose}
            onChange={(e) => setClose(e.target.value)}
          />
        </Field>
        <button className="btn btn-primary btn-block" onClick={save} disabled={!name.trim()}>
          Add
        </button>
      </div>
    </Sheet>
  )
}

function DealDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useStore()
  const d = state.deals.find((x) => x.id === id)
  if (!d) return null

  return (
    <Sheet title={d.name} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Stage">
          <Segmented
            value={d.stage}
            onChange={(stage: DealStage) => actions.moveDeal(id, stage)}
            options={DEAL_STAGES.map((s) => ({ value: s.id, label: s.label }))}
          />
        </Field>
        <NumberField
          label="Value (€)"
          value={d.value}
          onChange={(value) => actions.updateDeal(id, { value })}
        />
        <NumberField
          label="Probability (%)"
          value={d.probability}
          onChange={(probability) =>
            actions.updateDeal(id, { probability: Math.max(0, Math.min(100, probability)) })
          }
        />
        <TextField
          label="Next step"
          value={d.nextStep}
          onChange={(nextStep) => actions.updateDeal(id, { nextStep })}
          placeholder="The single next action"
        />
        <Field label="Expected close">
          <input
            className="input"
            type="date"
            value={d.expectedClose}
            onChange={(e) => actions.updateDeal(id, { expectedClose: e.target.value })}
          />
        </Field>
        <TextField
          label="Notes"
          value={d.notes}
          onChange={(notes) => actions.updateDeal(id, { notes })}
          multiline
        />
        <p className="t-foot muted">
          Weighted at {euro((d.value * d.probability) / 100)}
          {d.moved && ` · last moved ${formatShort(d.moved)}`}
        </p>
        <button
          className="btn btn-danger btn-block"
          onClick={() => {
            actions.setDeals(state.deals.filter((x) => x.id !== id))
            onClose()
          }}
        >
          Remove deal
        </button>
      </div>
    </Sheet>
  )
}
