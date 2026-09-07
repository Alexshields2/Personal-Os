import { describe, expect, it } from 'vitest'
import { addDays } from './date'
import {
  balanceSheet,
  billBook,
  dueOverview,
  invoiceBook,
  liveAccountBalance,
  monthlyCost,
  monthToDate,
  onemediaTotal,
  runway,
  search,
} from './selectors'
import { client, deal, goal, ledger, makeState, task } from './fixtures'
import type { Bill, Holding, Invoice } from './types'

const TODAY = '2026-03-01'

function bill(id: string, over: Partial<Bill> = {}): Bill {
  return {
    id,
    label: `bill ${id}`,
    amount: 100,
    cadence: 'monthly',
    nextDue: '',
    purse: 'consulting',
    category: '',
    ...over,
  }
}

function holding(id: string, over: Partial<Holding> = {}): Holding {
  return {
    id,
    kind: 'asset',
    label: `holding ${id}`,
    value: 1000,
    category: 'Cash',
    liquid: true,
    updated: TODAY,
    ...over,
  }
}

function invoice(id: string, over: Partial<Invoice> = {}): Invoice {
  return {
    id,
    entity: 'consulting',
    clientId: '',
    reference: id,
    amount: 1000,
    issued: addDays(TODAY, -30),
    due: addDays(TODAY, -10),
    status: 'sent',
    paidDate: '',
    ...over,
  }
}

describe('bills', () => {
  it('normalises every cadence to a monthly figure', () => {
    expect(monthlyCost(bill('a', { amount: 1200, cadence: 'annual' }))).toBe(100)
    expect(monthlyCost(bill('b', { amount: 300, cadence: 'quarterly' }))).toBe(100)
    expect(monthlyCost(bill('c', { amount: 100, cadence: 'monthly' }))).toBe(100)
    expect(monthlyCost(bill('d', { amount: 100, cadence: 'weekly' }))).toBeCloseTo(433.33, 1)
  })

  it('totals across cadences and splits by purse', () => {
    const state = makeState({
      bills: [
        bill('a', { amount: 1000, purse: 'consulting' }),
        bill('b', { amount: 6000, cadence: 'annual', purse: 'personal' }),
      ],
    })
    const book = billBook(state, undefined, TODAY)
    expect(book.monthly).toBe(1500)
    expect(book.annual).toBe(18_000)
    expect(book.byPurse.find((p) => p.purse === 'personal')!.monthly).toBe(500)
  })

  it('surfaces only what falls due inside a week', () => {
    const state = makeState({
      bills: [
        bill('soon', { nextDue: addDays(TODAY, 3) }),
        bill('later', { nextDue: addDays(TODAY, 20) }),
        bill('undated'),
      ],
    })
    expect(billBook(state, undefined, TODAY).dueSoon.map((b) => b.id)).toEqual(['soon'])
  })
})

describe('runway', () => {
  it('divides the cash by what leaves each month', () => {
    const state = makeState({
      balances: [{ id: 'b', date: TODAY, account: 'consultingBank', amount: 30_000 }],
      bills: [bill('a', { amount: 10_000, purse: 'consulting' })],
    })
    const r = runway(state, 'consulting')
    expect(r.months).toBe(3)
    expect(r.known).toBe(true)
  })

  it('refuses to claim a runway when nothing is going out', () => {
    const state = makeState({
      balances: [{ id: 'b', date: TODAY, account: 'consultingBank', amount: 30_000 }],
    })
    const r = runway(state, 'consulting')
    expect(r.known).toBe(false)
    expect(r.months).toBe(Infinity)
  })
})

