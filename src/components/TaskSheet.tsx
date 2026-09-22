import { Field, Segmented, Sheet, Stepper } from './ui'
import { IconTrash } from './icons'
import { actions } from '../lib/store'
import type { Task } from '../lib/types'

/**
 * A task, opened up: what doing it actually involves, how long you think it
 * takes, and whether it is started.
 *
 * The same sheet on Today and in Work, because they are the same task — a
 * to-do written on the day is a Work task with a date on it, and editing it
 * in one place has to be editing it in the other.
 */
export default function TaskSheet({ task, onClose }: { task: Task; onClose: () => void }) {
  const status = task.done ? 'done' : task.doing ? 'doing' : 'todo'

  return (
    <Sheet title="Task" onClose={onClose}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Field label="What">
          <input
            className="input"
            value={task.title}
            aria-label="Title"
            onChange={(e) => actions.updateTask(task.id, { title: e.target.value })}
          />
        </Field>

        <Field label="Instructions">
          <textarea
            className="input"
            style={{ minHeight: 120 }}
            value={task.notes}
            aria-label="Instructions"
            placeholder="What doing this actually involves. Steps, links, who to call."
            onChange={(e) => actions.updateTask(task.id, { notes: e.target.value })}
          />
        </Field>

        <Field label="Where it's at">
          <Segmented
            value={status}
            onChange={(next: 'todo' | 'doing' | 'done') => actions.setTaskStatus(task.id, next)}
            options={[
              { value: 'todo', label: 'To do' },
              { value: 'doing', label: 'In progress' },
              { value: 'done', label: 'Done' },
            ]}
          />
        </Field>

        <div className="row" style={{ paddingLeft: 0, paddingRight: 0 }}>
          <span className="row-main">
            <span className="row-title">Estimate</span>
            <span className="row-sub">In minutes. Zero means you haven't guessed yet.</span>
          </span>
          <Stepper
            value={task.estimateMin}
            step={15}
            dp={0}
            suffix="m"
            onChange={(v) => actions.updateTask(task.id, { estimateMin: Math.max(0, Math.round(v)) })}
          />
        </div>

        <Field label="On">
          <input
            className="input"
            type="date"
            value={task.scheduled}
            aria-label="Day"
            onChange={(e) => actions.updateTask(task.id, { scheduled: e.target.value })}
          />
        </Field>

        <button
          className="btn btn-block btn-danger"
          onClick={() => {
            actions.removeTask(task.id)
            onClose()
          }}
        >
          <IconTrash style={{ width: 15, height: 15 }} />
          Delete this task
        </button>
      </div>
    </Sheet>
  )
}
