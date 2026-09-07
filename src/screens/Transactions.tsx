import { useMemo, useRef, useState } from 'react'
import { Card, Empty, Meter, SectionTitle, Segmented, Stat } from '../components/ui'
import { IconTrash, IconWarn } from '../components/icons'
import { ACCOUNT_LABEL, MONTH_LABEL } from '../lib/config'
import { formatShort, todayISO } from '../lib/date'
import { euro, euroCompact, uid } from '../lib/format'
import { parseBankCsv } from '../lib/importBank'
import { actions, useStore } from '../lib/store'
import { monthSpend, transactionMonths, transactionsInMonth } from '../lib/selectors'
import type { AccountId, TxCategory } from '../lib/types'

const CATS: { id: TxCategory; label: string }[] = [
  { id: '', label: 'Uncategorised' },
  { id: 'personal', label: 'Personal' },
  { id: 'consulting', label: 'Consulting.ie' },
  { id: 'onemedia', label: '1Media' },
]

/**
 * The transaction log. Import a bank export, filter it by month, and tag each
 * line as personal or one of the two businesses. Nothing here is inferred —
 * every category is a decision you make, once, per line.
 */
export default function Transactions() {
  const state = useStore()
  const months = useMemo(() => transactionMonths(state), [state])
  const [month, setMonth] = useState(months[0] ?? todayISO().slice(0, 7))

  // A fresh import can add months that didn't exist when this screen first
  // mounted — without this, the picker keeps pointing at whatever was
  // selected (often today's empty month) instead of jumping to the data that
  // just arrived.
  const prevMonths = useRef(months)
  if (months.length > 0 && !months.includes(month) && prevMonths.current !== months) {
    setMonth(months[0])
  }
  prevMonths.current = months
  const [filter, setFilter] = useState<'all' | TxCategory>('all')
  const [importing, setImporting] = useState(false)

  const spend = useMemo(() => monthSpend(state, month), [state, month])
  const rows = useMemo(
    () => transactionsInMonth(state, month, filter === 'all' ? undefined : filter),
    [state, month, filter],
  )

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            Where it actually goes
          </span>
        </div>
        <h1 className="t-large">Transactions</h1>
        <p className="t-sub">
          Import a statement, filter by month, and tag each line as personal or a business.
          Nothing here is guessed — every tag is a decision you make.
        </p>
      </header>

      {state.transactions.length === 0 ? (
        <Card>
          <Empty>
            Nothing imported yet. Export a CSV from your bank and bring it in below — works for
            Consulting.ie, 1Media or personal, one file at a time.
          </Empty>
          <div style={{ padding: '0 14px 14px' }}>
            <button className="btn btn-primary btn-block" onClick={() => setImporting(true)}>
              Import a statement
            </button>
          </div>
        </Card>
      ) : (
        <>
          <div className="board-bar">
            <select className="input" style={{ maxWidth: 200 }} value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m} value={m}>
                  {MONTH_LABEL[Number(m.slice(5, 7)) - 1]} {m.slice(0, 4)}
                </option>
              ))}
            </select>
            <button className="btn btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setImporting(true)}>
              Import
            </button>
          </div>

          <div className="grid-3">
            <Stat label="Out" value={euroCompact(spend.out)} />
            <Stat label="In" value={euroCompact(spend.in)} />
            <Stat
              label="Uncategorised"
              value={String(spend.uncategorisedCount)}
              accent={spend.uncategorisedCount > 0 ? 'var(--warning)' : undefined}
            />
          </div>

          <SectionTitle title="Split, this month" />
          <Card className="card-pad">
            {(['personal', 'consulting', 'onemedia', 'uncategorised'] as const).map((k) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span className="dim">
                    {k === 'consulting' ? 'Consulting.ie' : k === 'onemedia' ? '1Media' : k === 'personal' ? 'Personal' : 'Uncategorised'}
                  </span>
                  <span className="t-num muted">{euro(spend.byCategory[k])}</span>
                </div>
                <Meter pct={spend.out ? (spend.byCategory[k] / spend.out) * 100 : 0} />
              </div>
            ))}
          </Card>

          <div style={{ margin: '18px 0 12px' }}>
            <Segmented
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'All' },
                { value: '', label: `Uncategorised · ${spend.uncategorisedCount}` },
                { value: 'personal', label: 'Personal' },
                { value: 'consulting', label: 'Consulting.ie' },
                { value: 'onemedia', label: '1Media' },
              ]}
            />
          </div>

          <SectionTitle title={`${rows.length} transaction${rows.length === 1 ? '' : 's'}`} />
          <Card>
            {rows.length === 0 ? (
              <Empty>Nothing here.</Empty>
            ) : (
              <div className="rows">
                {rows.map((t) => (
                  <div className="row row-metric" key={t.id}>
                    <span className="row-main" style={{ flex: '1 1 200px' }}>
                      <span className="row-title">{t.description}</span>
                      <span className="row-sub">
                        {formatShort(t.date)}
                        {t.account && ` · ${ACCOUNT_LABEL[t.account]}`}
                      </span>
                    </span>
                    <span
                      className="row-value"
                      style={{ color: t.amount < 0 ? undefined : 'var(--won)' }}
                    >
                      {t.amount < 0 ? '-' : '+'}
                      {euro(Math.abs(t.amount))}
                    </span>
                    <select
                      className="input"
                      style={{ width: 132, flex: 'none' }}
                      value={t.category}
                      onChange={(e) =>
                        actions.categoriseTransaction(t.id, e.target.value as TxCategory)
                      }
                    >
                      {CATS.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-quiet btn-danger"
                      onClick={() => actions.removeTransaction(t.id)}
                      aria-label="Remove"
                    >
                      <IconTrash style={{ width: 15, height: 15 }} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {importing && <ImportSheet onClose={() => setImporting(false)} />}
    </div>
  )
}

function ImportSheet({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState('')
  const [account, setAccount] = useState<AccountId | ''>('')
  const [result, setResult] = useState<{ added: number; skipped: number; error?: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const run = () => {
    const parsed = parseBankCsv(text)
    if (parsed.error) {
      setResult({ added: 0, skipped: 0, error: parsed.error })
      return
    }
    const batch = `import-${uid()}`
    const added = actions.importTransactions(
      parsed.rows.map((r) => ({ ...r, account })),
      batch,
    )
    setResult({ added, skipped: parsed.skipped })
  }

  return (
    <div className="scrim" onClick={onClose} role="presentation">
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="sheet-grip" />
        <div className="card-pad" style={{ display: 'grid', gap: 14 }}>
          <div className="t-head">Import a statement</div>
          <p className="t-foot muted">
            Export a CSV from your bank — Revolut, AIB and Rev all offer one — and paste it
            below, or upload the file. A PDF won't parse reliably; CSV is the one that will.
          </p>

          <div>
            <label className="field-label t-cap" style={{ display: 'block', marginBottom: 6 }}>
              Which account is this?
            </label>
            <select
              className="input"
              value={account}
              onChange={(e) => setAccount(e.target.value as AccountId | '')}
            >
              <option value="">Don't tag an account</option>
              {Object.entries(ACCOUNT_LABEL)
                .filter(([id]) => id !== 'netWorth')
                .map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
            </select>
          </div>

          <textarea
            className="input"
            style={{ minHeight: 160, fontFamily: 'monospace', fontSize: 13 }}
            placeholder={'Date,Description,Amount\n2026-01-05,ALDI,-12.40\n2026-01-06,Salary,2000.00'}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              Choose a CSV file
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) f.text().then(setText)
                e.target.value = ''
              }}
            />
          </div>

          {result?.error && (
            <p className="t-foot" style={{ color: 'var(--warning)' }}>
              <IconWarn style={{ width: 12, height: 12, marginRight: 4 }} />
              {result.error}
            </p>
          )}
          {result && !result.error && (
            <p className="t-foot" style={{ color: 'var(--won)' }}>
              Imported {result.added}. {result.skipped > 0 && `${result.skipped} rows skipped.`}
            </p>
          )}

          <button className="btn btn-primary btn-block" onClick={run} disabled={!text.trim()}>
            Import
          </button>
          <button className="btn btn-block" onClick={onClose}>
            Done
          </button>

          <p className="t-foot muted">
            Everything imported here stays on your device (and syncs only to your own account,
            if sync is on). It never passes through anything else.
          </p>
        </div>
      </div>
    </div>
  )
}
