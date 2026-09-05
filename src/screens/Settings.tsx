import { useRef, useState } from 'react'
import { Card, Empty, Field, NumberField, SectionTitle, Segmented } from '../components/ui'
import SyncCard from '../components/SyncCard'
import { useSync } from '../lib/sync'
import { METRICS, PROTOCOL_DAYS } from '../lib/config'
import { IconPlus, IconTrash } from '../components/icons'
import { uid } from '../lib/format'
import { formatWithYear, isoForDay } from '../lib/date'
import { euroCompact } from '../lib/format'
import { actions, exportJSON, useStore } from '../lib/store'
import type { AppState, Targets, Theme } from '../lib/types'

export default function Settings() {
  const state = useStore()
  const sync = useSync()
  const fileRef = useRef<HTMLInputElement>(null)
  const [note, setNote] = useState('')

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
        <p className="t-foot" style={{ marginTop: 10 }}>
          Day {PROTOCOL_DAYS} lands on{' '}
          <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
            {formatWithYear(isoForDay(state.startDate, PROTOCOL_DAYS))}
          </strong>
          .
        </p>
      </Card>

      <SectionTitle title="Financial targets" />
      <Card className="card-pad">
        <div className="stack" style={{ display: 'grid', gap: 14 }}>
          <NumberField
            label={`ACMR bonus pool — currently ${euroCompact(state.targets.bonusPool)}`}
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

      <SectionTitle title="Daily targets" />
      <Card>
        <div className="rows">
          {METRICS.map((m) => (
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

      <Loops />

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
                if (actions.seedDemo()) flash('Sample weeks added — export or reset any time.')
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

// --------------------------------------------------------------------- loops

/**
 * The loop list is the one piece of config that has to be personal — a generic
 * failure pattern never gets ticked, and an untagged loop is invisible to the
 * pattern engine. Archiving rather than deleting keeps the history readable.
 */
function Loops() {
  const state = useStore()
  const [label, setLabel] = useState('')

  const add = () => {
    if (!label.trim()) return
    actions.setLoops([
      ...state.loops,
      { id: uid(), label: label.trim(), note: '', archived: false },
    ])
    setLabel('')
  }

  const active = state.loops.filter((l) => !l.archived)

  return (
    <>
      <SectionTitle
        title="Loops"
        action={<span className="t-foot muted">{active.length} active</span>}
      />
      <Card>
        {state.loops.length === 0 ? (
          <Empty>No loops. Add the patterns you actually run.</Empty>
        ) : (
          <div className="rows">
            {state.loops.map((l) => (
              <div className="row" key={l.id}>
                <span className="row-main">
                  <span className="row-title" style={{ opacity: l.archived ? 0.5 : 1 }}>
                    {l.label}
                  </span>
                  <span className="row-sub">{l.archived ? 'Archived' : l.note || 'Active'}</span>
                </span>
                <button
                  className="btn btn-quiet btn-sm"
                  onClick={() => actions.setLoops(
                    state.loops.map((x) => (x.id === l.id ? { ...x, archived: !x.archived } : x)),
                  )}
                >
                  {l.archived ? 'Restore' : 'Archive'}
                </button>
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => {
                    if (confirm(`Delete "${l.label}"? Days already tagged with it lose that tag.`))
                      actions.setLoops(state.loops.filter((x) => x.id !== l.id))
                  }}
                  aria-label="Delete loop"
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
            placeholder="Add a loop you actually run"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button className="btn" onClick={add} disabled={!label.trim()} aria-label="Add loop">
            <IconPlus style={{ width: 16, height: 16 }} />
          </button>
        </div>
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Archiving keeps a loop out of the nightly list without erasing the days it already
        explains. Deleting removes it from those days too.
      </p>
    </>
  )
}
