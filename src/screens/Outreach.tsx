import { useRef, useState } from 'react'
import { Card, Empty, Field, SectionTitle, Sheet, Stat, TextField } from '../components/ui'
import { IconTrash } from '../components/icons'
import { CONTACT_CHANNELS, OUTREACH_STAGES } from '../lib/config'
import { downscaleImage } from '../lib/image'
import { parseContact } from '../lib/parseContact'
import { parseContactCsv } from '../lib/importContacts'
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

const PAGE = 25

export default function Outreach() {
  const state = useStore()
  const [adding, setAdding] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(PAGE)
  const contact = state.outreach.find((c) => c.id === open) ?? null

  const q = query.trim().toLowerCase()
  const matches = q
    ? state.outreach.filter((c) =>
        [c.name, c.company, c.role, c.segment, c.priority].some((f) =>
          (f ?? '').toLowerCase().includes(q),
        ),
      )
    : state.outreach

  // Priority first when a list has been imported, then most recent.
  const ordered = [...matches].sort((a, b) => (a.priority || 'zz').localeCompare(b.priority || 'zz'))

  const byStage = (stage: OutreachStage) => ordered.filter((c) => c.stage === stage)

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

      <ListImport />
      <ShotImport />

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

      {state.outreach.length > 12 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: '1 1 220px' }}
            placeholder="Search name, company, sector or priority"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setShown(PAGE)
            }}
          />
          <span className="t-foot muted">
            {matches.length} of {state.outreach.length}
          </span>
        </div>
      )}

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
                  <>
                    {items.slice(0, shown).map((c) => (
                      <ContactCard key={c.id} contact={c} onOpen={() => setOpen(c.id)} />
                    ))}
                    {items.length > shown && (
                      <button
                        className="btn btn-quiet btn-sm btn-block"
                        onClick={() => setShown(shown + PAGE)}
                      >
                        {items.length - shown} more
                      </button>
                    )}
                  </>
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

/**
 * Bringing a researched list in from a spreadsheet.
 *
 * The file stays on your machine — it is read in the browser and never
 * uploaded or committed anywhere, which matters when the list is a few
 * hundred named people.
 */
function ListImport() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [text, setText] = useState('')
  const [result, setResult] = useState<{ added: number; total: number; skipped: number } | null>(null)
  const [error, setError] = useState('')
  const [openBox, setOpenBox] = useState(false)

  const run = (csv: string) => {
    setError('')
    const parsed = parseContactCsv(csv)
    if (parsed.error) {
      setResult(null)
      setError(parsed.error)
      return
    }
    const added = actions.importOutreach(parsed.rows)
    setResult({ added, total: parsed.rows.length, skipped: parsed.skipped })
    setText('')
  }

  return (
    <Card className="card-pad" style={{ marginTop: 14 }}>
      <div className="or-import">
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="t-cap">From a list</div>
          <p className="t-foot muted" style={{ marginTop: 4 }}>
            A CSV of researched companies. Columns are matched by name, anyone already on the
            board is skipped, and the file never leaves this device.
          </p>
        </div>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          Choose a CSV
        </button>
        <button className="btn btn-quiet" onClick={() => setOpenBox(!openBox)}>
          {openBox ? 'Hide' : 'Paste'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void f.text().then(run)
            e.target.value = ''
          }}
        />
      </div>

      {openBox && (
        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <textarea
            className="input"
            style={{ minHeight: 120, fontFamily: 'monospace', fontSize: 12 }}
            placeholder="Paste the sheet here, header row included"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button className="btn btn-primary" onClick={() => run(text)} disabled={!text.trim()}>
            Import
          </button>
        </div>
      )}

      {error && <p className="t-foot" style={{ marginTop: 10, color: 'var(--exec-close)' }}>{error}</p>}
      {result && (
        <p className="t-foot" style={{ marginTop: 10, color: 'var(--won)' }}>
          Added {result.added} of {result.total}
          {result.total - result.added > 0 && ` · ${result.total - result.added} already on the board`}
        </p>
      )}
    </Card>
  )
}

/**
 * Screenshot in, contact draft out. The OCR runs on this device — a photo of
 * someone's profile is never uploaded anywhere — and everything it reads is
 * shown as an editable draft, because it will sometimes get a name wrong and
 * silently saving a wrong one is worse than making you glance at it.
 */
