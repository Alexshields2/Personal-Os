import { useMemo, useState } from 'react'
import { Card, Empty, Meter, SectionTitle, Segmented, Stat } from '../components/ui'
import { BalanceChart } from '../components/charts'
import type { Series } from '../components/charts'
import { formatShort, todayISO } from '../lib/date'
import { euro, euroCompact, num } from '../lib/format'
import { actions, useStore } from '../lib/store'
import {
  MARKETING_DAYS,
  MARKETING_INPUTS,
  MARKETING_OUTPUTS,
  MARKETING_ROLLUPS,
  dayExecution,
  emptyMarketingDay,
  executionStatus,
  isMarketingLogged,
  rollupCampaignTarget,
  rollupDailyTarget,
  totalLeads,
  workingDates,
} from '../lib/marketing'
import type { InputKey, MarketingDay, OutputKey } from '../lib/marketing'
import type { AppState } from '../lib/types'

/**
 * 100 working days, one question: did we do the work?
 *
 * Inputs drive the execution score and outputs deliberately do not — the whole
 * point is a number that can't be flattered by a lucky lead. Everything else
 * here is arithmetic on top of that one idea.
 */

type View = 'today' | 'dashboard' | 'sheet' | 'graphs'

const STATUS_COLOR = {
  hit: 'var(--exec-hit)',
  close: 'var(--exec-close)',
  missed: 'var(--exec-miss)',
} as const

function colorFor(pct: number): string {
  return STATUS_COLOR[executionStatus(pct)]
}

/** Every day of the campaign with its date, entry and score, in order. */
function useCampaign(state: AppState) {
  return useMemo(() => {
    const dates = workingDates(state.marketing.startDate)
    return dates.map((date, i) => {
      const day = state.marketing.days[date]
      return {
        n: i + 1,
        date,
        day,
        logged: isMarketingLogged(day),
        pct: day ? dayExecution(day) : 0,
      }
    })
  }, [state.marketing])
}

export default function Marketing() {
  const state = useStore()
  const [view, setView] = useState<View>('today')
  const campaign = useCampaign(state)
  const today = todayISO()
  const todayRow = campaign.find((r) => r.date === today)
  const logged = campaign.filter((r) => r.logged)

  const dayNo = todayRow?.n ?? logged.length

  return (
    <div className="screen wrap wrap-wide">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            Consulting.ie · 100 working days
          </span>
        </div>
        <h1 className="t-large">Marketing</h1>
        <p className="t-sub">
          Did we do it? Inputs are what we control, and they alone score the day. Leads,
          pipeline and revenue are recorded beside them, never inside the score.
        </p>
      </header>

      <div style={{ marginBottom: 16 }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'dashboard', label: 'Dashboard' },
            { value: 'sheet', label: 'Sheet' },
            { value: 'graphs', label: 'Graphs' },
          ]}
        />
      </div>

      {view === 'today' && <TodayView state={state} campaign={campaign} />}
      {view === 'dashboard' && <DashboardView campaign={campaign} dayNo={dayNo} />}
      {view === 'sheet' && <SheetView campaign={campaign} state={state} />}
      {view === 'graphs' && <GraphsView campaign={campaign} />}
    </div>
  )
}

// ------------------------------------------------------------------- today

/**
 * One day at a time. Defaults to today when today is a campaign day, and
 * otherwise to the most recent one, so the view is never empty — and steps to
 * any other day from there, because backfilling is the normal case.
 */
