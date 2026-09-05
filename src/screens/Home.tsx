import { useMemo, useState } from 'react'
import { Card, CardHead, Check, Empty, Meter, Ring, SectionTitle } from '../components/ui'
import { IconFlame, IconPlus, IconWarn } from '../components/icons'
import { PRIORITY_TAGS, PROTOCOL_DAYS, STALE_DEAL_DAYS } from '../lib/config'
import { formatLong, todayISO } from '../lib/date'
import { euroCompact } from '../lib/format'
import { actions, emptyDay, newTask, useStore } from '../lib/store'
import {
  accountBalance,
  clientBook,
  contactsDue,
  currentStreak,
  goalBoard,
  oscillation,
  pipeline,
  planStatus,
  scoreDay,
  taskQueue,
  timeline,
  upkeepStatus,
} from '../lib/selectors'
import type { Priority } from '../lib/types'

/**
 * One screen that answers "what needs me right now". Everything on it is a
 * pointer into somewhere else — it holds no state of its own except the
 * capture box, because a dashboard that owns data becomes another place to
 * keep in sync.
 */
export default function Home() {
  const state = useStore()
  const today = todayISO()
  const day = state.days[today] ?? emptyDay(today)
  const plan = planStatus(day)
  const score = scoreDay(day, state.targets)
  const t = timeline(state)
  const streak = currentStreak(state, today)

  const queue = useMemo(() => taskQueue(state), [state])
  const pipe = useMemo(() => pipeline(state), [state])
  const book = useMemo(() => clientBook(state), [state])
  const board = useMemo(() => goalBoard(state), [state])
  const osc = useMemo(() => oscillation(state), [state])
  const due = contactsDue(state)
  const upkeepDue = state.upkeep.filter((u) => upkeepStatus(u).overdue)

  const attention = [
    queue.overdue.length && `${queue.overdue.length} overdue task${queue.overdue.length === 1 ? '' : 's'}`,
    pipe.stale.length && `${pipe.stale.length} deal${pipe.stale.length === 1 ? '' : 's'} stopped moving`,
    board.atRisk.length && `${board.atRisk.length} goal${board.atRisk.length === 1 ? '' : 's'} at risk`,
    book.renewalsDue.length && `${book.renewalsDue.length} renewal${book.renewalsDue.length === 1 ? '' : 's'} inside 30 days`,
    due.length && `${due.length} ${due.length === 1 ? 'person' : 'people'} due a call`,
    upkeepDue.length && `${upkeepDue.length} upkeep item${upkeepDue.length === 1 ? '' : 's'} overdue`,
  ].filter(Boolean) as string[]

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            Day {t.day} of {PROTOCOL_DAYS}
          </span>
          {streak > 0 && (
            <span className="pill pill-accent">
              <IconFlame style={{ width: 12, height: 12 }} />
              {streak} day{streak === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <h1 className="t-large">Today</h1>
        <p className="t-sub">{formatLong(today)}</p>
      </header>

      {/* The one thing, or the fact that there isn't one. */}
      <Card className="card-pad">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <Ring pct={score.score} size={86} stroke={8}>
            <div className="hero" style={{ fontSize: 26 }}>
              {score.score}
            </div>
          </Ring>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-cap" style={{ marginBottom: 4 }}>
              The one thing
            </div>
            {plan.oneThing ? (
              <button
                onClick={() =>
                  actions.updatePriority(today, plan.oneThing!.id, {
                    done: !plan.oneThing!.done,
                  })
                }
                style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left' }}
              >
                <Check on={plan.oneThingDone} />
                <span
                  className="t-head"
                  style={{ opacity: plan.oneThingDone ? 0.55 : 1, lineHeight: 1.3 }}
                >
                  {plan.oneThing.text}
                </span>
              </button>
            ) : (
              <div className="t-body muted">
                Nothing committed to yet. The day gets handed to whoever shouts loudest.
              </div>
            )}
            {plan.set > 0 && (
              <div className="t-foot muted" style={{ marginTop: 8 }}>
                {plan.done} of {plan.set} priorities kept today
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Which version is running. */}
      {osc.enough && osc.current && (
        <Card className="card-pad" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span className="t-head">
              {osc.current.kind === 'build' ? 'Building' : 'Breaking'} — day {osc.current.days}
            </span>
            <span className="t-num muted">mean {Math.round(osc.mean)}</span>
          </div>
          <p className="t-foot muted" style={{ marginTop: 4 }}>
            {osc.current.kind === 'build'
              ? 'The version that does the work is the one currently running.'
              : 'The version that undoes the work is the one currently running.'}
          </p>
        </Card>
      )}

      {attention.length > 0 && (
        <>
          <SectionTitle
            title="Needs you"
            action={
              <span className="pill" style={{ color: 'var(--warning)' }}>
                <IconWarn style={{ width: 12, height: 12 }} />
                {attention.length}
              </span>
            }
          />
          <Card>
            <div className="rows">
              {attention.map((line) => (
                <div className="row" key={line}>
                  <span className="row-main">
                    <span className="row-title">{line}</span>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <Capture />

      <SectionTitle title="Open work" />
      <Card>
        {queue.openCount === 0 ? (
          <Empty>Nothing open.</Empty>
        ) : (
          <div className="rows">
            {[...queue.overdue, ...queue.today, ...queue.soon].slice(0, 6).map((task) => (
              <div className="row" key={task.id}>
                <button
                  onClick={() => actions.toggleTask(task.id)}
                  aria-label="Toggle task"
                  style={{ display: 'flex' }}
                >
                  <Check on={task.done} />
                </button>
                <span className="row-main">
                  <span className="row-title">{task.title}</span>
                  <span className="row-sub">
                    {task.entity === 'consulting'
                      ? 'Consulting.ie'
                      : task.entity === 'onemedia'
                        ? '1Media'
                        : 'Life'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <SectionTitle title="Where things stand" />
      <div className="grid-2">
        <Card className="card-pad">
          <CardHead title="Money" />
          <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
            <Line label="Consulting.ie bank" value={euroCompact(accountBalance(state, 'consultingBank'))} />
            <Line label="Net worth" value={euroCompact(accountBalance(state, 'netWorth'))} />
            <Line label="MRR" value={euroCompact(book.mrr)} />
          </div>
        </Card>
        <Card className="card-pad">
          <CardHead title="Pipeline" />
          <div style={{ display: 'grid', gap: 7, marginTop: 8 }}>
            <Line label="Weighted" value={euroCompact(pipe.weighted)} />
            <Line label="Open deals" value={String(pipe.open.length)} />
            <Line label={`Stale (${STALE_DEAL_DAYS}d)`} value={String(pipe.stale.length)} />
          </div>
        </Card>
      </div>

      {board.atRisk.length > 0 && (
        <>
          <SectionTitle title="Goals at risk" />
          <Card>
            {board.atRisk.slice(0, 4).map((p) => (
              <div className="insight" key={p.goal.id}>
                <div className="insight-head">
                  <span className="insight-title">{p.goal.title}</span>
                  <span className="t-num muted">{Math.round(p.pct)}%</span>
                </div>
                <Meter pct={p.pct} />
              </div>
            ))}
          </Card>
        </>
      )}

      <p className="t-foot muted" style={{ textAlign: 'center', marginTop: 20 }}>
        Everything here lives somewhere else. This is only the list of what's asking for you.
      </p>
    </div>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14 }}>
      <span className="dim">{label}</span>
      <span className="t-num">{value}</span>
    </div>
  )
}

/** One box for anything that turns up. It lands as a task; triage it later. */
function Capture() {
  const [text, setText] = useState('')
  const [tag, setTag] = useState<Priority['tag']>('consulting')

  const add = () => {
    if (!text.trim()) return
    actions.addTask(newTask(text.trim(), { entity: tag }))
    setText('')
  }

  return (
    <>
      <SectionTitle title="Capture" />
      <Card>
        <div style={{ display: 'grid', gap: 10, padding: 13 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              className="input"
              placeholder="Anything, before it's lost"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && add()}
            />
            <button className="btn" onClick={add} disabled={!text.trim()} aria-label="Capture">
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
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Lands in Work as an undated task. Getting it out of your head is the point; sorting it
        can wait.
      </p>
    </>
  )
}
