import { useState } from 'react'
import { Card, Empty, Field, SectionTitle, Sheet, Stat, TextField } from '../components/ui'
import { IconTrash } from '../components/icons'
import { OUTREACH_STAGES } from '../lib/config'
import { daysBetween, todayISO } from '../lib/date'
import { actions, useStore } from '../lib/store'
import type { OutreachContact, OutreachStage } from '../lib/types'

/**
 * The named-people board: has this person heard from us, did they answer, is
 * it in the diary. Four columns and nothing else — it exists to be moved
 * through in seconds, not to hold a record of everything ever said.
 *
 * Separate from Deals (money and probability) and Network (keeping warm)
 * because a cold approach is neither yet.
 */

const STALE_DAYS = 7

export default function Outreach() {
  const state = useStore()
  const [adding, setAdding] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const contact = state.outreach.find((c) => c.id === open) ?? null

  const byStage = (stage: OutreachStage) => state.outreach.filter((c) => c.stage === stage)

  const add = () => {
    if (!adding.trim()) return
    actions.addOutreach(adding)
    setAdding('')
  }

  return (
    <>
      <div className="grid-3">
        {OUTREACH_STAGES.map((s) => (
          <Stat
            key={s.id}
            label={s.label}
            value={String(byStage(s.id).length)}
            sub={s.hint}
            accent={s.id === 'meeting' && byStage('meeting').length > 0 ? 'var(--won)' : undefined}
          />
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, margin: '16px 0 14px' }}>
        <input
          className="input"
          style={{ flex: 1 }}
          placeholder="Add a name — CEO, founder, whoever you're going after"
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="btn btn-primary" onClick={add} disabled={!adding.trim()}>
          Add
        </button>
      </div>

      {state.outreach.length === 0 ? (
        <Card>
          <Empty>
            Nobody on the list yet. Add the people worth a custom approach — this is the list
            the daily high-value outreach target is spent on.
          </Empty>
        </Card>
      ) : (
        <div className="or-board">
          {OUTREACH_STAGES.map((s) => {
            const items = byStage(s.id)
            return (
              <div className="or-col" key={s.id}>
                <div className="or-col-head">
                  <span className="t-cap">{s.label}</span>
                  <span className="t-num muted">{items.length}</span>
                </div>
                {items.length === 0 ? (
                  <div className="or-empty t-foot muted">—</div>
                ) : (
                  items.map((c) => <ContactCard key={c.id} contact={c} onOpen={() => setOpen(c.id)} />)
                )}
              </div>
            )
          })}
        </div>
      )}

      <p className="t-foot muted" style={{ padding: '12px 4px 0' }}>
        Arrows move someone a stage. Anything sitting in one place for more than {STALE_DAYS}{' '}
        days is marked — a cold approach that goes quiet is the normal outcome, but it should
        be visible rather than silently parked.
      </p>

      {contact && <ContactSheet contact={contact} onClose={() => setOpen(null)} />}
    </>
  )
}

function ContactCard({ contact, onOpen }: { contact: OutreachContact; onOpen: () => void }) {
  const idx = OUTREACH_STAGES.findIndex((s) => s.id === contact.stage)
  const waiting = contact.movedAt ? daysBetween(contact.movedAt, todayISO()) : 0
  const stale = waiting >= STALE_DAYS && contact.stage !== 'meeting'

  const move = (dir: -1 | 1) => {
    const next = OUTREACH_STAGES[idx + dir]
    if (next) actions.updateOutreach(contact.id, { stage: next.id })
  }

  return (
    <div className="or-card" data-stale={stale}>
      <button className="or-card-main" onClick={onOpen}>
        <span className="or-name">{contact.name || 'Unnamed'}</span>
        {(contact.role || contact.company) && (
          <span className="or-sub">
            {[contact.role, contact.company].filter(Boolean).join(' · ')}
          </span>
        )}
        {waiting > 0 && (
          <span className="or-age t-num" style={stale ? { color: 'var(--exec-close)' } : undefined}>
            {waiting}d
          </span>
        )}
      </button>
      <div className="or-move">
        <button
          className="btn btn-quiet btn-sm"
          onClick={() => move(-1)}
          disabled={idx <= 0}
          aria-label={`Move ${contact.name} back a stage`}
        >
          ←
        </button>
        <button
          className="btn btn-quiet btn-sm"
          onClick={() => move(1)}
          disabled={idx >= OUTREACH_STAGES.length - 1}
          aria-label={`Move ${contact.name} on a stage`}
        >
          →
        </button>
      </div>
    </div>
  )
}

function ContactSheet({ contact, onClose }: { contact: OutreachContact; onClose: () => void }) {
  const set = (patch: Partial<OutreachContact>) => actions.updateOutreach(contact.id, patch)

  return (
    <Sheet title={contact.name || 'Contact'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField label="Name" value={contact.name} onChange={(name) => set({ name })} />
        <TextField label="Role" value={contact.role} onChange={(role) => set({ role })} placeholder="CEO" />
        <TextField
          label="Company"
          value={contact.company}
          onChange={(company) => set({ company })}
        />
        <TextField
          label="Where"
          value={contact.handle}
          onChange={(handle) => set({ handle })}
          placeholder="LinkedIn URL or email"
        />
        <Field label="Stage">
          <select
            className="input"
            value={contact.stage}
            onChange={(e) => set({ stage: e.target.value as OutreachStage })}
          >
            {OUTREACH_STAGES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <TextField
          label="Notes"
          value={contact.notes}
          onChange={(notes) => set({ notes })}
          placeholder="What you said, what they said, what's next"
          multiline
        />
        <button
          className="btn btn-block btn-danger"
          onClick={() => {
            if (confirm(`Remove ${contact.name || 'this contact'} from the list?`)) {
              actions.removeOutreach(contact.id)
              onClose()
            }
          }}
        >
          <IconTrash style={{ width: 15, height: 15 }} />
          Remove
        </button>
      </div>
    </Sheet>
  )
}
