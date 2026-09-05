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
import { IconChevron, IconPlus, IconTrash, IconWarn } from '../components/icons'
import {
  ACCOUNT_LABEL,
  GOAL_HORIZONS,
  HORIZON_LABEL,
  KIND_LABEL,
  METRICS,
} from '../lib/config'
import { formatShort, todayISO } from '../lib/date'
import { euro, euroCompact, num, uid } from '../lib/format'
import { actions, useStore } from '../lib/store'
import { goalBoard, goalProgress, upkeepStatus } from '../lib/selectors'
import type { Goal, GoalHorizon, KeyResult, KeyResultSource } from '../lib/types'

type View = 'goals' | 'upkeep'

/**
 * The ladder. A lifetime goal that nothing this quarter serves is a wish, so
 * every goal can name the longer one it feeds — and the key results underneath
 * read themselves out of the money and the daily numbers wherever they can,
 * because a hand-typed percentage is out of date the moment it's typed.
 */
export default function Goals() {
  const state = useStore()
  const [view, setView] = useState<View>('goals')
  const board = useMemo(() => goalBoard(state), [state])
  const dueNow = state.upkeep.filter((u) => upkeepStatus(u).overdue).length

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            The long game
          </span>
        </div>
        <h1 className="t-large">Goals</h1>
        <p className="t-sub">
          What you're aiming at, from a lifetime down to this quarter — and the upkeep that
          keeps slipping while you aim.
        </p>
      </header>

      <div className="grid-3">
        <Stat label="Live goals" value={String(board.total - board.done)} sub={`${board.done} done`} />
        <Stat
          label="At risk"
          value={String(board.atRisk.length)}
          sub="behind their deadline"
          accent={board.atRisk.length ? 'var(--warning)' : undefined}
        />
        <Stat
          label="Upkeep due"
          value={String(dueNow)}
          accent={dueNow ? 'var(--warning)' : undefined}
        />
      </div>

      <div style={{ margin: '18px 0 12px' }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'goals', label: `Goals · ${board.total}` },
            { value: 'upkeep', label: dueNow ? `Upkeep · ${dueNow} due` : 'Upkeep' },
          ]}
        />
      </div>

      {view === 'goals' ? <Ladder /> : <Upkeep />}
    </div>
  )
}

// ------------------------------------------------------------------- ladder

