import { useRef, useState } from 'react'
import { Card, Empty, Field, NumberField, SectionTitle, Segmented } from '../components/ui'
import { IconPlus, IconTrash } from '../components/icons'
import SyncCard from '../components/SyncCard'
import { useSync } from '../lib/sync'
import { METRICS } from '../lib/config'
import { uid } from '../lib/format'
import { formatWithYear, isoForDay } from '../lib/date'
import { euroCompact } from '../lib/format'
import { actions, exportJSON, useStore } from '../lib/store'
import type { AppState, Targets, Theme } from '../lib/types'

/** The targets Today reads: sleep, water, food, and hours in the office. */
const TODAY_TARGETS = new Set(['sleepHours', 'waterL', 'calories', 'protein', 'consultingHours'])

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

      {/* Only the numbers Today actually shows a target for. */}
      <SectionTitle title="Daily targets" />
      <Card>
        <div className="rows">
          {METRICS.filter((m) => TODAY_TARGETS.has(m.key)).map((m) => (
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