function TodayView({ state, campaign }: { state: AppState; campaign: Row[] }) {
  const today = todayISO()
  const fallback =
    campaign.find((r) => r.date === today) ??
    [...campaign].reverse().find((r) => r.date <= today) ??
    campaign[0]
  const [date, setDate] = useState(fallback?.date ?? today)

  const idx = campaign.findIndex((r) => r.date === date)
  const row = campaign[idx]
  const day = state.marketing.days[date] ?? emptyMarketingDay()
  const pct = dayExecution(day)

  if (!row) {
    return (
      <Card className="card-pad">
        <Empty>
          That date isn't one of the campaign's 100 working days. Set the start date in the
          Sheet view.
        </Empty>
      </Card>
    )
  }

  return (
    <>
      <Card className="card-pad mk-score">
        <div style={{ minWidth: 150 }}>
          <div className="t-cap">
            Day {row.n} of {MARKETING_DAYS}
            {row.date === today && ' · today'}
          </div>
          <div className="hero" style={{ color: colorFor(pct) }}>{Math.round(pct)}%</div>
          <div className="t-foot muted">{formatShort(row.date)} execution score</div>
        </div>
        <div style={{ flex: 1, minWidth: 160 }}>
          <Meter pct={pct} color={colorFor(pct)} />
        </div>
        <div className="mk-daynav">
          <button
            className="btn btn-quiet btn-sm"
            disabled={idx <= 0}
            onClick={() => setDate(campaign[idx - 1].date)}
            aria-label="Previous day"
          >
            ←
          </button>
          <select
            className="input"
            style={{ width: 132 }}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Jump to a campaign day"
          >
            {campaign.map((r) => (
              <option key={r.date} value={r.date}>
                Day {r.n} · {formatShort(r.date)}
              </option>
            ))}
          </select>
          <button
            className="btn btn-quiet btn-sm"
            disabled={idx >= campaign.length - 1}
            onClick={() => setDate(campaign[idx + 1].date)}
            aria-label="Next day"
          >
            →
          </button>
          {row.date !== today && campaign.some((r) => r.date === today) && (
            <button className="btn btn-sm" onClick={() => setDate(today)}>
              Today
            </button>
          )}
        </div>
      </Card>

      <DayEditor date={date} day={day} />
    </>
  )
}

/**
 * The one entry surface, used by Today and by the sheet's selected row. Two
 * minutes, top to bottom — every field is a number and nothing is required.
 */
function DayEditor({ date, day }: { date: string; day: MarketingDay }) {
  const groups = useMemo(() => {
    const out: { name: string; items: typeof MARKETING_INPUTS }[] = []
    for (const i of MARKETING_INPUTS) {
      const g = out.find((x) => x.name === i.group)
      if (g) g.items.push(i)
      else out.push({ name: i.group, items: [i] })
    }
    return out
  }, [])

  return (
    <>
      <SectionTitle title="Inputs" action={<span className="t-foot muted">what we control</span>} />
      <Card>
        {groups.map((g) => (
          <div key={g.name} className="mk-group">
            <div className="mk-group-head t-cap">{g.name}</div>
            {g.items.map((i) => {
              const actual = day[i.key] || 0
              const p = Math.min(100, (actual / i.target) * 100)
              return (
                <div className="mk-row" key={i.key}>
                  <span className="mk-label">{i.label}</span>
                  <input
                    className="input mk-input t-num"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={actual === 0 ? '' : actual}
                    placeholder="0"
                    onChange={(e) =>
                      actions.setMarketingField(date, i.key, Math.max(0, Number(e.target.value) || 0))
                    }
                  />
                  <span className="mk-target t-num muted">/ {num(i.target)}</span>
                  <span className="mk-bar">
                    <Meter pct={p} color={colorFor(p)} />
                  </span>
                </div>
              )
            })}
          </div>
        ))}
        <div className="mk-group">
          <div className="mk-group-head t-cap">Paid</div>
          <div className="mk-row">
            <span className="mk-label">Paid ads active</span>
            <button
              className="btn btn-sm"
              aria-pressed={day.paidAds}
              style={
                day.paidAds
                  ? { background: 'var(--exec-hit)', color: 'var(--on-accent)' }
                  : undefined
              }
              onClick={() => actions.setMarketingField(date, 'paidAds', !day.paidAds)}
            >
              {day.paidAds ? 'Yes' : 'No'}
            </button>
          </div>
        </div>
      </Card>

      <SectionTitle
        title="Outputs"
        action={<span className="t-foot muted">recorded, not scored</span>}
      />
      <Card>
        <div className="mk-group">
          {MARKETING_OUTPUTS.map((o) => (
            <div className="mk-row" key={o.key}>
              <span className="mk-label">{o.label}</span>
              <input
                className="input mk-input t-num"
                type="number"
                min={0}
                inputMode="numeric"
                value={(day[o.key] || 0) === 0 ? '' : day[o.key]}
                placeholder={o.money ? '€0' : '0'}
                onChange={(e) =>
                  actions.setMarketingField(date, o.key, Math.max(0, Number(e.target.value) || 0))
                }
              />
              <span className="mk-target t-num muted">{o.money ? '€' : ''}</span>
              <span className="mk-bar" />
            </div>
          ))}
          <div className="mk-row">
            <span className="mk-label dim">Total leads</span>
            <span className="mk-input t-num" style={{ textAlign: 'right', paddingRight: 8 }}>
              {totalLeads(day)}
            </span>
            <span className="mk-target" />
            <span className="mk-bar" />
          </div>
        </div>
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Outputs are kept out of the execution score on purpose. A good week of leads should
        never make a week of no posting look like it happened.
      </p>
    </>
  )
}

