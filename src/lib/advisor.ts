/**
 * Alex — the briefing.
 *
 * This is a rules engine, not a language model. It reads the document you have
 * already filled in and says what it finds, in a fixed order of severity. That
 * is a deliberate trade: it can only notice things it was taught to look for,
 * but it never invents a number, never needs the network, never sends your data
 * anywhere, and gives the same answer twice for the same inputs.
 *
 * Every finding has to carry three things or it doesn't earn its place: what is
 * true, the figures behind it, and what to do about it. An observation with no
 * action is a fact you already knew.
 */

import { PURSE_LABEL, STALE_DEAL_DAYS } from './config'
import { addDays, daysBetween, todayISO } from './date'
import { euro, euroCompact, num } from './format'
import {
  balanceSheet,
  billBook,
  breakdownSignals,
  carriedPriorities,
  clientBook,
  contactsDue,
  currentStreak,
  domainScores,
  goalBoard,
  invoiceBook,
  isLogged,
  learnStats,
  loggedDays,
  loopStats,
  oscillation,
  pipeline,
  planStatus,
  priorityRun,
  runway,
  taskQueue,
  weakestStandards,
  weekdayScores,
} from './selectors'
import type { AppState, Purse } from './types'

export type Severity = 'critical' | 'watch' | 'good'

export interface Finding {
  id: string
  severity: Severity
  /** What is true, in one line. */
  title: string
  /** The figures behind it. */
  detail: string
  /** What to do about it. Omitted only for the good news. */
  action?: string
  /** Where to go and fix it. */
  tab?: string
  /** Ranking weight within a severity band. Higher surfaces first. */
  weight: number
}

export interface Briefing {
  /** The single thing worth doing something about, if there is one. */
  headline: Finding | null
  critical: Finding[]
  watch: Finding[]
  good: Finding[]
  /** Logged days behind the briefing. Under a week, it says so rather than guessing. */
  days: number
  thin: boolean
}

/** Purses that can run out of money and take a business with them. */
const BUSINESS: Purse[] = ['consulting', 'onemedia']

