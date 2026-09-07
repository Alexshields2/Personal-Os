import { useMemo, useState } from 'react'
import {
  Card,
  Check,
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
import { IconTrash, IconWarn } from '../components/icons'
import {
  CADENCE_LABEL,
  HOLDING_CATEGORIES,
  INVOICE_STATUS_LABEL,
  PURSE_LABEL,
} from '../lib/config'
import { daysBetween, formatShort, todayISO } from '../lib/date'
import { euro, euroCompact, num, uid } from '../lib/format'
import { actions, useStore } from '../lib/store'
import { balanceSheet, billBook, invoiceBook, monthlyCost, runway } from '../lib/selectors'
import type {
  BillCadence,
  Holding,
  HoldingKind,
  Invoice,
  MoneyEntity,
  Purse,
} from '../lib/types'

/**
 * The parts of money that balances alone can't answer: what is leaving every
 * month, what you own against what you owe, who hasn't paid, and how long the
 * cash lasts. The last one is the only number that decides whether you can
 * afford to say no.
 */
export default function Finance() {
  const [view, setView] = useState<'bills' | 'sheet' | 'invoices'>('bills')
  return (
    <>
      <div style={{ margin: '18px 0 12px' }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'bills', label: 'Bills & runway' },
            { value: 'sheet', label: 'Balance sheet' },
            { value: 'invoices', label: 'Invoices' },
          ]}
        />
      </div>
      {view === 'bills' && <Bills />}
      {view === 'sheet' && <Sheet2 />}
      {view === 'invoices' && <Invoices />}
    </>
  )
}

// -------------------------------------------------------------------- bills