function ShotImport() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState('')
  const [draft, setDraft] = useState<{ name: string; role: string; company: string; shot: string } | null>(
    null,
  )
  const [error, setError] = useState('')

  const run = async (file: File) => {
    setError('')
    setBusy('Reading the image…')
    try {
      const shot = await downscaleImage(file, 1400, 0.8)
      setBusy('Finding the text… (first run downloads the recogniser)')
      // Loaded on demand so the recogniser never weighs down the main bundle.
      const { recognize } = await import('tesseract.js')
      const { data } = await recognize(shot, 'eng')
      const parsed = parseContact(data.text ?? '')
      setDraft({ ...parsed, shot })
      if (!parsed.name) setError("Couldn't pick out a name — type it below and the rest is yours to fill.")
    } catch {
      setError("Couldn't read that image. Add the contact by hand instead.")
    } finally {
      setBusy('')
    }
  }

  const save = () => {
    if (!draft) return
    actions.addOutreach(draft.name || 'Unnamed', {
      role: draft.role,
      company: draft.company,
      shot: draft.shot,
    })
    setDraft(null)
  }

  return (
    <Card className="card-pad" style={{ marginTop: 14 }}>
      <div className="or-import">
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="t-cap">From a screenshot</div>
          <p className="t-foot muted" style={{ marginTop: 4 }}>
            Drop in a profile screenshot and it reads the name, role and company. Runs on this
            device — the image is never uploaded.
          </p>
        </div>
        <button className="btn" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
          {busy ? 'Working…' : 'Choose a screenshot'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void run(f)
            e.target.value = ''
          }}
        />
      </div>

      {busy && <p className="t-foot muted" style={{ marginTop: 10 }}>{busy}</p>}
      {error && <p className="t-foot" style={{ marginTop: 10, color: 'var(--exec-close)' }}>{error}</p>}

      {draft && (
        <div className="or-draft">
          <div className="t-cap" style={{ marginBottom: 8 }}>Check this before saving</div>
          <div className="or-draft-grid">
            {draft.shot && <img src={draft.shot} alt="" className="or-shot" />}
            <div style={{ display: 'grid', gap: 10, flex: 1, minWidth: 190 }}>
              <TextField label="Name" value={draft.name} onChange={(name) => setDraft({ ...draft, name })} />
              <TextField label="Role" value={draft.role} onChange={(role) => setDraft({ ...draft, role })} />
              <TextField
                label="Company"
                value={draft.company}
                onChange={(company) => setDraft({ ...draft, company })}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-primary btn-block" onClick={save}>
                  Add to Target
                </button>
                <button className="btn" onClick={() => setDraft(null)}>
                  Discard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
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
        {(contact.priority || contact.segment) && (
          <span className="or-chans">
            {[contact.priority && `P${contact.priority}`, contact.segment].filter(Boolean).join(' · ')}
          </span>
        )}
        {contact.channels.length > 0 && (
          <span className="or-chans">{contact.channels.join(' · ')}</span>
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
          label="Profile"
          value={contact.handle}
          onChange={(handle) => set({ handle })}
          placeholder="LinkedIn URL"
        />
        <TextField
          label="Work email"
          value={contact.workEmail}
          onChange={(workEmail) => set({ workEmail })}
          placeholder="name@company.com"
        />
        <TextField
          label="Personal email"
          value={contact.personalEmail}
          onChange={(personalEmail) => set({ personalEmail })}
          placeholder="name@gmail.com"
        />
        <TextField
          label="Phone"
          value={contact.phone}
          onChange={(phone) => set({ phone })}
          placeholder="+353…"
        />
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <TextField label="Priority" value={contact.priority} onChange={(priority) => set({ priority })} />
          </div>
          <div style={{ flex: 2 }}>
            <TextField label="Sector" value={contact.segment} onChange={(segment) => set({ segment })} />
          </div>
        </div>
        <Field label="Channels">
          <div className="chips">
            {CONTACT_CHANNELS.map((ch) => {
              const on = contact.channels.includes(ch)
              return (
                <button
                  key={ch}
                  className="chip chip-sm"
                  aria-pressed={on}
                  onClick={() =>
                    set({
                      channels: on
                        ? contact.channels.filter((c) => c !== ch)
                        : [...contact.channels, ch],
                    })
                  }
                >
                  {ch}
                </button>
              )
            })}
          </div>
        </Field>
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
        {contact.shot && (
          <Field label="Screenshot">
            <img src={contact.shot} alt="" className="or-shot" />
          </Field>
        )}
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
