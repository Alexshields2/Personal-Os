import { useState } from 'react'
import {
  Card,
  Empty,
  Field,
  Meter,
  NumberField,
  SectionTitle,
  Segmented,
  Sheet,
  Stat,
  TextField,
} from '../components/ui'
import { BalanceChart } from '../components/charts'
import type { Series } from '../components/charts'
import { IconLock, IconPlus, IconTrash, IconUnlock } from '../components/icons'
import { ACCOUNT_LABEL, ENTITY_LABEL, KIND_LABEL } from '../lib/config'
import { formatShort, todayISO } from '../lib/date'
import { euro, euroCompact, pct, uid } from '../lib/format'
import { actions, useStore } from '../lib/store'
import {
  accountBalance,
  accountHistory,
  businessTotal,
  entityTotals,
  rewardsUnlocked,
} from '../lib/selectors'
import { BANK_ACCOUNTS } from '../lib/types'
import type { AccountId, LedgerKind, MoneyEntity } from '../lib/types'

/**
 * Three categorical slots, validated all-pairs for colour-blind separation on
 * this surface. Net worth deliberately isn't one of them — it gets its own
 * single-series chart rather than a fourth hue that would break the set.
 */
const SERIES_COLOR: Record<string, string> = {
  acmrBank: 'var(--series-acmr)',
  onemediaBank: 'var(--series-1media)',
  personalBank: 'var(--series-personal)',
}

