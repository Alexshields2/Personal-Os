import { useState } from 'react'
import {
  Card,
  CardHead,
  Check,
  Empty,
  Field,
  SectionTitle,
  Segmented,
  Sheet,
  Stat,
  TextField,
} from '../components/ui'
import { IconChevron, IconPlus, IconTrash } from '../components/icons'
import { LEARN_KIND_LABEL, LEARN_STATUS_LABEL } from '../lib/config'
import { formatShort, todayISO } from '../lib/date'
import { uid } from '../lib/format'
import { actions, useStore } from '../lib/store'
import { allLessons, learnStats } from '../lib/selectors'
import type { LearnKind, LearnStatus, Lesson } from '../lib/types'

type Filter = 'all' | LearnKind | 'lessons'

/**
 * The education log. A book, a course and a conference are the same object —
 * a source you spent time on — so they share one list and one capture flow.
 * The lessons are the point; the titles are just where they came from.
 */
export default function Learn() {
  const state = useStore()
  const stats = learnStats(state)
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const shown =
    filter === 'all' || filter === 'lessons'
      ? state.learning
      : state.learning.filter((i) => i.kind === filter)

  const ordered = [...shown].sort((a, b) => {
    const rank: Record<LearnStatus, number> = { active: 0, queued: 1, done: 2 }
    return rank[a.status] - rank[b.status] || a.title.localeCompare(b.title)
  })

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            Input and output
          </span>
        </div>
        <h1 className="t-large">Learn</h1>
        <p className="t-sub">
          Books, courses and events — and what you actually took from each one. A lesson with
          no action attached is a highlight, and highlights change nothing.
        </p>
      </header>

      <div className="grid-3">
        <Stat label="In progress" value={String(stats.active)} sub={`${stats.queued} queued`} />
        <Stat label="Finished" value={String(stats.done)} />
        <Stat
          label="Lessons"
          value={String(stats.lessons)}
          sub={`${stats.applied} applied`}
          accent={stats.unapplied > 0 ? 'var(--warning)' : undefined}
        />
      </div>

      <div style={{ margin: '18px 0 12px' }}>
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All' },
            { value: 'book', label: 'Books' },
            { value: 'course', label: 'Courses' },
            { value: 'event', label: 'Events' },
            { value: 'lessons', label: 'Lessons' },
          ]}
        />
      </div>

      {filter === 'lessons' ? (
        <LessonStream />
      ) : (
        <>
          <SectionTitle
            title={`${ordered.length} source${ordered.length === 1 ? '' : 's'}`}
            action={
              <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>
                Add
              </button>
            }
          />
          <Card>
            {ordered.length === 0 ? (
              <Empty>Nothing here yet.</Empty>
            ) : (
              <div className="rows">
                {ordered.map((item) => (
                  <button className="row" key={item.id} onClick={() => setOpen(item.id)}>
                    <Check on={item.status === 'done'} />
                    <span className="row-main">
                      <span
                        className="row-title"
                        style={{ opacity: item.status === 'done' ? 0.6 : 1 }}
                      >
                        {item.title}
                      </span>
                      <span className="row-sub">
                        {LEARN_KIND_LABEL[item.kind]}
                        {item.source && ` · ${item.source}`} · {LEARN_STATUS_LABEL[item.status]}
                        {item.lessons.length > 0 &&
                          ` · ${item.lessons.length} lesson${item.lessons.length === 1 ? '' : 's'}`}
                      </span>
                    </span>
                    <IconChevron style={{ width: 16, height: 16, opacity: 0.5 }} />
                  </button>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {adding && <AddSheet onClose={() => setAdding(false)} />}
      {open && <ItemSheet id={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

// ----------------------------------------------------------- lesson stream

/** Everything learned, everywhere, newest first. */
function LessonStream() {
  const state = useStore()
  const lessons = allLessons(state)

  if (lessons.length === 0) {
    return (
      <Card>
        <Empty>No lessons captured yet. Open a source and add one as you go.</Empty>
      </Card>
    )
  }

  return (
    <>
      <SectionTitle title={`${lessons.length} lessons`} />
      <Card>
        {lessons.map(({ itemId, itemTitle, lesson }) => (
          <div className="insight" key={lesson.id}>
            <div className="insight-head">
              <span className="insight-title">{lesson.text}</span>
              <button
                onClick={() =>
                  actions.updateLesson(itemId, lesson.id, { applied: !lesson.applied })
                }
                aria-label="Mark applied"
                style={{ display: 'flex' }}
              >
                <Check on={lesson.applied} />
              </button>
            </div>
            {lesson.action && (
              <div className="insight-body">
                <strong style={{ fontWeight: 600 }}>Do:</strong> {lesson.action}
              </div>
            )}
            <div className="t-foot muted">
              {itemTitle}
              {lesson.date && ` · ${formatShort(lesson.date)}`}
              {!lesson.applied && lesson.action && ' · not applied yet'}
            </div>
          </div>
        ))}
      </Card>
    </>
  )
}

// ------------------------------------------------------------------- sheets

function AddSheet({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const [kind, setKind] = useState<LearnKind>('book')
  const [title, setTitle] = useState('')
  const [source, setSource] = useState('')
  const [status, setStatus] = useState<LearnStatus>('queued')
  const [date, setDate] = useState('')

  const save = () => {
    if (!title.trim()) return
    actions.setLearning([
      ...state.learning,
      {
        id: uid(),
        kind,
        title: title.trim(),
        source: source.trim(),
        status: kind === 'event' ? 'done' : status,
        date,
        notes: '',
        lessons: [],
      },
    ])
    onClose()
  }

  return (
    <Sheet title="Add a source" onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="Kind">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'book', label: 'Book' },
              { value: 'course', label: 'Course' },
              { value: 'event', label: 'Event' },
            ]}
          />
        </Field>
        <TextField label="Title" value={title} onChange={setTitle} placeholder="What is it" />
        <TextField
          label={kind === 'book' ? 'Author' : kind === 'course' ? 'Provider' : 'Host'}
          value={source}
          onChange={setSource}
          placeholder="Optional"
        />
        {kind === 'event' ? (
          <Field label="Date">
            <input
              className="input"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        ) : (
          <Field label="Status">
            <Segmented
              value={status}
              onChange={setStatus}
              options={[
                { value: 'queued', label: 'Queued' },
                { value: 'active', label: 'In progress' },
                { value: 'done', label: 'Finished' },
              ]}
            />
          </Field>
        )}
        <button className="btn btn-primary btn-block" onClick={save} disabled={!title.trim()}>
          Add
        </button>
      </div>
    </Sheet>
  )
}

/** One source, its status, and every lesson pulled out of it. */
function ItemSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useStore()
  const item = state.learning.find((i) => i.id === id)
  const [text, setText] = useState('')
  const [action, setAction] = useState('')

  if (!item) return null

  const addLesson = () => {
    if (!text.trim()) return
    const lesson: Lesson = {
      id: uid(),
      date: todayISO(),
      text: text.trim(),
      action: action.trim(),
      applied: false,
    }
    actions.addLesson(item.id, lesson)
    setText('')
    setAction('')
  }

  return (
    <Sheet title={item.title} onClose={onClose}>
      <div style={{ display: 'grid', gap: 16 }}>
        <Field label="Status">
          <Segmented
            value={item.status}
            onChange={(status: LearnStatus) => actions.updateLearnItem(item.id, { status })}
            options={[
              { value: 'queued', label: 'Queued' },
              { value: 'active', label: 'In progress' },
              { value: 'done', label: 'Finished' },
            ]}
          />
        </Field>

        <TextField
          label="Notes"
          value={item.notes}
          onChange={(notes) => actions.updateLearnItem(item.id, { notes })}
          placeholder="Running notes on this source"
          multiline
        />

        <Card>
          <CardHead title={`Capture a lesson`} />
          <div style={{ display: 'grid', gap: 11, padding: 14 }}>
            <TextField
              label="What you learned"
              value={text}
              onChange={setText}
              placeholder="The idea, in your own words"
              multiline
            />
            <TextField
              label="What you'll do about it"
              value={action}
              onChange={setAction}
              placeholder="The change it makes — this is the part that matters"
            />
            <button className="btn btn-block" onClick={addLesson} disabled={!text.trim()}>
              <IconPlus style={{ width: 15, height: 15 }} />
              Add lesson
            </button>
          </div>
        </Card>

        {item.lessons.length > 0 && (
          <div>
            <SectionTitle title={`${item.lessons.length} captured`} />
            <Card>
              {item.lessons.map((l) => (
                <div className="insight" key={l.id}>
                  <div className="insight-head">
                    <span className="insight-title">{l.text}</span>
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <button
                        onClick={() =>
                          actions.updateLesson(item.id, l.id, { applied: !l.applied })
                        }
                        aria-label="Mark applied"
                        style={{ display: 'flex' }}
                      >
                        <Check on={l.applied} />
                      </button>
                      <button
                        className="btn btn-quiet btn-danger"
                        onClick={() => actions.removeLesson(item.id, l.id)}
                        aria-label="Remove lesson"
                      >
                        <IconTrash style={{ width: 15, height: 15 }} />
                      </button>
                    </span>
                  </div>
                  {l.action && (
                    <div className="insight-body">
                      <strong style={{ fontWeight: 600 }}>Do:</strong> {l.action}
                    </div>
                  )}
                  <div className="t-foot muted">
                    {formatShort(l.date)}
                    {l.applied ? ' · applied' : l.action ? ' · not applied yet' : ''}
                  </div>
                </div>
              ))}
            </Card>
          </div>
        )}

        <button
          className="btn btn-danger btn-block"
          onClick={() => {
            actions.setLearning(state.learning.filter((i) => i.id !== item.id))
            onClose()
          }}
        >
          Remove this source
        </button>
      </div>
    </Sheet>
  )
}