// --------------------------------------------------------------- dashboard

type Row = ReturnType<typeof useCampaign>[number]

function DashboardView({ campaign, dayNo }: { campaign: Row[]; dayNo: number }) {
  const logged = campaign.filter((r) => r.logged)
  const overall = logged.length
    ? logged.reduce((s, r) => s + r.pct, 0) / logged.length
    : 0
  const perfect = logged.filter((r) => r.pct >= 100).length

  // Consecutive perfect days ending at the most recent logged day.
  let streak = 0
  for (let i = logged.length - 1; i >= 0; i--) {
    if (logged[i].pct >= 100) streak++
    else break
  }

  const sum = (fn: (d: MarketingDay) => number) =>
    logged.reduce((s, r) => s + (r.day ? fn(r.day) : 0), 0)

  const outputs = {
    leads: sum(totalLeads),
    meetings: sum((d) => d.meetingsBooked || 0),
    pipeline: sum((d) => d.pipelineCreated || 0),
    revenue: sum((d) => d.revenueClosed || 0),
    cash: sum((d) => d.cashCollected || 0),
  }

  return (
    <>
      <div className="grid-3">
        <Stat label="Day" value={`${dayNo} / ${MARKETING_DAYS}`} sub={`${logged.length} logged`} />
        <Stat
          label="Overall execution"
          value={`${Math.round(overall)}%`}
          accent={logged.length ? colorFor(overall) : undefined}
          sub="mean of logged days"
        />
        <Stat label="Perfect days" value={`${perfect} / ${MARKETING_DAYS}`} sub="100% execution" />
        <Stat
          label="Current streak"
          value={`${streak}`}
          sub={streak === 1 ? 'perfect day' : 'perfect days'}
          accent={streak > 0 ? 'var(--exec-hit)' : undefined}
        />
      </div>

      <SectionTitle title="100-day progress" />
      <Card className="card-pad">
        {MARKETING_ROLLUPS.map((r) => {
          const target = rollupCampaignTarget(r.keys)
          const actual = logged.reduce(
            (s, row) => s + r.keys.reduce((a, k) => a + (row.day?.[k] || 0), 0),
            0,
          )
          const pct = target ? (actual / target) * 100 : 0
          return (
            <div key={r.id} style={{ marginBottom: 12 }}>
              <div className="mk-progress-head">
                <span className="dim">{r.label}</span>
                <span className="t-num muted">
                  {num(actual)} / {num(target)} · {pct.toFixed(1)}%
                </span>
              </div>
              <Meter pct={pct} />
            </div>
          )
        })}
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Every campaign target is its daily target times {MARKETING_DAYS}, so these stay right
        even if a daily target changes.
      </p>

      <SectionTitle title="Commercial output" />
      <div className="grid-3">
        <Stat label="Total leads" value={num(outputs.leads)} />
        <Stat label="Meetings booked" value={num(outputs.meetings)} />
        <Stat label="Pipeline created" value={euroCompact(outputs.pipeline)} sub={euro(outputs.pipeline)} />
        <Stat label="Revenue closed" value={euroCompact(outputs.revenue)} sub={euro(outputs.revenue)} />
        <Stat label="Cash collected" value={euroCompact(outputs.cash)} sub={euro(outputs.cash)} />
      </div>
    </>
  )
}

// ------------------------------------------------------------------- sheet

type SheetFilter = 'all' | 'logged' | 'perfect' | 'below' | 'blank'

