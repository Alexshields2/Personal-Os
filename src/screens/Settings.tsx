import { useRef, useState } from 'react'
import { Card, Empty, Field, NumberField, SectionTitle, Segmented } from '../components/ui'
import { IconPlus, IconTrash } from '../components/icons'
import SyncCard from '../components/SyncCard'
import { useSync } from '../lib/sync'
import { METRICS, PILLARS } from '../lib/config'
import { uid } from '../lib/format'
import { formatWithYear, isoForDay } from '../lib/date'
import { euroCompact } from '../lib/format'
import { actions, byTime, exportJSON, useStore } from '../lib/store'
import type {
  AppState,
  ChecklistItem,
  MetricKey,
  PillarId,
  Targets,
  Theme,
  Tracker,
  TrackerKind,
} from '../lib/types'

export default function Settings() {
  const state = useStore()
  const sync = useSync()
  const fileRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState('')

  const scoredMetrics = new Set(state.checklist.map((c) => c.metric).filter(Boolean))

  const flash = (m: string) => {
    setNote(m)
    setTimeout(() => setNote(''), 3200)
  }

  const download = () => {
    const blob = new Blob([exportJSON()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `personal-os-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    flash('Backup downloaded.')
  }

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppState
      if (!parsed || typeof parsed !== 'object' || !('days' in parsed)) {
        flash("That file isn't a Personal OS backup.")
        return
      }
      if (!confirm('Replace everything currently stored with this backup?')) return
      actions.replaceAll(parsed)
      flash('Backup restored.')
    } catch {
      flash("Couldn't read that file.")
    }
  }

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            Protocol setup
          </span>
        </div>
        <h1 className="t-large">Settings</h1>
        <p className="t-sub">
          {sync.email
            ? `Synced to ${sync.email}. Also saved on this device.`
            : 'Everything stays on this device.'}
        </p>
      </header>

      <SyncCard />

      <SectionTitle title="Protocol" />
      <Card className="card-pad">
        <Field label="Day 1">
          <input
            className="input"
            type="date"
            value={state.startDate}
            onChange={(e) => e.target.value && actions.setStartDate(e.target.value)}
          />
        </Field>
        <div style={{ marginTop: 14 }}>
          <NumberField
            label="Length of the protocol (days)"
            value={state.targets.protocolDays}
            onChange={(v) => actions.setTargets({ protocolDays: Math.max(1, Math.round(v)) })}
          />
        </div>
        <p className="t-foot" style={{ marginTop: 10 }}>
          Day {state.targets.protocolDays} lands on{' '}
          <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {formatWithYear(isoForDay(state.startDate, state.targets.protocolDays))}
          </strong>
          .
        </p>
      </Card>

      <SectionTitle title="Financial targets" />
      <Card className="card-pad">
        <div className="stack" style={{ display: 'grid', gap: 14 }}>
          <NumberField
            label={`Consulting.ie bonus pool — currently ${euroCompact(state.targets.bonusPool)}`}
            value={state.targets.bonusPool}
            onChange={(v) => actions.setTargets({ bonusPool: v })}
          />
          <NumberField
            label={`Personal payout — currently ${euroCompact(state.targets.personalPayout)}`}
            value={state.targets.personalPayout}
            onChange={(v) => actions.setTargets({ personalPayout: v })}
          />
          <NumberField
            label={`Net worth target — currently ${euroCompact(state.targets.netWorth)}`}
            value={state.targets.netWorth}
            onChange={(v) => actions.setTargets({ netWorth: v })}
          />
          <NumberField
            label="Bodyweight target (kg)"
            value={state.targets.bodyweightKg}
            onChange={(v) => actions.setTargets({ bodyweightKg: v })}
          />
        </div>
      </Card>

      {/* Only the numbers a standard is actually scored against. A target for
          something nothing measures is a setting that does nothing. */}
      <SectionTitle title="Daily targets" />
      <Card>
        <div className="rows">
          {METRICS.filter((m) => scoredMetrics.has(m.key)).map((m) => (
            <div className="row" key={m.key}>
              <span className="row-main">
                <span className="row-title">{m.label}</span>
                <span className="row-sub">{m.invert ? 'Stay under' : 'Hit at least'}</span>
              </span>
              <input
                className="input t-num"
                style={{ width: 108, textAlign: 'right', padding: '8px 11px' }}
                inputMode="decimal"
                value={String(state.targets[m.key as keyof Targets] ?? 0)}
                onChange={(e) => {
                  const v = Number.parseFloat(e.target.value.replace(',', '.'))
                  actions.setTargets({ [m.key]: Number.isFinite(v) ? v : 0 } as Partial<Targets>)
                }}
              />
              <span className="row-value muted" style={{ width: 34 }}>
                {m.unit}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <ChecklistEditor />

      <SectionTitle title="Capacity" />
      <Card className="card-pad">
        <NumberField
          label="Hours of real work a day can hold"
          value={state.targets.dailyCapacityMin / 60}
          onChange={(h) => actions.setTargets({ dailyCapacityMin: Math.max(0, h * 60) })}
        />
        <p className="t-foot muted" style={{ marginTop: 10 }}>
          The line the week board plans against. Set it to what a day actually holds, not what
          you wish it did — an honest number is the only one that can tell you a week won't fit.
        </p>
      </Card>

      <SectionTitle title="Appearance" />
      <Card className="card-pad">
        <Field label="Ground">
          <Segmented
            value={state.theme}
            onChange={(theme: Theme) => actions.setTheme(theme)}
            options={[
              { value: 'dark', label: 'Dark' },
              { value: 'light', label: 'Light' },
            ]}
          />
        </Field>
        <p className="t-foot muted" style={{ marginTop: 10 }}>
          Black and white either way — this only decides which end is the ground. Dark suits
          the hours this actually gets used in.
        </p>
      </Card>

      <MorningEditor />

      <TrackerEditor />

      <RewardEditor />

      <SectionTitle title="Your data" />
      <Card className="card-pad">
        <p className="t-foot" style={{ marginBottom: 14 }}>
          Export writes a full copy you can restore anywhere. Worth doing now and then even
          with sync on — it's the only thing that recovers a bad edit.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          <button className="btn btn-block" onClick={download}>
            Export backup
          </button>
          <button className="btn btn-block" onClick={() => fileRef.current?.click()}>
            Restore from backup
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void importFile(f)
              e.target.value = ''
            }}
          />
          {Object.keys(state.days).length === 0 && (
            <button
              className="btn btn-block"
              onClick={() => {
                if (actions.seedDemo())
                  flash('Sixty sample days added, across every section. Erase any time.')
              }}
            >
              Fill sample data
            </button>
          )}
          <button
            className="btn btn-block btn-danger"
            onClick={() => {
              if (confirm('Erase every logged day, week and money entry? This cannot be undone.')) {
                actions.reset()
                flash('Everything reset.')
              }
            }}
          >
            Erase everything
          </button>
        </div>
        {note && (
          <p className="t-foot" style={{ marginTop: 12, color: 'var(--accent)' }} role="status">
            {note}
          </p>
        )}
      </Card>

      <p className="t-foot muted" style={{ textAlign: 'center', margin: '26px 0 6px' }}>
        126 days. Head down. Same inputs. Every day.
      </p>
    </div>
  )
}

// ------------------------------------------------------------ checklist editor

const PILLAR_OPTIONS = PILLARS.map((p) => p.id)

/**
 * The standards the day is actually scored against — "10 hours in office",
 * "Sleep target", all of it. Used to be a fixed list; now it's data, so a
 * standard that doesn't fit your life can be reworded, reweighted or deleted
 * instead of silently ignored forever.
 */
function ChecklistEditor() {
  const state = useStore()
  const [label, setLabel] = useState('')
  const [pillar, setPillar] = useState<PillarId>('business')

  const update = (id: string, patch: Partial<ChecklistItem>) => {
    actions.setChecklist(state.checklist.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  const add = () => {
    if (!label.trim()) return
    const item: ChecklistItem = { id: uid(), label: label.trim(), pillar, points: 1 }
    actions.setChecklist([...state.checklist, item])
    setLabel('')
  }

  const totalByPillar = (p: PillarId) =>
    state.checklist.filter((c) => c.pillar === p).reduce((s, c) => s + c.points, 0)
  const total = state.checklist.reduce((s, c) => s + c.points, 0)

  return (
    <>
      <SectionTitle
        title="Standards"
        action={<span className="t-foot muted">{total} points</span>}
      />
      <Card>
        {state.checklist.length === 0 ? (
          <Empty>Nothing set. What actually earns points on a good day?</Empty>
        ) : (
          <div className="rows">
            {state.checklist.map((c) => (
              <div key={c.id} className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <input
                  className="input input-plain"
                  style={{ flex: '1 1 160px' }}
                  value={c.label}
                  onChange={(e) => update(c.id, { label: e.target.value })}
                />
                <select
                  className="input"
                  style={{ width: 120, flex: 'none' }}
                  value={c.pillar}
                  onChange={(e) => update(c.id, { pillar: e.target.value as PillarId })}
                >
                  {PILLAR_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {PILLARS.find((x) => x.id === p)?.label}
                    </option>
                  ))}
                </select>
                <input
                  className="input"
                  type="number"
                  style={{ width: 64, flex: 'none' }}
                  value={c.points}
                  onChange={(e) => update(c.id, { points: Math.max(0, Number(e.target.value) || 0) })}
                />
                <select
                  className="input"
                  style={{ width: 150, flex: 'none' }}
                  value={c.metric ?? ''}
                  onChange={(e) =>
                    update(c.id, { metric: (e.target.value || undefined) as MetricKey | undefined })
                  }
                >
                  <option value="">Manual check</option>
                  {METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      Tied to: {m.label}
                    </option>
                  ))}
                </select>
                {c.metric && (
                  <label
                    style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
                    className="dim"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(c.invert)}
                      onChange={(e) => update(c.id, { invert: e.target.checked })}
                    />
                    Ceiling, not floor
                  </label>
                )}
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => {
                    if (confirm(`Delete "${c.label}"? Days already logged against it lose that credit.`))
                      actions.setChecklist(state.checklist.filter((x) => x.id !== c.id))
                  }}
                  aria-label="Delete standard"
                >
                  <IconTrash style={{ width: 16, height: 16 }} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div
          style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: 13, borderTop: '1px solid var(--hairline)' }}
        >
          <input
            className="input"
            style={{ flex: '1 1 160px' }}
            placeholder="Add a standard"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <select
            className="input"
            style={{ width: 120, flex: 'none' }}
            value={pillar}
            onChange={(e) => setPillar(e.target.value as PillarId)}
          >
            {PILLAR_OPTIONS.map((p) => (
              <option key={p} value={p}>
                {PILLARS.find((x) => x.id === p)?.label}
              </option>
            ))}
          </select>
          <button className="btn" onClick={add} disabled={!label.trim()} aria-label="Add standard">
            <IconPlus style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        {PILLARS.map((p) => `${p.label} ${totalByPillar(p.id)}`).join(' · ')} — the score is
        normalised to 100 regardless of what this adds up to, so reweighting never breaks it.
        "Tied to" links a standard to a number you log elsewhere (like sleep hours) instead of a
        manual tick.
      </p>
    </>
  )
}

// -------------------------------------------------------------- tracker editor

const TRACKER_KIND_LABEL: Record<TrackerKind, string> = {
  check: 'Check',
  number: 'Number',
  rating: 'Rating /10',
  time: 'Time',
  text: 'Text',
}

/**
 * Everything watched on the daily tracker sheet — wake time, diet, cash
 * collected, whatever — lives here as data, not code, so a field that
 * doesn't earn its place (like the old "cash in bank" one) can just be
 * deleted instead of asked for a code change.
 */
function TrackerEditor() {
  const state = useStore()
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<TrackerKind>('check')

  const update = (id: string, patch: Partial<Tracker>) => {
    actions.setTrackers(state.trackers.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }

  const add = () => {
    if (!label.trim()) return
    const t: Tracker = {
      id: uid(),
      label: label.trim(),
      kind,
      unit: kind === 'number' ? '' : '',
      target: kind === 'rating' ? 7 : kind === 'time' ? 0 : 1,
      direction: 'atLeast',
      group: '',
      archived: false,
    }
    actions.setTrackers([...state.trackers, t])
    setLabel('')
    setKind('check')
  }

  const active = state.trackers.filter((t) => !t.archived)

  return (
    <>
      <SectionTitle
        title="Trackers"
        action={<span className="t-foot muted">{active.length} active</span>}
      />
      <Card>
        {state.trackers.length === 0 ? (
          <Empty>Nothing tracked. Add whatever you actually watch day to day.</Empty>
        ) : (
          <div className="rows">
            {state.trackers.map((t) => (
              <div
                key={t.id}
                className="row"
                style={{ flexWrap: 'wrap', gap: 8, opacity: t.archived ? 0.5 : 1 }}
              >
                <input
                  className="input input-plain"
                  style={{ flex: '1 1 140px' }}
                  value={t.label}
                  onChange={(e) => update(t.id, { label: e.target.value })}
                />
                <input
                  className="input"
                  style={{ width: 100, flex: 'none' }}
                  placeholder="Group"
                  value={t.group}
                  onChange={(e) => update(t.id, { group: e.target.value })}
                />
                <select
                  className="input"
                  style={{ width: 110, flex: 'none' }}
                  value={t.kind}
                  onChange={(e) => update(t.id, { kind: e.target.value as TrackerKind })}
                >
                  {(Object.keys(TRACKER_KIND_LABEL) as TrackerKind[]).map((k) => (
                    <option key={k} value={k}>
                      {TRACKER_KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
                {(t.kind === 'number' || t.kind === 'rating' || t.kind === 'time') && (
                  <input
                    className="input"
                    type="number"
                    style={{ width: 76, flex: 'none' }}
                    placeholder="Target"
                    value={t.target}
                    onChange={(e) => update(t.id, { target: Number(e.target.value) || 0 })}
                  />
                )}
                {t.kind === 'number' && (
                  <input
                    className="input"
                    style={{ width: 60, flex: 'none' }}
                    placeholder="Unit"
                    value={t.unit}
                    onChange={(e) => update(t.id, { unit: e.target.value })}
                  />
                )}
                {t.kind !== 'check' && t.kind !== 'text' && (
                  <select
                    className="input"
                    style={{ width: 96, flex: 'none' }}
                    value={t.direction}
                    onChange={(e) =>
                      update(t.id, { direction: e.target.value as 'atLeast' | 'atMost' })
                    }
                  >
                    <option value="atLeast">At least</option>
                    <option value="atMost">At most</option>
                  </select>
                )}
                <button
                  className="btn btn-quiet btn-sm"
                  onClick={() => update(t.id, { archived: !t.archived })}
                >
                  {t.archived ? 'Restore' : 'Archive'}
                </button>
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => {
                    if (confirm(`Delete "${t.label}"? Days already logged against it lose that value.`))
                      actions.setTrackers(state.trackers.filter((x) => x.id !== t.id))
                  }}
                  aria-label="Delete tracker"
                >
                  <IconTrash style={{ width: 16, height: 16 }} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            padding: 13,
            borderTop: '1px solid var(--hairline)',
          }}
        >
          <input
            className="input"
            style={{ flex: '1 1 160px' }}
            placeholder="Add a tracker"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <select
            className="input"
            style={{ width: 110, flex: 'none' }}
            value={kind}
            onChange={(e) => setKind(e.target.value as TrackerKind)}
          >
            {(Object.keys(TRACKER_KIND_LABEL) as TrackerKind[]).map((k) => (
              <option key={k} value={k}>
                {TRACKER_KIND_LABEL[k]}
              </option>
            ))}
          </select>
          <button className="btn" onClick={add} disabled={!label.trim()} aria-label="Add tracker">
            <IconPlus style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Archiving keeps a tracker out of the daily sheet without erasing what's already logged
        against it. Deleting removes that history too.
      </p>
    </>
  )
}

// -------------------------------------------------------------- reward editor

/** What's waiting on the other side of the payout target, in Money. */
function RewardEditor() {
  const state = useStore()
  const [label, setLabel] = useState('')

  const update = (id: string, patch: { label?: string; detail?: string }) => {
    actions.setRewards(state.rewards.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  const add = () => {
    if (!label.trim()) return
    actions.setRewards([...state.rewards, { id: uid(), label: label.trim(), detail: '' }])
    setLabel('')
  }

  return (
    <>
      <SectionTitle title="Rewards" />
      <Card>
        {state.rewards.length === 0 ? (
          <Empty>Nothing set. What's actually waiting on the other side of the target?</Empty>
        ) : (
          <div className="rows">
            {state.rewards.map((r) => (
              <div key={r.id} className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <input
                  className="input input-plain"
                  style={{ flex: '1 1 140px' }}
                  value={r.label}
                  onChange={(e) => update(r.id, { label: e.target.value })}
                />
                <input
                  className="input"
                  style={{ flex: '2 1 180px' }}
                  placeholder="Detail"
                  value={r.detail}
                  onChange={(e) => update(r.id, { detail: e.target.value })}
                />
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => actions.setRewards(state.rewards.filter((x) => x.id !== r.id))}
                  aria-label="Delete reward"
                >
                  <IconTrash style={{ width: 16, height: 16 }} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div
          style={{ display: 'flex', gap: 8, padding: 13, borderTop: '1px solid var(--hairline)' }}
        >
          <input
            className="input"
            placeholder="Add a reward"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn" onClick={add} disabled={!label.trim()} aria-label="Add reward">
            <IconPlus style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Unlocks together, against the personal payout target above.
      </p>
    </>
  )
}

// ------------------------------------------------------------- morning editor

/**
 * The morning SOP and its clock times. Today shows the same list grouped by
 * time and checks it off; this is the one-row-per-step view for editing it.
 * Rows settle into time order when a time field is left.
 */
function MorningEditor() {
  const state = useStore()
  const items = state.morningRitual
  const [draft, setDraft] = useState('')
  const [at, setAt] = useState('')

  const add = () => {
    if (!draft.trim()) return
    actions.addMorningItem(draft.trim(), at)
    setDraft('')
  }

  return (
    <>
      <SectionTitle title="Morning" />
      <Card>
        {items.length === 0 ? (
          <Empty>Nothing set yet. Add the first step of the morning below.</Empty>
        ) : (
          <div className="rows">
            {items.map((item) => (
              <div className="row" key={item.id}>
                <input
                  type="time"
                  className="input input-plain sop-time"
                  value={item.at ?? ''}
                  aria-label={`Time for ${item.label}`}
                  onChange={(e) =>
                    actions.setMorningRitual(
                      items.map((i) => (i.id === item.id ? { ...i, at: e.target.value || undefined } : i)),
                    )
                  }
                  onBlur={() => actions.setMorningRitual(byTime(state.morningRitual))}
                />
                <input
                  className="input input-plain"
                  style={{ flex: 1, minWidth: 0 }}
                  value={item.label}
                  onChange={(e) =>
                    actions.setMorningRitual(
                      items.map((i) => (i.id === item.id ? { ...i, label: e.target.value } : i)),
                    )
                  }
                />
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => actions.removeMorningItem(item.id)}
                  aria-label="Remove"
                >
                  <IconTrash style={{ width: 16, height: 16 }} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: 13,
            borderTop: items.length ? '1px solid var(--hairline)' : 'none',
          }}
        >
          <input
            type="time"
            className="input input-time"
            value={at}
            aria-label="Time for the new step"
            onChange={(e) => setAt(e.target.value)}
          />
          <input
            className="input"
            style={{ flex: 1, minWidth: 0 }}
            placeholder="Add a step"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn" onClick={add} disabled={!draft.trim()} aria-label="Add">
            <IconPlus style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Checked off every morning on Today, grouped by time.
      </p>
    </>
  )
}
