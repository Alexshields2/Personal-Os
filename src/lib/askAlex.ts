/**
 * Ask Alex — question matching, not a language model.
 *
 * This is the honest version of "talk to Alex" until a real model is wired
 * in: a fixed set of questions, each backed by a selector that already exists,
 * matched by keyword. It can only answer what it was built to answer, and it
 * says so when nothing matches, rather than guessing at an open-ended prompt
 * the way a model would.
 *
 * Wiring in an actual LLM (for open-ended questions, and to read the journal
 * and constraint answers) needs an API key from you — see the note surfaced
 * in the panel itself.
 */

import { PURSE_LABEL } from './config'
import { todayISO } from './date'
import { euro, euroCompact, num } from './format'
import {
  balanceSheet,
  billBook,
  clientBook,
  currentStreak,
  dueOverview,
  invoiceBook,
  loopStats,
  monthToDate,
  oscillation,
  pipeline,
  planStatus,
  priorityRun,
  runway,
  taskQueue,
  weakestStandards,
} from './selectors'
import { emptyDay } from './store'
import type { AppState } from './types'

export interface AskAnswer {
  text: string
  tab?: string
}

interface Rule {
  id: string
  /** Any of these appearing in the question is enough to match. */
  keywords: string[]
  ask: string
  answer: (state: AppState, iso: string) => AskAnswer
}