describe('balanceSheet', () => {
  it('falls back to the manual snapshot until something is itemised', () => {
    const state = makeState({
      balances: [{ id: 'n', date: TODAY, account: 'netWorth', amount: 250_000 }],
    })
    const sheet = balanceSheet(state)
    expect(sheet.itemised).toBe(false)
    expect(sheet.net).toBe(250_000)
  })

  it('calculates from holdings once they exist, and splits liquid from not', () => {
    const state = makeState({
      balances: [{ id: 'n', date: TODAY, account: 'netWorth', amount: 1 }],
      holdings: [
        holding('house', { value: 600_000, liquid: false, category: 'Property' }),
        holding('cash', { value: 40_000, liquid: true }),
        holding('mortgage', { kind: 'liability', value: 300_000, liquid: false }),
      ],
    })
    const sheet = balanceSheet(state)
    expect(sheet.itemised).toBe(true)
    expect(sheet.assets).toBe(640_000)
    expect(sheet.liabilities).toBe(300_000)
    expect(sheet.net).toBe(340_000)
    expect(sheet.liquid).toBe(40_000)
    expect(sheet.illiquid).toBe(600_000)
    // The stale manual figure is kept for the reconciliation warning.
    expect(sheet.manual).toBe(1)
  })
})

describe('invoices', () => {
  it('counts only sent invoices as outstanding, and flags the late ones', () => {
    const state = makeState({
      invoices: [
        invoice('late', { amount: 5000, due: addDays(TODAY, -5) }),
        invoice('current', { amount: 2000, due: addDays(TODAY, 10) }),
        invoice('paid', { amount: 9000, status: 'paid', paidDate: addDays(TODAY, -2) }),
        invoice('draft', { amount: 7000, status: 'draft' }),
      ],
    })
    const book = invoiceBook(state, undefined, TODAY)
    expect(book.outstanding).toBe(7000)
    expect(book.overdue.map((i) => i.id)).toEqual(['late'])
    expect(book.overdueValue).toBe(5000)
  })

  it('averages days to pay only over invoices actually paid', () => {
    const state = makeState({
      invoices: [
        invoice('a', {
          status: 'paid',
          issued: addDays(TODAY, -40),
          paidDate: addDays(TODAY, -20),
        }),
        invoice('b', {
          status: 'paid',
          issued: addDays(TODAY, -40),
          paidDate: addDays(TODAY, -10),
        }),
        invoice('unpaid'),
      ],
    })
    expect(invoiceBook(state, undefined, TODAY).averageDaysToPay).toBe(25)
  })

  it('says nothing rather than zero before anything has been paid', () => {
    const state = makeState({ invoices: [invoice('a')] })
    expect(invoiceBook(state, undefined, TODAY).averageDaysToPay).toBeNull()
  })
})

describe('search', () => {
  it('lists the sections when the query matches one', () => {
    const hits = search(makeState(), 'patt')
    expect(hits[0].kind).toBe('section')
    expect(hits[0].tab).toBe('patterns')
  })

  it('ranks an exact prefix above a match buried mid-word', () => {
    const state = makeState({
      tasks: [task('a', { title: 'Ring the bank' }), task('b', { title: 'Unbanked ideas' })],
    })
    const hits = search(state, 'bank').filter((h) => h.kind === 'task')
    expect(hits[0].label).toBe('Ring the bank')
  })

  it('reaches across every collection', () => {
    const state = makeState({
      clients: [client('c', { name: 'Kavanagh Group' })],
      deals: [deal('d', { name: 'Kavanagh expansion' })],
      goals: [goal('g', { title: 'Kavanagh renewal' })],
    })
    const kinds = search(state, 'kavanagh').map((h) => h.kind)
    expect(new Set(kinds)).toEqual(new Set(['client', 'deal', 'goal']))
  })

  it('returns nothing for an empty query', () => {
    expect(search(makeState(), '   ')).toEqual([])
  })
})

