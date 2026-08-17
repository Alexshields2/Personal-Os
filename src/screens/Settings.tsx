import { useRef, useState } from 'react'
import { Card, Field, NumberField, SectionTitle } from '../components/ui'
import { METRICS, PROTOCOL_DAYS } from '../lib/config'
import { formatWithYear, isoForDay } from '../lib/date'
import { euroCompact } from '../lib/format'
import { actions, exportJSON, useStore } from '../lib/store'
import type { AppState, Targets } from '../lib/types'

export default function Settings() {
  const state = useStore()
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
    a.download = `126-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    flash('Backup downloaded.')
  }

  const importFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppState
      if (!parsed || typeof parsed !== 'object' || !('days' in parsed)) {
        flash("That file isn't a 126 backup.")
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
        <p className="t-sub">Everything stays on this device.</p>
      </header>

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

      <SectionTitle title="Your data" />
      <Card className="card-pad">
        <p className="t-foot" style={{ marginBottom: 14 }}>
          Nothing leaves this device — no account, no server, no sync. That also means
          clearing your browser data wipes it, so export a backup now and then.
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