function Ladder() {
  const state = useStore()
  const board = useMemo(() => goalBoard(state), [state])
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  return (
    <>
      {board.atRisk.length > 0 && (
        <>
          <SectionTitle
            title="At risk"
            action={
              <span className="pill" style={{ color: 'var(--warning)' }}>
                <IconWarn style={{ width: 12, height: 12 }} />
                {board.atRisk.length}
              </span>
            }
          />
          <Card>
            {board.atRisk.map((p) => (
              <div className="insight" key={p.goal.id}>
                <div className="insight-head">
                  <button className="insight-title" onClick={() => setOpen(p.goal.id)}>
                    {p.goal.title}
                  </button>
                  <span className="t-num muted">{Math.round(p.pct)}%</span>
                </div>
                <Meter pct={p.pct} />
                <div className="insight-body">
                  {p.daysLeft !== null && p.daysLeft < 0
                    ? `${-p.daysLeft} days past its date`
                    : `${p.daysLeft} days left`}
                  {' · '}
                  {HORIZON_LABEL[p.goal.horizon]}
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionTitle
        title="The ladder"
        action={
          <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>
            Add
          </button>
        }
      />

      {board.byHorizon.map(
        (band) =>
          band.goals.length > 0 && (
            <div key={band.horizon} style={{ marginBottom: 12 }}>
              <Card>
                <CardHead
                  title={band.label}
                  action={<span className="t-foot muted">{band.goals.length}</span>}
                />
                <div className="rows" style={{ borderTop: '1px solid var(--hairline)' }}>
                  {band.goals.map((p) => {
                    const parent = state.goals.find((g) => g.id === p.goal.parentId)
                    const domain = state.domains.find((d) => d.id === p.goal.domainId)
                    return (
                      <button className="row" key={p.goal.id} onClick={() => setOpen(p.goal.id)}>
                        <Check on={p.goal.done} />
                        <span className="row-main">
                          <span
                            className="row-title"
                            style={{ opacity: p.goal.done ? 0.6 : 1 }}
                          >
                            {p.goal.title}
                          </span>
                          <span className="row-sub">
                            {domain ? `${domain.label}` : 'unmapped'}
                            {parent && ` · serves “${parent.title}”`}
                            {p.goal.keyResults.length > 0 &&
                              ` · ${p.goal.keyResults.length} key result${p.goal.keyResults.length === 1 ? '' : 's'}`}
                            {p.goal.due && ` · ${formatShort(p.goal.due)}`}
                          </span>
                        </span>
                        <span style={{ width: 58 }}>
                          <Meter pct={p.pct} />
                        </span>
                        <IconChevron style={{ width: 16, height: 16, opacity: 0.5 }} />
                      </button>
                    )
                  })}
                </div>
              </Card>
            </div>
          ),
      )}

      {board.total === 0 && (
        <Card>
          <Empty>No goals yet. Start at the top and work down.</Empty>
        </Card>
      )}

      <p className="t-foot muted" style={{ padding: '4px 4px 0' }}>
        A goal at the top of the ladder that nothing below it serves is a wish. Link each one
        to the longer goal it feeds.
      </p>

      {adding && <GoalSheet onClose={() => setAdding(false)} />}
      {open && <GoalDetail id={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function GoalSheet({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const [title, setTitle] = useState('')
  const [horizon, setHorizon] = useState<GoalHorizon>('year')
  const [parentId, setParentId] = useState('')
  const [domainId, setDomainId] = useState('')
  const [due, setDue] = useState('')

  const save = () => {
    if (!title.trim()) return
    actions.setGoals([
      ...state.goals,
      {
        id: uid(),
        parentId,
        horizon,
        domainId,
        title: title.trim(),
        note: '',
        due,
        done: false,
        keyResults: [],
      },
    ])
    onClose()
  }

  return (
    <Sheet title="New goal" onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField
          label="Goal"
          value={title}
          onChange={setTitle}
          placeholder="Stated so you'd know if you hit it"
        />
        <Field label="Horizon">
          <select
            className="input"
            value={horizon}
            onChange={(e) => setHorizon(e.target.value as GoalHorizon)}
          >
            {GOAL_HORIZONS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Serves which longer goal">
          <select className="input" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">Nothing — it's a top-level goal</option>
            {state.goals.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Branch of the map">
          <select className="input" value={domainId} onChange={(e) => setDomainId(e.target.value)}>
            <option value="">Unmapped</option>
            {state.domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Target date">
          <input
            className="input"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
        <button className="btn btn-primary btn-block" onClick={save} disabled={!title.trim()}>
          Add
        </button>
      </div>
    </Sheet>
  )
}

function GoalDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useStore()
  const goal = state.goals.find((g) => g.id === id)
  const [addingKr, setAddingKr] = useState(false)
  if (!goal) return null

  const p = goalProgress(state, goal)
  const parent = state.goals.find((g) => g.id === goal.parentId)

  const patch = (next: Partial<Goal>) =>
    actions.setGoals(state.goals.map((g) => (g.id === id ? { ...g, ...next } : g)))

  return (
    <Sheet title={goal.title} onClose={onClose}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Card className="card-pad">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span className="hero" style={{ fontSize: 34 }}>
              {Math.round(p.pct)}%
            </span>
            <span className="t-foot muted">
              {HORIZON_LABEL[goal.horizon]}
              {p.daysLeft !== null &&
                (p.daysLeft < 0 ? ` · ${-p.daysLeft} days over` : ` · ${p.daysLeft} days left`)}
            </span>
          </div>
          <div style={{ marginTop: 10 }}>
            <Meter pct={p.pct} />
          </div>
          {parent && (
            <p className="t-foot muted" style={{ marginTop: 10 }}>
              Serves “{parent.title}”
            </p>
          )}
        </Card>

        <div>
          <SectionTitle
            title="Key results"
            action={
              <button className="btn btn-quiet btn-sm" onClick={() => setAddingKr(true)}>
                Add
              </button>
            }
          />
          <Card>
            {p.results.length === 0 ? (
              <Empty>
                No key results. Without one, the only progress this goal can report is done or
                not done.
              </Empty>
            ) : (
              p.results.map((r) => (
                <div className="insight" key={r.kr.id}>
                  <div className="insight-head">
                    <span className="insight-title">{r.kr.label}</span>
                    <span className="t-num muted" style={{ whiteSpace: 'nowrap' }}>
                      {Math.round(r.pct)}%
                    </span>
                  </div>
                  <Meter pct={r.pct} />
                  <div className="insight-body">
                    {r.kr.unit === '€'
                      ? `${euro(r.current)} of ${euroCompact(r.target)}`
                      : `${num(r.current, 0)} of ${num(r.target, 0)}${r.kr.unit ? ` ${r.kr.unit}` : ''}`}
                    {r.kr.source === 'manual' ? ' · typed in' : ' · read from your data'}
                    {!r.live && ' · source missing'}
                  </div>
                  {r.kr.source === 'manual' && (
                    <div style={{ marginTop: 6 }}>
                      <NumberField
                        label="Where it stands"
                        value={r.kr.current}
                        onChange={(current) =>
                          patch({
                            keyResults: goal.keyResults.map((k) =>
                              k.id === r.kr.id ? { ...k, current } : k,
                            ),
                          })
                        }
                      />
                    </div>
                  )}
                  <div>
                    <button
                      className="btn btn-quiet btn-danger btn-sm"
                      style={{ padding: '2px 0' }}
                      onClick={() =>
                        patch({ keyResults: goal.keyResults.filter((k) => k.id !== r.kr.id) })
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        <TextField
          label="Note"
          value={goal.note}
          onChange={(note) => patch({ note })}
          multiline
        />

        <Field label="Horizon">
          <select
            className="input"
            value={goal.horizon}
            onChange={(e) => patch({ horizon: e.target.value as GoalHorizon })}
          >
            {GOAL_HORIZONS.map((h) => (
              <option key={h.id} value={h.id}>
                {h.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Serves which longer goal">
          <select
            className="input"
            value={goal.parentId}
            onChange={(e) => patch({ parentId: e.target.value })}
          >
            <option value="">Nothing — it's top level</option>
            {state.goals
              .filter((g) => g.id !== id)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
          </select>
        </Field>

        <Field label="Branch of the map">
          <select
            className="input"
            value={goal.domainId}
            onChange={(e) => patch({ domainId: e.target.value })}
          >
            <option value="">Unmapped</option>
            {state.domains.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Target date">
          <input
            className="input"
            type="date"
            value={goal.due}
            onChange={(e) => patch({ due: e.target.value })}
          />
        </Field>

        <button
          className={`btn btn-block ${goal.done ? '' : 'btn-primary'}`}
          onClick={() => patch({ done: !goal.done })}
        >
          {goal.done ? 'Done — reopen' : 'Mark it done'}
        </button>

        <button
          className="btn btn-danger btn-block"
          onClick={() => {
            if (confirm(`Delete "${goal.title}"?`)) {
              // Anything that served it is promoted rather than orphaned.
              actions.setGoals(
                state.goals
                  .filter((g) => g.id !== id)
                  .map((g) => (g.parentId === id ? { ...g, parentId: goal.parentId } : g)),
              )
              onClose()
            }
          }}
        >
          Delete goal
        </button>
      </div>

      {addingKr && (
        <KeyResultSheet
          onClose={() => setAddingKr(false)}
          onAdd={(kr) => patch({ keyResults: [...goal.keyResults, kr] })}
        />
      )}
    </Sheet>
  )
}

function KeyResultSheet({
  onClose,
  onAdd,
}: {
  onClose: () => void
  onAdd: (kr: KeyResult) => void
}) {
  const [label, setLabel] = useState('')
  const [source, setSource] = useState<KeyResultSource>('manual')
  const [ref, setRef] = useState('')
  const [target, setTarget] = useState(0)
  const [unit, setUnit] = useState('')

  const save = () => {
    if (!label.trim() || target <= 0) return
    onAdd({
      id: uid(),
      label: label.trim(),
      source,
      ref,
      target,
      current: 0,
      unit: source === 'account' || source === 'ledger' ? '€' : unit.trim(),
    })
    onClose()
  }

  return (
    <Sheet title="Add a key result" onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField
          label="What is measured"
          value={label}
          onChange={setLabel}
          placeholder="The number that says you're getting there"
        />
        <Field label="Where the number comes from">
          <select
            className="input"
            value={source}
            onChange={(e) => {
              setSource(e.target.value as KeyResultSource)
              setRef('')
            }}
          >
            <option value="account">A bank balance</option>
            <option value="ledger">A money total</option>
            <option value="metric">A daily metric, totalled</option>
            <option value="manual">A number I keep updated</option>
          </select>
        </Field>

        {source === 'account' && (
          <Field label="Which account">
            <select className="input" value={ref} onChange={(e) => setRef(e.target.value)}>
              <option value="">Choose…</option>
              {Object.entries(ACCOUNT_LABEL).map(([id, l]) => (
                <option key={id} value={id}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        )}

        {source === 'ledger' && (
          <Field label="Which total">
            <select className="input" value={ref} onChange={(e) => setRef(e.target.value)}>
              <option value="">Choose…</option>
              {Object.entries(KIND_LABEL).map(([id, l]) => (
                <option key={id} value={id}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        )}

        {source === 'metric' && (
          <Field label="Which metric">
            <select className="input" value={ref} onChange={(e) => setRef(e.target.value)}>
              <option value="">Choose…</option>
              {METRICS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
          </Field>
        )}

        <NumberField label="Target" value={target} onChange={setTarget} />

        {source === 'manual' && (
          <TextField label="Unit" value={unit} onChange={setUnit} placeholder="kg, clients, hours" />
        )}

        <button
          className="btn btn-primary btn-block"
          onClick={save}
          disabled={!label.trim() || target <= 0 || (source !== 'manual' && !ref)}
        >
          Add
        </button>
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------- upkeep

function Upkeep() {
  const state = useStore()
  const [adding, setAdding] = useState(false)

  return (
    <>
      <SectionTitle
        title="Upkeep"
        action={
          <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>
            Add
          </button>
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
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField
          label="What"
          value={label}
          onChange={setLabel}
          placeholder="Haircut, dentist, barber"
        />
        <Field label="Every (days)">
          <input
            className="input t-num"
            inputMode="numeric"
            value={interval}
            onChange={(e) => setInterval(e.target.value.replace(/\D/g, ''))}
          />
        </Field>
        <button className="btn btn-primary btn-block" onClick={save} disabled={!label.trim()}>
          <IconPlus style={{ width: 15, height: 15 }} />
          Add
        </button>
      </div>
    </Sheet>
  )
}
