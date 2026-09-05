import { useState } from 'react'
import Finance from './Finance'
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
import { ACCOUNT_LABEL, ENTITY_LABEL, KIND_LABEL, MONTH_LABEL } from '../lib/config'
import { formatShort, todayISO } from '../lib/date'
import { euro, euroCompact, pct, uid } from '../lib/format'
import { actions, useStore } from '../lib/store'
import {
  accountBalance,
  accountHistory,
  businessTotal,
  entityTotals,
  clientBook,
  rewardsUnlocked,
  yearToDate,
} from '../lib/selectors'
import { BANK_ACCOUNTS } from '../lib/types'
import type { AccountId, LedgerKind, MoneyEntity } from '../lib/types'

/**
 * Three categorical slots. The palette is monochrome, so each one carries a
 * luminance step *and* a dash pattern — three greys alone would not hold apart
 * at line weight, and the dash keeps working in print and for anyone who can't
 * separate the greys. Net worth deliberately isn't one of them: it gets its own
 * single-series chart rather than a fourth slot that would break the set.
 */
const SERIES_STYLE: Record<string, { color: string; dash?: string }> = {
  consultingBank: { color: 'var(--series-consulting)' },
  onemediaBank: { color: 'var(--series-1media)', dash: '10 7' },
  personalBank: { color: 'var(--series-personal)', dash: '2.5 6' },
}

export default function Money() {
  const [section, setSection] = useState<'accounts' | 'depth'>('accounts')
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

      <Segmented
        value={section}
        onChange={setSection}
        options={[
          { value: 'accounts', label: 'Accounts & ledger' },
          { value: 'depth', label: 'Bills, sheet, invoices' },
        ]}
      />

      {section === 'accounts' ? <Accounts /> : <Finance />}
    </div>
  )
}

function Accounts() {
  const state = useStore()
  const [entity, setEntity] = useState<MoneyEntity | 'all'>('all')
  const [addLedger, setAddLedger] = useState(false)
  const [addBalance, setAddBalance] = useState(false)

  const consultingBank = accountBalance(state, 'consultingBank')
  const onemediaBank = accountBalance(state, 'onemediaBank')
  const personalBank = accountBalance(state, 'personalBank')
  const unlocked = rewardsUnlocked(state)

  const consulting = entityTotals(state, 'consulting')
  const media = entityTotals(state, 'onemedia')
  const shown =
    entity === 'all'
      ? {
          revenue: consulting.revenue + media.revenue,
          cashCollected: consulting.cashCollected + media.cashCollected,
          profit: consulting.profit + media.profit,
          payout: consulting.payout + media.payout,
        }
      : entity === 'consulting'
        ? consulting
        : media

  const series: Series[] = BANK_ACCOUNTS.map((a) => ({
    id: a,
    label: ACCOUNT_LABEL[a],
    ...SERIES_STYLE[a],
    points: accountHistory(state, a),
  }))

  const ytdAll = yearToDate(state, undefined)
  const ytdConsulting = yearToDate(state, 'consulting')
  const ytdMedia = yearToDate(state, 'onemedia')
  const bookConsulting = clientBook(state, 'consulting')
  const bookMedia = clientBook(state, 'onemedia')

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
    <>
      {/* Hero: the one number the whole protocol points at. */}
      <Card className="card-pad">
        <div className="t-cap">Consulting.ie in bank</div>
        <div className="hero" style={{ margin: '8px 0 4px' }}>
          {euroCompact(consultingBank)}
        </div>
        <div className="t-foot" style={{ marginBottom: 12 }}>
          {euro(consultingBank)} of {euroCompact(state.targets.bonusPool)} target ·{' '}
          {pct(consultingBank, state.targets.bonusPool).toFixed(1)}%
        </div>
        <Meter pct={pct(consultingBank, state.targets.bonusPool)} color="var(--series-consulting)" />
      </Card>

      <SectionTitle title={`${ytdAll.year} so far`} />
      <Card>
        {[
          { label: 'Consulting.ie', ytd: ytdConsulting, mrr: bookConsulting.mrr, clients: bookConsulting.active.length },
          { label: '1Media', ytd: ytdMedia, mrr: bookMedia.mrr, clients: bookMedia.active.length },
        ].map((row) => (
          <div className="insight" key={row.label}>
            <div className="insight-head">
              <span className="insight-title">{row.label}</span>
              <span className="t-num">{euroCompact(row.ytd.revenue)}</span>
            </div>
            <Meter
              pct={ytdAll.revenue ? (row.ytd.revenue / ytdAll.revenue) * 100 : 0}
            />
            <div className="insight-body">
              {euro(row.ytd.cashCollected)} collected · {euroCompact(row.mrr)} MRR across{' '}
              {row.clients} client{row.clients === 1 ? '' : 's'}
              {row.ytd.bestMonth && row.ytd.bestMonth.amount > 0 &&
                ` · best month ${MONTH_LABEL[row.ytd.bestMonth.month]} at ${euroCompact(row.ytd.bestMonth.amount)}`}
            </div>
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: 13,
            borderTop: '1px solid var(--hairline)',
          }}
        >
          <span className="t-cap">Both, year to date</span>
          <span className="t-num">
            {euro(ytdAll.revenue)} invoiced · {euro(ytdAll.cashCollected)} collected
          </span>
        </div>
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Invoiced and collected are kept apart on purpose. Confusing the two is how a good year
        runs out of money.
      </p>

      <div className="grid-3" style={{ marginTop: 14 }}>
        <Stat label="1Media bank" value={euroCompact(onemediaBank)} sub={euro(onemediaBank)} />
        <Stat
          label="Business total"
          value={euroCompact(businessTotal(state))}
          sub="Consulting.ie + 1Media"
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
            { value: 'consulting', label: 'Consulting.ie' },
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
                      e.entity === 'consulting' ? 'var(--series-consulting)' : 'var(--series-1media)',
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
    </>
  )
}

function LedgerSheet({ onClose }: { onClose: () => void }) {
  const [date, setDate] = useState(todayISO())
  const [entity, setEntity] = useState<MoneyEntity>('consulting')
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
            { value: 'consulting', label: 'Consulting.ie' },
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
    consultingBank: accountBalance(state, 'consultingBank'),
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