const RULES: Rule[] = [
  {
    id: 'runway',
    keywords: ['runway', 'how long', 'cash last'],
    ask: 'How long does the cash last?',
    answer: (state) => {
      const rows = (['consulting', 'onemedia', 'personal'] as const).map((p) => {
        const r = runway(state, p)
        return `${PURSE_LABEL[p]}: ${r.known ? `${num(r.months, 1)} months` : 'no bills recorded'}`
      })
      return { text: rows.join('\n'), tab: 'money' }
    },
  },
  {
    id: 'onethign',
    keywords: ['one thing', 'today', 'plan today'],
    ask: "What's today's one thing?",
    answer: (state, iso) => {
      const day = state.days[iso] ?? emptyDay(iso)
      const plan = planStatus(day)
      return {
        text: plan.oneThing
          ? `“${plan.oneThing.text}”${plan.oneThingDone ? ' — already done.' : ' — not done yet.'}`
          : 'Nothing set yet. Open Today and write it down.',
        tab: 'today',
      }
    },
  },
  {
    id: 'onethingrate',
    keywords: ['hit rate', 'how often', 'one thing land'],
    ask: 'How often does the one thing actually land?',
    answer: (state, _iso) => {
      const run = priorityRun(state)
      return {
        text: run.daysPlanned
          ? `${Math.round(run.oneThingRate)}% — ${run.oneThingHit} of ${run.daysPlanned} planned days.`
          : 'No planned days logged yet.',
        tab: 'patterns',
      }
    },
  },
  {
    id: 'streak',
    keywords: ['streak', 'winning days', 'row'],
    ask: "What's the current streak?",
    answer: (state, iso) => {
      const s = currentStreak(state, iso)
      return { text: s > 0 ? `${s} winning days in a row.` : 'No streak running right now.' }
    },
  },
  {
    id: 'mean',
    keywords: ['which version', 'building or breaking', 'mean state', 'oscillat'],
    ask: 'Which version of me is running?',
    answer: (state, iso) => {
      const osc = oscillation(state, iso)
      if (!osc.enough) return { text: 'Needs about two weeks of logged days before this means anything.' }
      return {
        text: `${osc.current?.kind === 'build' ? 'Building' : 'Breaking'}, day ${osc.current?.days}. Mean state ${Math.round(osc.mean)}, ${osc.drift >= 0 ? 'rising' : 'falling'} ${Math.round(Math.abs(osc.drift))}.`,
        tab: 'patterns',
      }
    },
  },
  {
    id: 'loop',
    keywords: ['loop', 'pattern', 'keep happening', 'worst habit'],
    ask: "What's my worst loop right now?",
    answer: (state, iso) => {
      const stats = loopStats(state, iso).filter((l) => l.count > 0)
      if (stats.length === 0) return { text: 'No loops tagged yet.' }
      const worst = stats[0]
      return {
        text: `“${worst.loop.label}” — ${Math.round(worst.rate)}% of logged days${worst.trend === 'rising' ? ', getting worse' : worst.trend === 'falling' ? ', easing off' : ''}.`,
        tab: 'patterns',
      }
    },
  },
  {
    id: 'standard',
    keywords: ['drop most', 'weakest standard', 'what am i missing'],
    ask: 'Which standard do I drop most?',
    answer: (state) => {
      const weak = weakestStandards(state)
      if (weak.length === 0) return { text: 'Not enough logged days yet.' }
      return { text: `“${weak[0].label}” — missed ${Math.round(weak[0].rate)}% of the time.`, tab: 'patterns' }
    },
  },
  {
    id: 'due',
    keywords: ['due', 'owed', 'coming in', 'confidence'],
    ask: "What's due, and how sure am I of it?",
    answer: (state, iso) => {
      const due = dueOverview(state, undefined, iso)
      return {
        text: `Guaranteed ${euroCompact(due.byConfidence.guaranteed)}, likely ${euroCompact(due.byConfidence.likely)}, needs a push ${euroCompact(due.byConfidence.needsPush)}.`,
        tab: 'work',
      }
    },
  },
  {
    id: 'overdue',
    keywords: ['overdue', 'late invoice', 'chase'],
    ask: 'What invoices are overdue?',
    answer: (state, iso) => {
      const book = invoiceBook(state, undefined, iso)
      return {
        text: book.overdue.length
          ? `${book.overdue.length} invoice${book.overdue.length === 1 ? '' : 's'}, ${euroCompact(book.overdueValue)} total.`
          : 'Nothing overdue.',
        tab: 'money',
      }
    },
  },
  {
    id: 'stale',
    keywords: ['stale deal', 'stopped moving', 'push forward'],
    ask: "What's stopped moving in the pipeline?",
    answer: (state, iso) => {
      const stale = pipeline(state, undefined, iso).stale
      return {
        text: stale.length
          ? stale.map((d) => d.name).join(', ')
          : 'Nothing has stalled.',
        tab: 'work',
      }
    },
  },
  {
    id: 'month',
    keywords: ['this month', 'month so far', 'net this month'],
    ask: 'How does this month look?',
    answer: (state, iso) => {
      const c = monthToDate(state, 'consulting', iso)
      const m = monthToDate(state, 'onemedia', iso)
      return {
        text: `Consulting.ie: ${euro(c.net)} net. 1Media: ${euro(m.net)} net.`,
        tab: 'money',
      }
    },
  },
  {
    id: 'concentration',
    keywords: ['concentration', 'biggest client', 'exposed'],
    ask: 'How exposed am I to one client?',
    answer: (state) => {
      const book = clientBook(state)
      return {
        text: book.active.length
          ? `Largest client is ${Math.round(book.concentration)}% of ${euroCompact(book.mrr)} MRR.`
          : 'No active clients recorded.',
        tab: 'work',
      }
    },
  },
  {
    id: 'networth',
    keywords: ['net worth', 'worth'],
    ask: "What's net worth?",
    answer: (state) => {
      const sheet = balanceSheet(state)
      return {
        text: `${euroCompact(sheet.net)}${sheet.itemised ? ` — ${euroCompact(sheet.liquid)} of it liquid.` : ' (manual figure — itemise in Money for a calculated one).'}`,
        tab: 'money',
      }
    },
  },
  {
    id: 'bills',
    keywords: ['bills', 'going out', 'monthly cost', 'burn'],
    ask: "What's going out every month?",
    answer: (state) => {
      const book = billBook(state)
      return { text: `${euro(book.monthly)} a month, ${euro(book.annual)} a year.`, tab: 'money' }
    },
  },
  {
    id: 'openwork',
    keywords: ['open task', 'overdue task', 'what needs doing'],
    ask: 'What tasks are overdue?',
    answer: (state, iso) => {
      const q = taskQueue(state, iso)
      return {
        text: q.overdue.length
          ? q.overdue.map((t) => t.title).join(', ')
          : 'Nothing overdue.',
        tab: 'work',
      }
    },
  },
]

export function askableQuestions(): string[] {
  return RULES.map((r) => r.ask)
}

export function askAlex(state: AppState, question: string, iso = todayISO()): AskAnswer {
  const q = question.toLowerCase()
  const rule = RULES.find((r) => r.keywords.some((k) => q.includes(k)))
  if (rule) return rule.answer(state, iso)
  return {
    text:
      "That's not one of the questions Alex can answer yet — it matches keywords against a fixed list, not a language model. Try one from the list, or ask in Settings for this to be wired to a real model.",
  }
}