function Bills() {
  const state = useStore()
  const [purse, setPurse] = useState<Purse | 'all'>('all')
  const book = useMemo(
    () => billBook(state, purse === 'all' ? undefined : purse),
    [state, purse],
  )
  const [adding, setAdding] = useState(false)

  const purses: Purse[] = ['consulting', 'onemedia', 'personal']

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <Segmented
          value={purse}
          onChange={setPurse}
          options={[
            { value: 'all', label: 'All' },
            { value: 'consulting', label: 'Consulting.ie' },
            { value: 'onemedia', label: '1Media' },
            { value: 'personal', label: 'Personal' },
          ]}
        />
      </div>

      <div className="grid-3">
        <Stat label="Going out" value={euroCompact(book.monthly)} sub="every month" />
        <Stat label="A year of it" value={euroCompact(book.annual)} />
        <Stat
          label="Due this week"
          value={String(book.dueSoon.length)}
          accent={book.dueSoon.length ? 'var(--warning)' : undefined}
        />
      </div>

      <SectionTitle title="Runway" />
      <Card>
        {purses.map((p) => {
          const r = runway(state, p)
          return (
            <div className="insight" key={p}>
              <div className="insight-head">
                <span className="insight-title">{PURSE_LABEL[p]}</span>
                <span
                  className="t-num"
                  style={{
                    color: r.known && r.months < 3 ? 'var(--warning)' : undefined,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.known ? `${num(r.months, 1)} months` : '—'}
                </span>
              </div>
              {r.known && <Meter pct={Math.min(100, (r.months / 12) * 100)} />}
              <div className="insight-body">
                {euro(r.cash)} in the account
                {r.known
                  ? ` · ${euro(r.monthlyBurn)} going out a month`
                  : ' · no bills recorded, so there is no runway to compute'}
              </div>
            </div>
          )
        })}
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Twelve months of cover fills the bar. Runway is what lets you turn down work you
        shouldn't take.
      </p>

      {book.dueSoon.length > 0 && (
        <>
          <SectionTitle
            title="Due this week"
            action={
              <span className="pill" style={{ color: 'var(--warning)' }}>
                <IconWarn style={{ width: 12, height: 12 }} />
                {book.dueSoon.length}
              </span>
            }
          />
          <Card>
            <div className="rows">
              {book.dueSoon.map((b) => (
                <div className="row" key={b.id}>
                  <span className="row-main">
                    <span className="row-title">{b.label}</span>
                    <span className="row-sub">
                      {PURSE_LABEL[b.purse]} · {formatShort(b.nextDue)}
                    </span>
                  </span>
                  <span className="row-value">{euro(b.amount)}</span>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <SectionTitle
        title={`Recurring · ${book.bills.length}`}
        action={
          <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>
            Add
          </button>
        }
      />
      <Card>
        {book.bills.length === 0 ? (
          <Empty>
            Nothing recorded. Until there is, runway can't be computed — and runway is the
            number worth having.
          </Empty>
        ) : (
          <div className="rows">
            {[...book.bills]
              .sort((a, b) => monthlyCost(b) - monthlyCost(a))
              .map((b) => (
                <div className="row" key={b.id}>
                  <span className="row-main">
                    <span className="row-title">{b.label}</span>
                    <span className="row-sub">
                      {PURSE_LABEL[b.purse]} · {CADENCE_LABEL[b.cadence]}
                      {b.category && ` · ${b.category}`}
                      {b.cadence !== 'monthly' && ` · ${euro(monthlyCost(b))}/mo`}
                    </span>
                  </span>
                  <span className="row-value">{euro(b.amount)}</span>
                  <button
                    className="btn btn-quiet btn-danger"
                    onClick={() => actions.setBills(state.bills.filter((x) => x.id !== b.id))}
                    aria-label={`Remove ${b.label}`}
                  >
                    <IconTrash style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </Card>

      <SectionTitle title="Split" />
      <Card>
        {book.byPurse.map((p) => (
          <div className="insight" key={p.purse}>
            <div className="insight-head">
              <span className="insight-title">{p.label}</span>
              <span className="t-num muted">{euro(p.monthly)}/mo</span>
            </div>
            <Meter pct={book.monthly ? (p.monthly / book.monthly) * 100 : 0} />
          </div>
        ))}
      </Card>

      {adding && <BillSheet onClose={() => setAdding(false)} />}
    </>
  )
}

function BillSheet({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const [label, setLabel] = useState('')
  const [amount, setAmount] = useState(0)
  const [cadence, setCadence] = useState<BillCadence>('monthly')
  const [purse, setPurse] = useState<Purse>('personal')
  const [nextDue, setNextDue] = useState('')
  const [category, setCategory] = useState('')

  const save = () => {
    if (!label.trim() || amount <= 0) return
    actions.setBills([
      ...state.bills,
      { id: uid(), label: label.trim(), amount, cadence, purse, nextDue, category: category.trim() },
    ])
    onClose()
  }

  return (
    <Sheet title="Add a recurring cost" onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField label="What" value={label} onChange={setLabel} placeholder="Rent, software, salary" />
        <NumberField label="Amount (€)" value={amount} onChange={setAmount} />
        <Field label="How often">
          <Segmented
            value={cadence}
            onChange={setCadence}
            options={[
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'quarterly', label: 'Quarterly' },
              { value: 'annual', label: 'Annual' },
            ]}
          />
        </Field>
        <Field label="Whose">
          <Segmented
            value={purse}
            onChange={setPurse}
            options={[
              { value: 'consulting', label: 'Consulting.ie' },
              { value: 'onemedia', label: '1Media' },
              { value: 'personal', label: 'Personal' },
            ]}
          />
        </Field>
        <Field label="Next due">
          <input
            className="input"
            type="date"
            value={nextDue}
            onChange={(e) => setNextDue(e.target.value)}
          />
        </Field>
        <TextField label="Category" value={category} onChange={setCategory} placeholder="Optional" />
        <button
          className="btn btn-primary btn-block"
          onClick={save}
          disabled={!label.trim() || amount <= 0}
        >
          Add
        </button>
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------ balance sheet

function Sheet2() {
  const state = useStore()
  const sheet = useMemo(() => balanceSheet(state), [state])
  const [adding, setAdding] = useState<HoldingKind | null>(null)

  const assets = state.holdings.filter((h) => h.kind === 'asset')
  const liabilities = state.holdings.filter((h) => h.kind === 'liability')

  return (
    <>
      <Card className="card-pad">
        <div className="t-cap">Net worth</div>
        <div className="hero" style={{ margin: '8px 0 4px' }}>
          {euroCompact(sheet.net)}
        </div>
        <div className="t-foot muted">
          {sheet.itemised
            ? `${euro(sheet.assets)} owned less ${euro(sheet.liabilities)} owed`
            : 'From the manual snapshot in Accounts — itemise below and this calculates itself'}
        </div>
      </Card>

      {sheet.itemised && (
        <>
          <div className="grid-3" style={{ marginTop: 12 }}>
            <Stat label="Assets" value={euroCompact(sheet.assets)} />
            <Stat label="Liabilities" value={euroCompact(sheet.liabilities)} />
            <Stat
              label="Liquid"
              value={euroCompact(sheet.liquid)}
              sub="reachable this week"
            />
          </div>
          {sheet.manual > 0 && Math.abs(sheet.manual - sheet.net) > sheet.net * 0.05 && (
            <Card className="card-pad" style={{ marginTop: 12 }}>
              <div className="insight-title">
                The itemised figure and your manual snapshot disagree.
              </div>
              <div className="insight-body" style={{ marginTop: 4 }}>
                {euro(sheet.net)} here against {euro(sheet.manual)} recorded in Accounts. One of
                them is stale — the itemised one is the one this screen trusts.
              </div>
            </Card>
          )}
        </>
      )}

      <HoldingList
        title="What you own"
        kind="asset"
        holdings={assets}
        onAdd={() => setAdding('asset')}
      />
      <HoldingList
        title="What you owe"
        kind="liability"
        holdings={liabilities}
        onAdd={() => setAdding('liability')}
      />

      {adding && <HoldingSheet kind={adding} onClose={() => setAdding(null)} />}
    </>
  )
}

function HoldingList({
  title,
  kind,
  holdings,
  onAdd,
}: {
  title: string
  kind: HoldingKind
  holdings: Holding[]
  onAdd: () => void
}) {
  const state = useStore()
  const total = holdings.reduce((s, h) => s + h.value, 0)

  return (
    <>
      <SectionTitle
        title={title}
        action={
          <button className="btn btn-quiet btn-sm" onClick={onAdd}>
            Add
          </button>
        }
      />
      <Card>
        {holdings.length === 0 ? (
          <Empty>Nothing itemised.</Empty>
        ) : (
          <>
            <div className="rows">
              {[...holdings]
                .sort((a, b) => b.value - a.value)
                .map((h) => (
                  <div className="row" key={h.id}>
                    {kind === 'asset' && (
                      <button
                        onClick={() => actions.updateHolding(h.id, { liquid: !h.liquid })}
                        aria-label="Toggle liquid"
                        style={{ display: 'flex' }}
                        title="Could you reach it this week?"
                      >
                        <Check on={h.liquid} />
                      </button>
                    )}
                    <span className="row-main">
                      <span className="row-title">{h.label}</span>
                      <span className="row-sub">
                        {h.category}
                        {kind === 'asset' && (h.liquid ? ' · liquid' : ' · illiquid')}
                        {h.updated && ` · updated ${formatShort(h.updated)}`}
                      </span>
                    </span>
                    <span className="row-value">{euro(h.value)}</span>
                    <button
                      className="btn btn-quiet btn-danger"
                      onClick={() =>
                        actions.setHoldings(state.holdings.filter((x) => x.id !== h.id))
                      }
                      aria-label={`Remove ${h.label}`}
                    >
                      <IconTrash style={{ width: 16, height: 16 }} />
                    </button>
                  </div>
                ))}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: 13,
                borderTop: '1px solid var(--hairline)',
              }}
            >
              <span className="t-cap">Total</span>
              <span className="t-num">{euro(total)}</span>
            </div>
          </>
        )}
      </Card>
    </>
  )
}

function HoldingSheet({ kind, onClose }: { kind: HoldingKind; onClose: () => void }) {
  const state = useStore()
  const [label, setLabel] = useState('')
  const [value, setValue] = useState(0)
  const [category, setCategory] = useState(kind === 'asset' ? 'Property' : 'Loan')
  const [liquid, setLiquid] = useState(false)

  const save = () => {
    if (!label.trim() || value <= 0) return
    actions.setHoldings([
      ...state.holdings,
      {
        id: uid(),
        kind,
        label: label.trim(),
        value,
        category,
        liquid: kind === 'asset' ? liquid : false,
        updated: todayISO(),
      },
    ])
    onClose()
  }

  return (
    <Sheet title={kind === 'asset' ? 'Add an asset' : 'Add a liability'} onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField label="What" value={label} onChange={setLabel} placeholder="Name it plainly" />
        <NumberField label="Value (€)" value={value} onChange={setValue} />
        <Field label="Category">
          <select
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {HOLDING_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        {kind === 'asset' && (
          <button
            className="row"
            onClick={() => setLiquid((v) => !v)}
            role="checkbox"
            aria-checked={liquid}
            style={{ padding: 0 }}
          >
            <Check on={liquid} />
            <span className="row-main">
              <span className="row-title">Liquid</span>
              <span className="row-sub">Could you reach it inside a week?</span>
            </span>
          </button>
        )}
        <button
          className="btn btn-primary btn-block"
          onClick={save}
          disabled={!label.trim() || value <= 0}
        >
          Add
        </button>
      </div>
    </Sheet>
  )
}

// ----------------------------------------------------------------- invoices

function Invoices() {
  const state = useStore()
  const [entity, setEntity] = useState<MoneyEntity | 'all'>('all')
  const book = useMemo(
    () => invoiceBook(state, entity === 'all' ? undefined : entity),
    [state, entity],
  )
  const [adding, setAdding] = useState(false)

  const shown = state.invoices
    .filter((i) => entity === 'all' || i.entity === entity)
    .slice()
    .sort((a, b) => b.issued.localeCompare(a.issued))

  return (
    <>
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

      <div className="grid-3">
        <Stat label="Outstanding" value={euroCompact(book.outstanding)} sub="sent, unpaid" />
        <Stat
          label="Overdue"
          value={euroCompact(book.overdueValue)}
          sub={`${book.overdue.length} invoice${book.overdue.length === 1 ? '' : 's'}`}
          accent={book.overdue.length ? 'var(--warning)' : undefined}
        />
        <Stat
          label="Days to pay"
          value={book.averageDaysToPay === null ? '—' : num(book.averageDaysToPay, 0)}
          sub="average"
        />
      </div>

      {book.overdue.length > 0 && (
        <>
          <SectionTitle
            title="Overdue"
            action={
              <span className="pill" style={{ color: 'var(--warning)' }}>
                <IconWarn style={{ width: 12, height: 12 }} />
                {book.overdue.length}
              </span>
            }
          />
          <Card>
            {book.overdue.map((i) => (
              <div className="insight" key={i.id}>
                <div className="insight-head">
                  <span className="insight-title">{i.reference || 'Invoice'}</span>
                  <span className="t-num">{euro(i.amount)}</span>
                </div>
                <div className="insight-body">
                  {daysBetween(i.due, todayISO())} days past due ·{' '}
                  {state.clients.find((c) => c.id === i.clientId)?.name ?? 'no client'}
                </div>
                <div>
                  <button
                    className="btn btn-quiet btn-sm"
                    style={{ padding: '2px 0' }}
                    onClick={() => actions.markInvoicePaid(i.id)}
                  >
                    Mark paid
                  </button>
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      <SectionTitle
        title={`All · ${shown.length}`}
        action={
          <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>
            Add
          </button>
        }
      />
      <Card>
        {shown.length === 0 ? (
          <Empty>Nothing invoiced yet.</Empty>
        ) : (
          <div className="rows">
            {shown.map((i) => (
              <div className="row" key={i.id}>
                <button
                  onClick={() =>
                    i.status === 'paid'
                      ? actions.updateInvoice(i.id, { status: 'sent', paidDate: '' })
                      : actions.markInvoicePaid(i.id)
                  }
                  aria-label="Toggle paid"
                  style={{ display: 'flex' }}
                >
                  <Check on={i.status === 'paid'} />
                </button>
                <span className="row-main">
                  <span className="row-title">{i.reference || 'Invoice'}</span>
                  <span className="row-sub">
                    {INVOICE_STATUS_LABEL[i.status]} ·{' '}
                    {state.clients.find((c) => c.id === i.clientId)?.name ?? 'no client'}
                    {i.due && ` · due ${formatShort(i.due)}`}
                  </span>
                </span>
                <span className="row-value">{euro(i.amount)}</span>
                <button
                  className="btn btn-quiet btn-danger"
                  onClick={() => actions.setInvoices(state.invoices.filter((x) => x.id !== i.id))}
                  aria-label="Remove invoice"
                >
                  <IconTrash style={{ width: 16, height: 16 }} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {adding && <InvoiceSheet onClose={() => setAdding(false)} />}
    </>
  )
}

function InvoiceSheet({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState(0)
  const [entity, setEntity] = useState<MoneyEntity>('consulting')
  const [clientId, setClientId] = useState('')
  const [issued, setIssued] = useState(todayISO())
  const [due, setDue] = useState('')

  const save = () => {
    if (amount <= 0) return
    const invoice: Invoice = {
      id: uid(),
      entity,
      clientId,
      reference: reference.trim(),
      amount,
      issued,
      due,
      status: 'sent',
      paidDate: '',
    }
    actions.setInvoices([...state.invoices, invoice])
    onClose()
  }

  return (
    <Sheet title="Add an invoice" onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <TextField
          label="Reference"
          value={reference}
          onChange={setReference}
          placeholder="INV-014"
        />
        <NumberField label="Amount (€)" value={amount} onChange={setAmount} />
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
        <Field label="Client">
          <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">None</option>
            {state.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Issued">
          <input
            className="input"
            type="date"
            value={issued}
            onChange={(e) => setIssued(e.target.value)}
          />
        </Field>
        <Field label="Due">
          <input
            className="input"
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
          />
        </Field>
        <button className="btn btn-primary btn-block" onClick={save} disabled={amount <= 0}>
          Add
        </button>
      </div>
    </Sheet>
  )
}