export default function Money() {
  const state = useStore()
  const [entity, setEntity] = useState<MoneyEntity | 'all'>('all')
  const [addLedger, setAddLedger] = useState(false)
  const [addBalance, setAddBalance] = useState(false)

  const acmrBank = accountBalance(state, 'acmrBank')
  const onemediaBank = accountBalance(state, 'onemediaBank')
  const personalBank = accountBalance(state, 'personalBank')
  const unlocked = rewardsUnlocked(state)

  const acmr = entityTotals(state, 'acmr')
  const media = entityTotals(state, 'onemedia')
  const shown =
    entity === 'all'
      ? {
          revenue: acmr.revenue + media.revenue,
          cashCollected: acmr.cashCollected + media.cashCollected,
          profit: acmr.profit + media.profit,
          payout: acmr.payout + media.payout,
        }
      : entity === 'acmr'
        ? acmr
        : media

  const series: Series[] = BANK_ACCOUNTS.map((a) => ({
    id: a,
    label: ACCOUNT_LABEL[a],
    color: SERIES_COLOR[a],
    points: accountHistory(state, a),
  }))

  const netWorth = accountBalance(state, 'netWorth')
  const netWorthSeries: Series[] = [
    {
      id: 'netWorth',
      label: ACCOUNT_LABEL.netWorth,
      color: 'var(--accent)',
      points: accountHistory(state, 'netWorth'),
    },
  ]

  const ledger = state.ledger
    .filter((e) => entity === 'all' || e.entity === entity)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            Financial scoreboard
          </span>
        </div>
        <h1 className="t-large">Money</h1>
        <p className="t-sub">Sales → revenue → margin → profit → cash → payout.</p>
      </header>

      {/* Hero: the one number the whole protocol points at. */}
      <Card className="card-pad">
        <div className="t-cap">ACMR in bank</div>
        <div className="hero" style={{ margin: '8px 0 4px' }}>
          {euroCompact(acmrBank)}
        </div>
        <div className="t-foot" style={{ marginBottom: 12 }}>
          {euro(acmrBank)} of {euroCompact(state.targets.bonusPool)} target ·{' '}
          {pct(acmrBank, state.targets.bonusPool).toFixed(1)}%
        </div>
        <Meter pct={pct(acmrBank, state.targets.bonusPool)} color="var(--series-acmr)" />
      </Card>

      <div className="grid-3" style={{ marginTop: 14 }}>
        <Stat label="1Media bank" value={euroCompact(onemediaBank)} sub={euro(onemediaBank)} />
        <Stat
          label="Business total"
          value={euroCompact(businessTotal(state))}
          sub="ACMR + 1Media"
        />
        <Stat label="Personal bank" value={euroCompact(personalBank)} sub={euro(personalBank)} />
        <Stat label="Net worth" value={euroCompact(netWorth)} sub={euro(netWorth)} />
      </div>

      <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
        <button className="btn btn-block" onClick={() => setAddBalance(true)}>
          <IconPlus style={{ width: 16, height: 16 }} />
          Update balances
        </button>
        <button className="btn btn-block" onClick={() => setAddLedger(true)}>
          <IconPlus style={{ width: 16, height: 16 }} />
          Log money
        </button>
      </div>

      <SectionTitle title="Balances over time" />
      <Card className="card-pad">
        <BalanceChart series={series} />
      </Card>

      <SectionTitle title="Net worth" />
      <Card className="card-pad">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <span className="t-title">{euro(netWorth)}</span>
          <span className="t-foot muted">of {euroCompact(state.targets.netWorth)}</span>
        </div>
        <Meter pct={pct(netWorth, state.targets.netWorth)} />
        <p className="t-foot muted" style={{ margin: '10px 0 14px' }}>
          Everything you own less what you owe — property and investments included, so it
          isn't the three accounts added up. Set it in Update balances.
        </p>
        <BalanceChart series={netWorthSeries} />
      </Card>

      <SectionTitle title="Personal payout" />
      <Card className="card-pad">
        <div className="t-foot" style={{ marginBottom: 10 }}>
          Money actually received — not projected, not invoiced.
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
          <span className="t-title">{euro(state.payoutReceived)}</span>
          <span className="t-foot muted">of {euroCompact(state.targets.personalPayout)}</span>
        </div>
        <Meter
          pct={pct(state.payoutReceived, state.targets.personalPayout)}
          color="var(--series-personal)"
        />
        <div style={{ marginTop: 14 }}>
          <NumberField
            label="Payout received to date (€)"
            value={state.payoutReceived}
            onChange={(v) => actions.setPayoutReceived(v)}
            placeholder="0"
          />
        </div>
      </Card>

      <SectionTitle title="Rewards" />
      <div className="stack">
        {state.rewards.map((r) => (
          <div className="vault" key={r.id} data-locked={!unlocked}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ color: unlocked ? 'var(--accent)' : 'var(--text-muted)' }}>
                {unlocked ? (
                  <IconUnlock style={{ width: 20, height: 20 }} />
                ) : (
                  <IconLock style={{ width: 20, height: 20 }} />
                )}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="t-head vault-title">{r.label}</div>
                <div className="row-sub">{r.detail}</div>
              </div>
              <span className="pill">{unlocked ? 'Unlocked' : 'Locked'}</span>
            </div>
          </div>
        ))}
        {!unlocked && (
          <p className="t-foot muted" style={{ padding: '2px 4px' }}>
            {euro(state.targets.personalPayout - state.payoutReceived)} still to land. No €1M
            payout, neither gets bought.
          </p>
        )}
      </div>

      <SectionTitle title="Money made" />
      <div style={{ marginBottom: 12 }}>
        <Segmented
          value={entity}
          onChange={setEntity}
          options={[
            { value: 'all', label: 'Both' },
            { value: 'acmr', label: 'ACMR' },
            { value: 'onemedia', label: '1Media' },
          ]}
        />
      </div>
      <div className="grid-2">
        <Stat label="Revenue" value={euroCompact(shown.revenue)} sub={euro(shown.revenue)} />
        <Stat
          label="Cash collected"
          value={euroCompact(shown.cashCollected)}
          sub={euro(shown.cashCollected)}
        />
        <Stat label="Profit" value={euroCompact(shown.profit)} sub={euro(shown.profit)} />
        <Stat label="Paid to me" value={euroCompact(shown.payout)} sub={euro(shown.payout)} />
      </div>

      <SectionTitle title="Ledger" />
      <Card>
        {ledger.length === 0 ? (
          <Empty>Nothing logged yet.</Empty>
        ) : (
          <div className="rows">
            {ledger.map((e) => (
              <div className="row" key={e.id}>
                <span
                  className="dot"
                  style={{
                    background:
                      e.entity === 'acmr' ? 'var(--series-acmr)' : 'var(--series-1media)',
                  }}
                />
                <span className="row-main">
                  <span className="row-title">
                    {KIND_LABEL[e.kind]}
                    <span className="muted"> · {ENTITY_LABEL[e.entity]}</span>
                  </span>
                  <span className="row-sub">
                    {formatShort(e.date)}
                    {e.note && ` · ${e.note}`}
                  </span>
                </span>
                <span className="row-value">{euro(e.amount)}</span>
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => actions.removeLedger(e.id)}
                  aria-label="Delete entry"
                >
                  <IconTrash style={{ width: 16, height: 16 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {addLedger && <LedgerSheet onClose={() => setAddLedger(false)} />}
      {addBalance && <BalanceSheet onClose={() => setAddBalance(false)} />}
    </div>
  )
}

function LedgerSheet({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(todayISO())
  const [entity, setEntity] = useState<MoneyEntity>('acmr')
  const [kind, setKind] = useState<LedgerKind>('revenue')
  const [amount, setAmount] = useState(0)
  const [note, setNote] = useState('')

  const save = () => {
    if (amount > 0) {
      actions.addLedger({ id: uid(), date, entity, kind, amount, note: note.trim() })
    }
    onClose()
  }

  return (
    <Sheet title="Log money" onClose={onClose}>
      <Field label="Business">
        <Segmented
          value={entity}
          onChange={setEntity}
          options={[
            { value: 'acmr', label: 'ACMR' },
            { value: 'onemedia', label: '1Media' },
          ]}
        />
      </Field>
      <Field label="Type">
        <Segmented
          value={kind}
          onChange={setKind}
          options={[
            { value: 'revenue', label: 'Revenue' },
            { value: 'cashCollected', label: 'Cash' },
            { value: 'profit', label: 'Profit' },
            { value: 'payout', label: 'Payout' },
          ]}
        />
      </Field>
      <NumberField label="Amount (€)" value={amount} onChange={setAmount} placeholder="0" />
      <Field label="Date">
        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      <TextField label="Note" value={note} onChange={setNote} placeholder="Client, deal, source" />
      <button className="btn btn-primary btn-block" onClick={save} disabled={amount <= 0}>
        Save entry
      </button>
    </Sheet>
  )
}

function BalanceSheet({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const [date, setDate] = useState(todayISO())
  const [values, setValues] = useState<Record<AccountId, number>>({
    acmrBank: accountBalance(state, 'acmrBank'),
    onemediaBank: accountBalance(state, 'onemediaBank'),
    personalBank: accountBalance(state, 'personalBank'),
    netWorth: accountBalance(state, 'netWorth'),
  })

  const save = () => {
    for (const account of Object.keys(values) as AccountId[]) {
      actions.addBalance({ id: uid(), date, account, amount: values[account] })
    }
    onClose()
  }

  return (
    <Sheet title="Update balances" onClose={onClose}>
      <Field label="Date">
        <input
          className="input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </Field>
      {(Object.keys(values) as AccountId[]).map((a) => (
        <NumberField
          key={a}
          label={`${ACCOUNT_LABEL[a]} (€)`}
          value={values[a]}
          onChange={(v) => setValues((s) => ({ ...s, [a]: v }))}
          placeholder="0"
        />
      ))}
      <p className="t-foot muted">
        One reading per account per day — saving again on the same date replaces it.
      </p>
      <button className="btn btn-primary btn-block" onClick={save}>
        Save balances
      </button>
    </Sheet>
  )
}
