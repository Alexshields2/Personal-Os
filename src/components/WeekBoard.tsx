import { useMemo, useRef, useState } from 'react'
import { Check, Field, Meter, Segmented, Sheet, TextField } from './ui'
import { IconPlus, IconTrash } from './icons'
import { ESTIMATE_STEPS, PRIORITY_TAGS, TASK_PRIORITY_LABEL } from '../lib/config'
import { addDays, formatShort, todayISO, weekStartISO } from '../lib/date'
import { actions, newTask, useStore } from '../lib/store'
import { durationLabel, weekBoard } from '../lib/selectors'
import type { Priority, Task, TaskPriority } from '../lib/types'

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/**
 * The week, as seven columns you can drag work between.
 *
 * The point is the load line under each heading: a day holds a fixed number of
 * hours, and a plan that ignores that is a wish list with dates on it. Dragging
 * a card is the fastest way to answer "so what moves?", which is the only
 * question an over-full day actually poses.
 */
export default function WeekBoard() {
  const state = useStore()
  const [weekStart, setWeekStart] = useState(() => weekStartISO(todayISO()))
  const [editing, setEditing] = useState<string | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const board = useMemo(() => weekBoard(state, weekStart), [state, weekStart])
  const today = todayISO()

  // The column the pointer is currently over, found by hit-testing rather than
  // by per-column enter/leave handlers, which fight with pointer capture.
  const overRef = useRef<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)

  // Seven columns rarely fit at once, so a drag has to be able to reach a day
  // that is off-screen. Holding near an edge scrolls the strip; without this,
  // Sunday is simply unreachable on a phone.
  const stripRef = useRef<HTMLDivElement>(null)
  const edgeRef = useRef(0)
  const rafRef = useRef(0)

  const runEdgeScroll = () => {
    const strip = stripRef.current
    if (strip && edgeRef.current !== 0) strip.scrollLeft += edgeRef.current * 14
    rafRef.current = edgeRef.current !== 0 ? requestAnimationFrame(runEdgeScroll) : 0
  }

  const setEdge = (dir: number) => {
    edgeRef.current = dir
    if (dir !== 0 && rafRef.current === 0) rafRef.current = requestAnimationFrame(runEdgeScroll)
  }

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    setDragging(id)
    try {
      // Throws when the id isn't a live pointer. An optional call doesn't help:
      // the method exists, it just rejects the id — and the throw would abort
      // the handler and leave the drag half-started.
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* The wrapper's move and up handlers track the drag regardless. */
    }
  }

  const EDGE = 64

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return

    const strip = stripRef.current
    if (strip) {
      const r = strip.getBoundingClientRect()
      if (e.clientY >= r.top && e.clientY <= r.bottom) {
        if (e.clientX < r.left + EDGE) setEdge(-1)
        else if (e.clientX > r.right - EDGE) setEdge(1)
        else setEdge(0)
      } else {
        setEdge(0)
      }
    }

    const el = document.elementFromPoint(e.clientX, e.clientY)
    const col = el?.closest<HTMLElement>('[data-col]')?.dataset.col ?? null
    // Keep the last known column when the pointer strays over a gap, so a
    // wobble on the way to a drop doesn't cancel the target.
    if (col !== null) {
      overRef.current = col
      setOverCol(col)
    }
  }

  const onPointerUp = () => {
    setEdge(0)
    const target = overRef.current
    if (dragging && target !== null) {
      // "backlog" is a column too, so unscheduling is the same gesture.
      actions.scheduleTask(dragging, target === 'backlog' ? '' : target)
    }
    setDragging(null)
    setOverCol(null)
    overRef.current = null
  }

  return (
    <div onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
      <div className="board-bar">
        <button className="btn btn-sm" onClick={() => setWeekStart(addDays(weekStart, -7))}>
          ←
        </button>
        <span className="board-zoom" style={{ minWidth: 96 }}>
          {formatShort(weekStart)} – {formatShort(addDays(weekStart, 6))}
        </span>
        <button className="btn btn-sm" onClick={() => setWeekStart(addDays(weekStart, 7))}>
          →
        </button>
        <button className="btn btn-sm" onClick={() => setWeekStart(weekStartISO(todayISO()))}>
          This week
        </button>
        <span className="t-foot muted" style={{ marginLeft: 'auto' }}>
          {durationLabel(board.totalLoad)} planned of {durationLabel(board.totalCapacity)}
        </span>
      </div>

      <div className="week" ref={stripRef}>
        {board.days.map((d, i) => (
          <div
            key={d.date}
            className="week-col"
            data-col={d.date}
            data-today={d.date === today}
            data-over={overCol === d.date}
          >
            <div className="week-head">
              <div className="week-dow">
                {DOW[i]} <span className="muted">{formatShort(d.date)}</span>
              </div>
              <div className="week-load" data-over={d.over}>
                {durationLabel(d.load)}
                <span className="muted"> / {durationLabel(d.capacity)}</span>
              </div>
              <Meter pct={Math.min(100, d.pct)} color={d.over ? 'var(--warning)' : undefined} />
              {d.unestimated > 0 && (
                <div className="week-note">{d.unestimated} unestimated</div>
              )}
            </div>

            <div className="week-cards">
              {d.tasks.map((t) => (
                <TaskCard
                  key={t.id}
                  task={t}
                  dragging={dragging === t.id}
                  onGrab={(e) => onPointerDown(e, t.id)}
                  onOpen={() => setEditing(t.id)}
                />
              ))}
              {d.tasks.length === 0 && <div className="week-empty">Nothing planned</div>}
            </div>

            <button
              className="week-add"
              onClick={() => {
                const title = prompt(`Add to ${DOW[i]}`)?.trim()
                if (title) actions.addTask(newTask(title, { scheduled: d.date }))
              }}
            >
              <IconPlus style={{ width: 13, height: 13 }} />
              Add
            </button>
          </div>
        ))}
      </div>

      <div
        className="week-backlog"
        data-col="backlog"
        data-over={overCol === 'backlog'}
      >
        <div className="week-head">
          <div className="week-dow">
            Backlog <span className="muted">{board.backlog.length}</span>
          </div>
          <div className="week-note">Unscheduled. Drag one onto a day to commit to it.</div>
        </div>
        <div className="week-cards week-cards-row">
          {board.backlog.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              dragging={dragging === t.id}
              onGrab={(e) => onPointerDown(e, t.id)}
              onOpen={() => setEditing(t.id)}
            />
          ))}
          {board.backlog.length === 0 && (
            <div className="week-empty">Nothing waiting. Rare and worth noticing.</div>
          )}
        </div>
      </div>

      <p className="t-foot muted" style={{ padding: '12px 4px 0' }}>
        The load bar is estimates against a day's capacity, set in Settings. A day over its
        line is not a motivation problem — it is arithmetic.
      </p>

      {editing && <TaskSheet id={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function TaskCard({
  task,
  dragging,
  onGrab,
  onOpen,
}: {
  task: Task
  dragging: boolean
  onGrab: (e: React.PointerEvent) => void
  onOpen: () => void
}) {
  const moved = useRef(false)

  return (
    <div
      className="task-card"
      data-dragging={dragging}
      data-done={task.done}
      data-priority={task.priority}
      onPointerDown={(e) => {
        moved.current = false
        onGrab(e)
      }}
      onPointerMove={() => {
        moved.current = true
      }}
      onClick={() => {
        // A press that never moved is a click, not the end of a drag.
        if (!moved.current) onOpen()
      }}
    >
      <div className="task-card-top">
        <button
          onClick={(e) => {
            e.stopPropagation()
            actions.toggleTask(task.id)
          }}
          aria-label="Toggle task"
          style={{ display: 'flex' }}
        >
          <Check on={task.done} />
        </button>
        <span className="task-card-title">{task.title}</span>
      </div>
      <div className="task-card-meta">
        <span>{TASK_PRIORITY_LABEL[task.priority]}</span>
        {task.estimateMin > 0 && <span>{durationLabel(task.estimateMin)}</span>}
        <span className="muted">
          {task.entity === 'consulting'
            ? 'Consulting.ie'
            : task.entity === 'onemedia'
              ? '1Media'
              : 'Life'}
        </span>
      </div>
    </div>
  )
}

function TaskSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useStore()
  const task = state.tasks.find((t) => t.id === id)
  if (!task) return null

  return (
    <Sheet title={task.title} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField
          label="Task"
          value={task.title}
          onChange={(title) => actions.updateTask(id, { title })}
        />

        <Field label="Priority">
          <Segmented
            value={String(task.priority)}
            onChange={(v: string) =>
              actions.updateTask(id, { priority: Number(v) as TaskPriority })
            }
            options={[
              { value: '1', label: 'Must' },
              { value: '2', label: 'Should' },
              { value: '3', label: 'Could' },
            ]}
          />
        </Field>

        <Field label="How long will it take">
          <div className="chips">
            {ESTIMATE_STEPS.map((m) => (
              <button
                key={m}
                className="chip"
                aria-pressed={task.estimateMin === m}
                onClick={() =>
                  actions.updateTask(id, { estimateMin: task.estimateMin === m ? 0 : m })
                }
              >
                {durationLabel(m)}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Belongs to">
          <Segmented
            value={task.entity}
            onChange={(entity: Priority['tag']) => actions.updateTask(id, { entity })}
            options={PRIORITY_TAGS.map((t) => ({ value: t.id, label: t.label }))}
          />
        </Field>

        <Field label="Planned for">
          <input
            className="input"
            type="date"
            value={task.scheduled}
            onChange={(e) => actions.scheduleTask(id, e.target.value)}
          />
        </Field>

        <Field label="Due">
          <input
            className="input"
            type="date"
            value={task.due}
            onChange={(e) => actions.updateTask(id, { due: e.target.value })}
          />
        </Field>

        <p className="t-foot muted">
          Planned is when you sit down to do it; due is when it is owed. They are usually not
          the same day, and pretending they are is how a week slips.
        </p>

        <button
          className="btn btn-danger btn-block"
          onClick={() => {
            actions.removeTask(id)
            onClose()
          }}
        >
          <IconTrash style={{ width: 16, height: 16 }} />
          Delete task
        </button>
      </div>
    </Sheet>
  )
}
