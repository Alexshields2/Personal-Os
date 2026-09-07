import { describe, expect, it } from 'vitest'
import { parseBankCsv } from './importBank'

describe('parseBankCsv', () => {
  it('parses a standard Date,Description,Amount export', () => {
    const csv = 'Date,Description,Amount\n2026-01-05,ALDI,-12.40\n2026-01-06,Salary,2000.00'
    const { rows, skipped } = parseBankCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ date: '2026-01-05', description: 'ALDI', amount: -12.4 })
    expect(rows[1].amount).toBe(2000)
    expect(skipped).toBe(0)
  })

  it('parses split Money out / Money in columns, as a Revolut statement uses', () => {
    const csv = 'Date,Description,Money out,Money in,Balance\n20 Dec 2025,ALDI,2.14,,97.86\n17 Dec 2025,Transfer from STEPHEN,,100.00,100.00'
    const { rows } = parseBankCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ date: '2025-12-20', description: 'ALDI', amount: -2.14 })
    expect(rows[1].amount).toBe(100)
  })

  it('parses DD/MM/YYYY dates', () => {
    const csv = 'Date,Description,Amount\n05/01/2026,Coffee,-3.50'
    const { rows } = parseBankCsv(csv)
    expect(rows[0].date).toBe('2026-01-05')
  })

  it('handles a quoted description containing a comma', () => {
    const csv = 'Date,Description,Amount\n2026-01-01,"Sq *cafe, Dublin",-4.20'
    const { rows } = parseBankCsv(csv)
    expect(rows[0].description).toBe('Sq *cafe, Dublin')
  })

  it('skips rows with no date or a zero amount, and counts them', () => {
    const csv = 'Date,Description,Amount\n2026-01-01,Fee,0.00\n,Broken,-5\n2026-01-02,OK,-5'
    const { rows, skipped } = parseBankCsv(csv)
    expect(rows).toHaveLength(1)
    expect(skipped).toBe(2)
  })

  it('reports an error rather than silently returning nothing when there is no date column', () => {
    const csv = 'Foo,Bar\n1,2'
    const { rows, error } = parseBankCsv(csv)
    expect(rows).toHaveLength(0)
    expect(error).toBeTruthy()
  })

  it('finds columns by header regardless of order or bank-specific naming', () => {
    const csv = 'Started Date,Amount,Reference\n2026-02-01,-99.99,Whoop'
    const { rows } = parseBankCsv(csv)
    expect(rows[0]).toEqual({ date: '2026-02-01', description: 'Whoop', amount: -99.99 })
  })
})
