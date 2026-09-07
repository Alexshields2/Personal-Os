import { useMemo, useState } from 'react'
import {
  Card,
  Empty,
  Field,
  NumberField,
  SectionTitle,
  Segmented,
  Sheet,
  Stat,
  TextField,
} from '../components/ui'
import { IconPlus, IconTrash } from '../components/icons'
import { AGENDA_DAYS, MONTH_LABEL, PRIORITY_TAGS, REPEAT_LABEL } from '../lib/config'
import { formatLong, formatShort, fromISO, todayISO, toISO } from '../lib/date'
import { euro, uid } from '../lib/format'
import { actions, useStore } from '../lib/store'
import { agenda, monthGrid, upcomingEvents } from '../lib/selectors'
import { durationLabel } from '../lib/selectors'
import type { EventRepeat, Priority } from '../lib/types'

const DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/**
 * One place to see what's coming. It shows more than events on purpose: a month
 * that hides the tasks you scheduled and the bills that land is a month you
 * still have to cross-check against two other screens.
 */
export default function Calendar() {
  const state = useStore()
  const today = todayISO()
  const [view, setView] = useState<'agenda' | 'month'>('agenda')
  const [anchor, setAnchor] = useState(today)
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState<string | null>(null)

  const list = useMemo(() => agenda(state, today, AGENDA_DAYS), [state, today])
  const soon = useMemo(() => upcomingEvents(state, today), [state, today])
  const grid = useMemo(() => monthGrid(state, anchor, today), [state, anchor, today])
  const month = fromISO(anchor)

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            What's coming
          </span>
        </div>
        <h1 className="t-large">Calendar</h1>
        <p className="t-sub">
          Events, the work you've scheduled, and the money going out — on the same page,
          because checking three screens is how a date gets missed.
        </p>
      </header>

      <div className="grid-3">
        <Stat label="Coming up" value={String(soon.length)} sub="inside their reminder" />
        <Stat label="Events" value={String(state.events.length)} />
        <Stat
          label="Busy days"
          value={String(list.length)}
          sub={`in the next ${AGENDA_DAYS}`}
        />
      </div>

      <div style={{ margin: '18px 0 12px' }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'agenda', label: 'Agenda' },
            { value: 'month', label: 'Month' },
          ]}
        />
      </div>

      {view === 'month' ? (
        <>
          <div className="board-bar">
            <button
              className="btn btn-sm"
              onClick={() => setAnchor(toISO(new Date(month.getFullYear(), month.getMonth() - 1, 1)))}
            >
              ←
            </button>
            <span className="board-zoom" style={{ minWidth: 108 }}>
              {MONTH_LABEL[month.getMonth()]} {month.getFullYear()}
            </span>
            <button
              className="btn btn-sm"
              onClick={() => setAnchor(toISO(new Date(month.getFullYear(), month.getMonth() + 1, 1)))}
            >
              →
            </button>
            <button className="btn btn-sm" onClick={() => setAnchor(today)}>
              Today
            </button>
          </div>

          <Card>
            <div className="cal-dow">
              {DOW.map((d, i) => (
                <span key={i}>{d}</span>
              ))}
            </div>
            <div className="cal-grid">
              {grid.map((cell) => (
                <button
                  key={cell.date}
                  className="cal-cell"
                  data-out={!cell.inMonth}
                  data-today={cell.isToday}
                  onClick={() => setAdding(cell.date)}
                >
                  <span className="cal-num">{fromISO(cell.date).getDate()}</span>
                  <span className="cal-marks">
                    {cell.events.slice(0, 3).map((e) => (
                      <i key={e.id} className="cal-dot" title={e.title} />
                    ))}
                    {cell.taskCount > 0 && <i className="cal-dot cal-dot-task" />}
                    {cell.billCount > 0 && <i className="cal-dot cal-dot-bill" />}
                  </span>
                </button>
              ))}
            </div>
          </Card>
          <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
            Solid marks are events, the outlined one is work, the hollow one is money going
            out. Tap a day to add something to it.
          </p>
        </>
      ) : (
        <>
          <SectionTitle
            title={`Next ${AGENDA_DAYS} days`}
            action={
              <button className="btn btn-quiet btn-sm" onClick={() => setAdding(today)}>
                Add
              </button>
            }
          />
          {list.length === 0 ? (
            <Card>
              <Empty>Nothing on. Either the month is clear or nothing is written down.</Empty>
            </Card>
          ) : (
            <Card>
              {list.map((entry) => (
                <div className="agenda-day" key={entry.date}>
                  <div className="agenda-date">
                    <span className="agenda-when">
                      {entry.daysAway === 0
                        ? 'Today'
                        : entry.daysAway === 1
                          ? 'Tomorrow'
                          : formatLong(entry.date)}
                    </span>
                    {entry.daysAway > 1 && (
                      <span className="t-foot muted">in {entry.daysAway} days</span>
                    )}
                  </div>

                  <div className="agenda-items">
                    {entry.events.map((e) => (
                      <button className="agenda-item" key={e.id} onClick={() => setEditing(e.id)}>
                        <span className="agenda-time">{e.time || 'All day'}</span>
                        <span className="agenda-main">
                          <span>{e.title}</span>
                          {(e.repeat !== 'none' || e.durationMin > 0) && (
                            <span className="t-foot muted">
                              {[
                                e.repeat !== 'none' ? REPEAT_LABEL[e.repeat] : '',
                                e.durationMin > 0 ? durationLabel(e.durationMin) : '',
                              ]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          )}
                        </span>
                      </button>
                    ))}

                    {entry.scheduled.map((t) => (
                      <div className="agenda-item agenda-quiet" key={`s-${t.id}`}>
                        <span className="agenda-time">Work</span>
                        <span className="agenda-main">
                          <span>{t.title}</span>
                          {t.estimateMin > 0 && (
                            <span className="t-foot muted">{durationLabel(t.estimateMin)}</span>
                          )}
                        </span>
                      </div>
                    ))}

                    {entry.due.map((t) => (
                      <div className="agenda-item agenda-quiet" key={`d-${t.id}`}>
                        <span className="agenda-time">Due</span>
                        <span className="agenda-main">
                          <span>{t.title}</span>
                        </span>
                      </div>
                    ))}

                    {entry.bills.map((b) => (
                      <div className="agenda-item agenda-quiet" key={`b-${b.id}`}>
                        <span className="agenda-time">Out</span>
                        <span className="agenda-main">
                          <span>{b.label}</span>
                          <span className="t-foot muted">{euro(b.amount)}</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      {adding && <EventSheet date={adding} onClose={() => setAdding(null)} />}
      {editing && <EventSheet id={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function EventSheet({
  id,
  date,
  onClose,
}: {
  id?: string
  date?: string
  onClose: () => void
}) {
  const state = useStore()
  const existing = id ? state.events.find((e) => e.id === id) : undefined

  const [title, setTitle] = useState(existing?.title ?? '')
  const [when, setWhen] = useState(existing?.date ?? date ?? todayISO())
  const [time, setTime] = useState(existing?.time ?? '')
  const [durationMin, setDuration] = useState(existing?.durationMin ?? 0)
  const [repeat, setRepeat] = useState<EventRepeat>(existing?.repeat ?? 'none')
  const [tag, setTag] = useState<Priority['tag']>(existing?.tag ?? 'life')
  const [remindDays, setRemind] = useState(existing?.remindDays ?? 3)
  const [notes, setNotes] = useState(existing?.notes ?? '')

  const save = () => {
    if (!title.trim()) return
    const payload = {
      title: title.trim(),
      date: when,
      time,
      durationMin,
      repeat,
      tag,
      remindDays,
      notes,
    }
    if (existing) actions.updateEvent(existing.id, payload)
    else actions.addEvent({ id: uid(), ...payload })
    onClose()
  }

  return (
    <Sheet title={existing ? existing.title : `Add to ${formatShort(when)}`} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField label="What" value={title} onChange={setTitle} placeholder="Name it" />

        <Field label="Date">
          <input
            className="input"
            type="date"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </Field>

        <Field label="Time">
          <input
            className="input"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </Field>

        <Field label="Repeats">
          <Segmented
            value={repeat}
            onChange={setRepeat}
            options={[
              { value: 'none', label: 'Once' },
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
            ]}
          />
        </Field>

        <Field label="Belongs to">
          <Segmented
            value={tag}
            onChange={setTag}
            options={PRIORITY_TAGS.map((t) => ({ value: t.id, label: t.label }))}
          />
        </Field>

        <NumberField
          label="How long (minutes)"
          value={durationMin}
          onChange={setDuration}
          placeholder="Leave at 0 for all day"
        />

        <NumberField
          label="Start reminding this many days ahead"
          value={remindDays}
          onChange={setRemind}
        />

        <TextField label="Notes" value={notes} onChange={setNotes} multiline />

        <button className="btn btn-primary btn-block" onClick={save} disabled={!title.trim()}>
          {existing ? 'Save' : 'Add'}
        </button>

        {existing && (
          <button
            className="btn btn-danger btn-block"
            onClick={() => {
              actions.removeEvent(existing.id)
              onClose()
            }}
          >
            <IconTrash style={{ width: 16, height: 16 }} />
            Delete
          </button>
        )}

        {!existing && (
          <p className="t-foot muted">
            <IconPlus style={{ width: 12, height: 12, marginRight: 4 }} />
            A yearly repeat is how birthdays and renewals belong here — one entry, every year.
          </p>
        )}
      </div>
    </Sheet>
  )
}