export function briefing(state: AppState, iso = todayISO()): Briefing {
  const out: Finding[] = []
  const push = (f: Finding) => out.push(f)

  const logged = loggedDays(state)
  const osc = oscillation(state, iso)
  const today = state.days[iso]
  const plan = planStatus(today)

  // ---------------------------------------------------------------- the day

  if (!isLogged(today) && logged.length > 0) {
    const last = [...logged].sort((a, b) => b.date.localeCompare(a.date))[0]
    const gap = daysBetween(last.date, iso)
    if (gap >= 2) {
      push({
        id: 'lapsed',
        severity: 'critical',
        title: `Nothing logged for ${gap} days.`,
        detail: `The last closed day was ${last.date}. Everything on this screen is reading older data than it should be.`,
        action: 'Log today, even badly. A gap in the record is worse than a bad day in it.',
        tab: 'today',
        weight: 95,
      })
    }
  }

  if (plan.set === 0) {
    push({
      id: 'unplanned',
      severity: 'watch',
      title: 'Today has no plan.',
      detail: 'No priorities are written down, so nothing decides what today was for.',
      action: 'Write the one thing. Two minutes.',
      tab: 'today',
      weight: 70,
    })
  }

  // -------------------------------------------------------- which version

  if (osc.enough && osc.current?.kind === 'break' && osc.current.days >= 3) {
    push({
      id: 'breaking',
      severity: osc.current.days >= 7 ? 'critical' : 'watch',
      title: `Day ${osc.current.days} of a breaking phase.`,
      detail: `The rolling week is below your mean of ${Math.round(osc.mean)}. Your deepest break so far ran ${osc.deepestBreak?.days ?? 0} days.`,
      action: 'Pick the smallest thing that counts as a win and do it today. Phases turn on evidence, not intention.',
      tab: 'patterns',
      weight: 90,
    })
  }

  if (osc.enough && osc.drift <= -4) {
    push({
      id: 'drifting',
      severity: 'critical',
      title: 'Your mean is falling.',
      detail: `Down ${Math.round(Math.abs(osc.drift))} points across the window. The swings are landing lower than they used to.`,
      action: 'The peaks are not the problem. Find the standard you have quietly stopped keeping.',
      tab: 'patterns',
      weight: 92,
    })
  }

  // ------------------------------------------------------------ the walls

  const walls = carriedPriorities(state).filter((c) => c.ongoing && c.maxRun >= 3)
  if (walls.length > 0) {
    const worst = walls[0]
    push({
      id: 'wall',
      severity: 'critical',
      title: `“${worst.text}” has been written down ${worst.maxRun} days running and never done.`,
      detail: `${worst.times} misses since ${worst.firstDate}. Either it isn't actually a priority, or something is stopping it.`,
      action: 'Cut it into a thirty-minute first step, or take it off the list honestly.',
      tab: 'patterns',
      weight: 88,
    })
  }

  const rising = loopStats(state, iso).filter((l) => l.trend === 'rising' && l.rate >= 25)
  if (rising.length > 0) {
    const l = rising[0]
    push({
      id: `loop-${l.loop.id}`,
      severity: 'watch',
      title: `“${l.loop.label}” is getting worse.`,
      detail: `${Math.round(l.rate)}% of logged days, ${l.recent} in the last fortnight against ${l.prior} before it${l.streak >= 2 ? `, and running ${l.streak} days straight` : ''}.`,
      action: 'Name the trigger. A loop you can see coming is one you can interrupt.',
      tab: 'patterns',
      weight: 74,
    })
  }

  const run = priorityRun(state)
  if (run.daysPlanned >= 7 && run.oneThingRate < 50) {
    push({
      id: 'one-thing-rate',
      severity: 'watch',
      title: `Your one thing lands ${Math.round(run.oneThingRate)}% of the time.`,
      detail: `${run.oneThingHit} of ${run.daysPlanned} planned days. The rest of the plan is decoration if the first line doesn't hold.`,
      action: 'Make the one thing smaller until it is something you finish before noon.',
      tab: 'today',
      weight: 72,
    })
  }

  // ---------------------------------------------------------------- money

  for (const purse of BUSINESS) {
    const r = runway(state, purse)
    if (r.known && r.months < 6) {
      push({
        id: `runway-${purse}`,
        severity: r.months < 3 ? 'critical' : 'watch',
        title: `${PURSE_LABEL[purse]} has ${num(r.months, 1)} months of runway.`,
        detail: `${euro(r.cash)} in the account against ${euro(r.monthlyBurn)} going out a month.`,
        action:
          r.months < 3
            ? 'Short runway is what makes you take work you should refuse. Collect what is owed and cut what is not earning.'
            : 'Watch it. Six months of cover is the line where you can still say no.',
        tab: 'money',
        weight: r.months < 3 ? 94 : 76,
      })
    }
  }

  const inv = invoiceBook(state, undefined, iso)
  if (inv.overdue.length > 0) {
    push({
      id: 'overdue-invoices',
      severity: inv.overdueValue > 10_000 ? 'critical' : 'watch',
      title: `${euroCompact(inv.overdueValue)} is late.`,
      detail: `${inv.overdue.length} invoice${inv.overdue.length === 1 ? '' : 's'} past due${inv.averageDaysToPay !== null ? `, against an average of ${num(inv.averageDaysToPay, 0)} days to get paid` : ''}.`,
      action: 'Chase them today. Money you have earned and not collected is the cheapest money there is.',
      tab: 'money',
      weight: 86,
    })
  }

  const book = clientBook(state, undefined, iso)
  if (book.concentration > 40 && book.active.length > 1) {
    push({
      id: 'concentration',
      severity: book.concentration > 60 ? 'critical' : 'watch',
      title: `One client is ${Math.round(book.concentration)}% of your recurring revenue.`,
      detail: `${euroCompact(book.mrr)} MRR across ${book.active.length} active clients.`,
      action: 'Concentration never feels like a risk until the call comes. The fix is one more client, not a better contract.',
      tab: 'work',
      weight: 80,
    })
  }

  if (book.renewalsDue.length > 0) {
    push({
      id: 'renewals',
      severity: 'watch',
      title: `${book.renewalsDue.length} renewal${book.renewalsDue.length === 1 ? '' : 's'} inside 30 days.`,
      detail: book.renewalsDue.map((c) => c.name).join(', ') + '.',
      action: 'Start the conversation before they do.',
      tab: 'work',
      weight: 68,
    })
  }

  const pipe = pipeline(state, undefined, iso)
  const bills = billBook(state, undefined, iso)
  if (pipe.stale.length > 0) {
    push({
      id: 'stale-deals',
      severity: 'watch',
      title: `${pipe.stale.length} deal${pipe.stale.length === 1 ? '' : 's'} stopped moving.`,
      detail: `Nothing in ${STALE_DEAL_DAYS} days on ${pipe.stale
        .slice(0, 3)
        .map((d) => d.name)
        .join(', ')}${pipe.stale.length > 3 ? ' and others' : ''}.`,
      action: 'Give each one a next step with a date, or mark it lost and stop counting it.',
      tab: 'work',
      weight: 73,
    })
  }

  if (bills.monthly > 0 && pipe.weighted < bills.monthly * 3 && pipe.open.length >= 0) {
    push({
      id: 'thin-pipeline',
      severity: pipe.weighted < bills.monthly ? 'critical' : 'watch',
      title: 'The pipeline is thin against what you spend.',
      detail: `${euroCompact(pipe.weighted)} weighted against ${euroCompact(bills.monthly)} of monthly cost. Revenue is a lagging number; this is the one that warns you.`,
      action: 'Sales activity today, not this week. The pipeline reflects what you did ninety days ago.',
      tab: 'work',
      weight: 84,
    })
  }

  // ---------------------------------------------------------------- goals

  const goals = goalBoard(state, iso)
  if (goals.atRisk.length > 0) {
    const g = goals.atRisk[0]
    push({
      id: 'goal-risk',
      severity: 'watch',
      title: `“${g.goal.title}” is behind.`,
      detail: `${Math.round(g.pct)}% done with ${g.daysLeft !== null && g.daysLeft < 0 ? `${-g.daysLeft} days past its date` : `${g.daysLeft} days left`}.`,
      action: 'Move the date honestly or change what you are doing this week. Leaving it is the one option that costs you twice.',
      tab: 'goals',
      weight: 71,
    })
  }

  // ------------------------------------------------------------ standards

  const weak = weakestStandards(state)
  if (weak.length > 0 && weak[0].rate >= 40) {
    const w = weak[0]
    push({
      id: 'standard',
      severity: 'watch',
      title: `You drop “${w.label}” ${Math.round(w.rate)}% of the time.`,
      detail: `Missed ${w.missed} of ${w.logged} logged days, at ${w.points} point${w.points === 1 ? '' : 's'} a day — the most expensive standard you are losing.`,
      action: 'One standard, for a fortnight. Trying to fix four at once is how none of them get fixed.',
      tab: 'today',
      weight: 66,
    })
  }

  const signals = breakdownSignals(state)
  if (signals.length > 0) {
    const s = signals[0]
    push({
      id: 'breakdown-signal',
      severity: 'watch',
      title: `${s.label} is what separates your good days from your bad ones.`,
      detail: `${num(s.winning, s.dp)}${s.unit ? ` ${s.unit}` : ''} on winning days against ${num(s.losing, s.dp)}${s.unit ? ` ${s.unit}` : ''} on days under 50.`,
      action: 'Correlation, not cause — but it is the first place to look.',
      tab: 'patterns',
      weight: 64,
    })
  }

  const weekdays = weekdayScores(state).filter((w) => w.days >= 3)
  if (weekdays.length >= 5) {
    const worst = [...weekdays].sort((a, b) => a.avg - b.avg)[0]
    const best = [...weekdays].sort((a, b) => b.avg - a.avg)[0]
    if (best.avg - worst.avg >= 20) {
      push({
        id: 'weekday',
        severity: 'watch',
        title: `${worst.label} is your weakest day.`,
        detail: `${Math.round(worst.avg)} average against ${Math.round(best.avg)} on ${best.label}.`,
        action: `Plan ${worst.label} the night before, or stop pretending it is a working day.`,
        tab: 'patterns',
        weight: 58,
      })
    }
  }

  // ------------------------------------------------------------ the branch

  const scores = domainScores(state, iso)
  const branches = state.domains
    .map((d) => ({ node: d, s: scores.get(d.id) }))
    .filter((b) => b.s?.score !== null && b.s !== undefined && b.node.parentId !== '')
    .filter((b) => (b.node.checkIds.length > 0 || b.node.metricKeys.length > 0))
  if (branches.length > 0) {
    const worst = branches.sort((a, b) => (a.s!.score ?? 0) - (b.s!.score ?? 0))[0]
    if ((worst.s!.score ?? 0) < 50) {
      push({
        id: 'branch',
        severity: 'watch',
        title: `${worst.node.label} is the weakest branch of your map.`,
        detail: `Scoring ${Math.round(worst.s!.score ?? 0)} over the last 28 days${worst.s!.loopHits > 0 ? `, with ${worst.s!.loopHits} loop hits under it` : ''}.`,
        action: 'Open it and check what feeds it. A weak branch is usually one missing habit, not four.',
        tab: 'map',
        weight: 62,
      })
    }
  }

  // ------------------------------------------------------------- the rest

  const queue = taskQueue(state, iso)
  if (queue.overdue.length >= 3) {
    push({
      id: 'overdue-tasks',
      severity: 'watch',
      title: `${queue.overdue.length} tasks are past their date.`,
      detail: 'A list you have stopped believing stops working as a list.',
      action: 'Clear them or re-date them. Both are honest; leaving them is not.',
      tab: 'work',
      weight: 60,
    })
  }

  const due = contactsDue(state, iso)
  if (due.length > 0) {
    push({
      id: 'contacts',
      severity: 'watch',
      title: `${due.length} ${due.length === 1 ? 'person has' : 'people have'} gone quiet.`,
      detail: due
        .slice(0, 3)
        .map((c) => c.name)
        .join(', ') + (due.length > 3 ? ' and others.' : '.'),
      action: 'One message each. Relationships decay silently and expensively.',
      tab: 'network',
      weight: 56,
    })
  }

  const learn = learnStats(state)
  if (learn.unapplied >= 3) {
    push({
      id: 'lessons',
      severity: 'watch',
      title: `${learn.unapplied} lessons captured and never applied.`,
      detail: `${learn.applied} of ${learn.lessons} have actually changed something.`,
      action: 'Pick one and do it this week. A lesson with no action is a highlight.',
      tab: 'learn',
      weight: 52,
    })
  }

  // --------------------------------------------------------- what is working

  const streak = currentStreak(state, iso)
  if (streak >= 3) {
    push({
      id: 'streak',
      severity: 'good',
      title: `${streak} winning days in a row.`,
      detail: 'Scoring 80 or better, unbroken.',
      weight: 40,
    })
  }

  if (osc.enough && osc.drift >= 4) {
    push({
      id: 'rising',
      severity: 'good',
      title: `Your mean is up ${Math.round(osc.drift)} points.`,
      detail: 'The cycle still swings, but around a higher centre than it started at. That is the only progress that survives a bad week.',
      weight: 45,
    })
  }

  if (run.daysPlanned >= 7 && run.oneThingRate >= 70) {
    push({
      id: 'one-thing-good',
      severity: 'good',
      title: `Your one thing lands ${Math.round(run.oneThingRate)}% of the time.`,
      detail: `${run.oneThingHit} of ${run.daysPlanned} planned days.`,
      weight: 42,
    })
  }

  const sheet = balanceSheet(state)
  if (sheet.itemised && sheet.net > 0) {
    push({
      id: 'networth',
      severity: 'good',
      title: `Net worth is ${euroCompact(sheet.net)}.`,
      detail: `${euroCompact(sheet.assets)} owned against ${euroCompact(sheet.liabilities)} owed, ${euroCompact(sheet.liquid)} of it reachable this week.`,
      weight: 38,
    })
  }

  const byWeight = (a: Finding, b: Finding) => b.weight - a.weight
  const critical = out.filter((f) => f.severity === 'critical').sort(byWeight)
  const watch = out.filter((f) => f.severity === 'watch').sort(byWeight)
  const good = out.filter((f) => f.severity === 'good').sort(byWeight)

  return {
    headline: critical[0] ?? watch[0] ?? null,
    critical,
    watch,
    good,
    days: logged.length,
    // A briefing off three days is a horoscope.
    thin: logged.length < 7,
  }
}

/**
 * The score of every checklist standard over a window, for the overview chart.
 * Separate from `weakestStandards` because that ranks by cost and this one
 * needs the raw rate in checklist order.
 */
export function standardRates(state: AppState, iso = todayISO(), window = 28) {
  const dates: string[] = []
  for (let i = 0; i < window; i++) dates.push(addDays(iso, -i))
  const days = dates.map((d) => state.days[d]).filter(isLogged)
  if (days.length === 0) return []
  return state.checklist.map((item) => ({
    id: item.id,
    label: item.label,
    pillar: item.pillar,
    rate:
      (days.filter((d) => {
        // Local import would be circular; the selector is re-derived here.
        const target = state.targets[item.metric as keyof AppState['targets']] as number
        if (!item.metric) return Boolean(d.checks[item.id])
        const v = d.metrics[item.metric]
        return item.invert ? v <= target : v >= target
      }).length /
        days.length) *
      100,
  }))
}