function SheetView({ campaign, state }: { campaign: Row[]; state: AppState }) {
  const today = todayISO()
  const [selected, setSelected] = useState<string | null>(
    campaign.find((r) => r.date === today)?.date ?? null,
  )
  const [filter, setFilter] = useState<SheetFilter>('all')
  const [query, setQuery] = useState('')
  const selectedDay = selected ? state.marketing.days[selected] ?? emptyMarketingDay() : null

  // Day number or date text — one box, because "day 34" and "12 Nov" are the
  // same question asked two ways.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return campaign.filter((r) => {
      if (filter === 'logged' && !r.logged) return false
      if (filter === 'blank' && r.logged) return false
      if (filter === 'perfect' && !(r.logged && r.pct >= 100)) return false
      if (filter === 'below' && !(r.logged && r.pct < 100)) return false
      if (!q) return true
      // A bare number means a day number; anything else is date text. Without
      // that split, "2" matches day 2 and every date containing a 2.
      return /^\d+$/.test(q)
        ? String(r.n) === q
        : formatShort(r.date).toLowerCase().includes(q)
    })
  }, [campaign, filter, query])

  return (
    <>
      <Card className="card-pad" style={{ marginBottom: 14 }}>
        <div className="mk-progress-head" style={{ marginBottom: 8 }}>
          <span className="t-cap">Day 1 of the campaign</span>
          <input
            className="input"
            type="date"
            style={{ width: 170 }}
            value={state.marketing.startDate}
            onChange={(e) => e.target.value && actions.setMarketingStart(e.target.value)}
          />
        </div>
        <p className="t-foot muted">
          Weekends are skipped automatically — the 100 days are working days.
        </p>
      </Card>

      <div className="mk-filter">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: `All · ${campaign.length}` },
            { value: 'logged', label: `Logged · ${campaign.filter((r) => r.logged).length}` },
            { value: 'perfect', label: `100% · ${campaign.filter((r) => r.logged && r.pct >= 100).length}` },
            { value: 'below', label: `Below · ${campaign.filter((r) => r.logged && r.pct < 100).length}` },
            { value: 'blank', label: `Blank · ${campaign.filter((r) => !r.logged).length}` },
          ]}
        />
        <input
          className="input"
          style={{ maxWidth: 190 }}
          placeholder="Find a day — 34, or 12 Nov"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {(filter !== 'all' || query) && (
          <button
            className="btn btn-quiet btn-sm"
            onClick={() => {
              setFilter('all')
              setQuery('')
            }}
          >
            Clear
          </button>
        )}
        <span className="t-foot muted">{visible.length} shown</span>
      </div>

      <div className="tablewrap mk-sheet">
        <table>
          <thead>
            <tr>
              <th className="mk-sticky">Day</th>
              <th>Date</th>
              <th>%</th>
              {MARKETING_INPUTS.map((i) => (
                <th key={i.key} title={`${i.label} — target ${i.target}`}>
                  {i.short}
                </th>
              ))}
              <th>Ads</th>
              <th>Leads</th>
              <th>Mtgs</th>
              <th>Pipeline</th>
              <th>Revenue</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr
                key={r.date}
                onClick={() => setSelected(r.date)}
                data-selected={r.date === selected}
                data-today={r.date === today}
                className="mk-sheet-row"
              >
                <td className="mk-sticky d">{r.n}</td>
                <td className="d">{formatShort(r.date)}</td>
                <td
                  className="d t-num"
                  style={{ color: r.logged ? colorFor(r.pct) : 'var(--text-muted)' }}
                >
                  {r.logged ? `${Math.round(r.pct)}%` : '—'}
                </td>
                {MARKETING_INPUTS.map((i) => (
                  <td key={i.key} className="t-num">
                    {r.day?.[i.key] || ''}
                  </td>
                ))}
                <td>{r.day?.paidAds ? 'Y' : ''}</td>
                <td className="t-num">{r.day ? totalLeads(r.day) || '' : ''}</td>
                <td className="t-num">{r.day?.meetingsBooked || ''}</td>
                <td className="t-num">{r.day?.pipelineCreated ? euroCompact(r.day.pipelineCreated) : ''}</td>
                <td className="t-num">{r.day?.revenueClosed ? euroCompact(r.day.revenueClosed) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 && <Empty>No days match that filter.</Empty>}
      </div>

      {selected && selectedDay && (
        <>
          <SectionTitle
            title={`Editing ${formatShort(selected)}`}
            action={
              <span className="t-foot" style={{ color: colorFor(dayExecution(selectedDay)) }}>
                {Math.round(dayExecution(selectedDay))}%
              </span>
            }
          />
          <DayEditor date={selected} day={selectedDay} />
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------------ graphs

function GraphsView({ campaign }: { campaign: Row[] }) {
  const logged = campaign.filter((r) => r.logged)
  const [compare, setCompare] = useState<OutputKey | 'leads'>('leads')

  if (logged.length === 0) {
    return (
      <Card>
        <Empty>Nothing logged yet. The graphs fill in from the first day you record.</Empty>
      </Card>
    )
  }

  // 1 — daily execution, with a 7-day moving average over logged days.
  const execSeries: Series[] = [
    {
      id: 'exec',
      label: 'Daily %',
      color: 'var(--series-1media)',
      points: logged.map((r) => ({ date: r.date, amount: Math.round(r.pct) })),
    },
    {
      id: 'ma',
      label: '7-day avg',
      color: 'var(--accent)',
      points: logged.map((r, i) => {
        const from = Math.max(0, i - 6)
        const win = logged.slice(from, i + 1)
        return {
          date: r.date,
          amount: Math.round(win.reduce((s, w) => s + w.pct, 0) / win.length),
        }
      }),
    },
  ]

  // 2 — cumulative actual inputs against the flat plan.
  const dailyPlan = MARKETING_INPUTS.reduce((s, i) => s + i.target, 0)
  let runActual = 0
  const cumulative: Series[] = [
    {
      id: 'planned',
      label: 'Planned',
      color: 'var(--series-personal)',
      dash: '6 5',
      points: logged.map((r, i) => ({ date: r.date, amount: dailyPlan * (i + 1) })),
    },
    {
      id: 'actual',
      label: 'Actual',
      color: 'var(--accent)',
      points: logged.map((r) => {
        runActual += MARKETING_INPUTS.reduce((s, i) => s + (r.day?.[i.key] || 0), 0)
        return { date: r.date, amount: runActual }
      }),
    },
  ]

  // 3 — leads by source.
  const leadSeries: Series[] = [
    { id: 'paid', label: 'Paid', color: 'var(--series-personal)', dash: '2 4', key: 'paidLeads' },
    { id: 'organic', label: 'Organic', color: 'var(--series-1media)', dash: '6 4', key: 'organicLeads' },
    { id: 'outbound', label: 'Outbound', color: 'var(--series-consulting)', dash: '1 4', key: 'outboundLeads' },
  ].map((s) => ({
    id: s.id,
    label: s.label,
    color: s.color,
    dash: s.dash,
    points: logged.map((r) => ({ date: r.date, amount: r.day?.[s.key as OutputKey] || 0 })),
  }))
  leadSeries.push({
    id: 'total',
    label: 'Total',
    color: 'var(--accent)',
    points: logged.map((r) => ({ date: r.date, amount: r.day ? totalLeads(r.day) : 0 })),
  })

  const cumulativeOf = (key: OutputKey, label: string, color: string): Series => {
    let run = 0
    return {
      id: key,
      label,
      color,
      points: logged.map((r) => {
        run += r.day?.[key] || 0
        return { date: r.date, amount: run }
      }),
    }
  }

  // 6 — execution against one output, each normalised to its own peak so two
  // different units can share one axis and be compared by shape.
  const outValue = (r: Row) =>
    compare === 'leads' ? (r.day ? totalLeads(r.day) : 0) : r.day?.[compare] || 0
  const peak = Math.max(1, ...logged.map(outValue))
  const compareSeries: Series[] = [
    {
      id: 'exec',
      label: 'Execution',
      color: 'var(--accent)',
      points: logged.map((r) => ({ date: r.date, amount: Math.round(r.pct) })),
    },
    {
      id: 'out',
      label: 'Output',
      color: 'var(--series-1media)',
      dash: '6 4',
      points: logged.map((r) => ({ date: r.date, amount: Math.round((outValue(r) / peak) * 100) })),
    },
  ]

  return (
    <>
      <SectionTitle title="Daily execution" />
      <Card className="card-pad">
        <BalanceChart series={execSeries} />
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 18px' }}>
        The thin line is each day; the bright one is the 7-day average, which is the honest
        read on whether consistency is climbing.
      </p>

      <SectionTitle title="Cumulative inputs vs plan" />
      <Card className="card-pad">
        <BalanceChart series={cumulative} />
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 18px' }}>
        Above the dashed line is ahead, below it is behind. Plan is {num(dailyPlan)} inputs a day.
      </p>

      <SectionTitle title="Leads" />
      <Card className="card-pad">
        <BalanceChart series={leadSeries} />
      </Card>

      <SectionTitle title="Pipeline created" />
      <Card className="card-pad">
        <BalanceChart series={[cumulativeOf('pipelineCreated', 'Pipeline €', 'var(--accent)')]} />
      </Card>

      <SectionTitle title="Revenue closed" />
      <Card className="card-pad">
        <BalanceChart series={[cumulativeOf('revenueClosed', 'Revenue €', 'var(--accent)')]} />
      </Card>

      <SectionTitle title="Execution vs output" />
      <div style={{ marginBottom: 10 }}>
        <Segmented
          value={compare}
          onChange={setCompare}
          options={[
            { value: 'leads', label: 'Leads' },
            { value: 'meetingsBooked', label: 'Meetings' },
            { value: 'pipelineCreated', label: 'Pipeline' },
            { value: 'revenueClosed', label: 'Revenue' },
          ]}
        />
      </div>
      <Card className="card-pad">
        <BalanceChart series={compareSeries} />
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Both lines are scaled to their own peak, so what matters is whether the shapes move
        together — not the gap between them. It takes weeks of days before that means anything.
      </p>
    </>
  )
}