describe('liveAccountBalance', () => {
  it('carries the latest snapshot forward by cash in and expense since it', () => {
    const state = makeState({
      balances: [{ id: 'b1', date: '2026-01-01', account: 'consultingBank', amount: 10_000 }],
      ledger: [
        ledger('l1', { date: '2026-01-05', kind: 'cashCollected', amount: 5000, account: 'consultingBank' }),
        ledger('l2', { date: '2026-01-10', kind: 'expense', amount: 2000, account: 'consultingBank' }),
        // Revenue is recognition, not cash — it must not move the balance.
        ledger('l3', { date: '2026-01-12', kind: 'revenue', amount: 50_000, account: 'consultingBank' }),
      ],
    })
    expect(liveAccountBalance(state, 'consultingBank', '2026-01-15')).toBe(13_000)
  })

  it('ignores movements attributed to a different account', () => {
    const state = makeState({
      balances: [{ id: 'b1', date: '2026-01-01', account: 'onemediaAib', amount: 1000 }],
      ledger: [
        ledger('l1', { date: '2026-01-05', kind: 'cashCollected', amount: 500, account: 'onemediaStripe' }),
      ],
    })
    expect(liveAccountBalance(state, 'onemediaAib', '2026-01-10')).toBe(1000)
  })

  it('ignores a movement dated before the anchor snapshot', () => {
    const state = makeState({
      balances: [{ id: 'b1', date: '2026-01-10', account: 'consultingBank', amount: 5000 }],
      ledger: [
        ledger('l1', { date: '2026-01-05', kind: 'cashCollected', amount: 9000, account: 'consultingBank' }),
      ],
    })
    expect(liveAccountBalance(state, 'consultingBank', '2026-01-15')).toBe(5000)
  })
})

describe('onemediaTotal and personalTotal', () => {
  it('sum every account under the business, live', () => {
    const state = makeState({
      balances: [
        { id: 'b1', date: '2026-01-01', account: 'onemediaStripe', amount: 1000 },
        { id: 'b2', date: '2026-01-01', account: 'onemediaAib', amount: 2000 },
        { id: 'b3', date: '2026-01-01', account: 'onemediaRev', amount: 500 },
      ],
      ledger: [
        ledger('l1', { date: '2026-01-05', kind: 'expense', amount: 300, account: 'onemediaAib' }),
      ],
    })
    expect(onemediaTotal(state, '2026-01-10')).toBe(1000 + 2000 - 300 + 500)
  })
})

describe('monthToDate', () => {
  it('sums only entries in the given month, for one business', () => {
    const state = makeState({
      ledger: [
        ledger('a', { date: '2026-03-05', entity: 'consulting', kind: 'cashCollected', amount: 4000 }),
        ledger('b', { date: '2026-03-20', entity: 'consulting', kind: 'expense', amount: 1500 }),
        ledger('c', { date: '2026-02-28', entity: 'consulting', kind: 'cashCollected', amount: 9000 }),
        ledger('d', { date: '2026-03-06', entity: 'onemedia', kind: 'cashCollected', amount: 700 }),
      ],
    })
    const m = monthToDate(state, 'consulting', '2026-03-25')
    expect(m.cashCollected).toBe(4000)
    expect(m.expense).toBe(1500)
    expect(m.net).toBe(2500)
  })
})

describe('dueOverview', () => {
  it('buckets a sent, unexpired invoice as guaranteed and an overdue one as needs-push', () => {
    const state = makeState({
      invoices: [
        invoice('ok', { status: 'sent', due: addDays(TODAY, 10), amount: 3000 }),
        invoice('late', { status: 'sent', due: addDays(TODAY, -3), amount: 1000 }),
        invoice('draft', { status: 'draft', amount: 5000 }),
      ],
    })
    const due = dueOverview(state, undefined, TODAY)
    expect(due.byConfidence.guaranteed).toBe(3000)
    expect(due.byConfidence.needsPush).toBe(1000)
    expect(due.items.map((i) => i.id).sort()).toEqual(['inv-late', 'inv-ok'])
  })

  it('rates a fresh, high-probability deal likely and a stale one needs-push', () => {
    const state = makeState({
      deals: [
        deal('fresh', { stage: 'proposal', probability: 60, value: 20_000, moved: TODAY }),
        deal('cold', { stage: 'lead', probability: 10, value: 5000, moved: addDays(TODAY, -30) }),
      ],
    })
    const due = dueOverview(state, undefined, TODAY)
    expect(due.byConfidence.likely).toBe(20_000)
    expect(due.byConfidence.needsPush).toBe(5000)
  })
})
