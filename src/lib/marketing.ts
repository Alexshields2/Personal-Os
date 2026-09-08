/**
 * The 100-day marketing execution tracker.
 *
 * One question, asked every working day: did we do the work? Inputs are what
 * we control and they alone drive the execution score. Outputs — leads,
 * pipeline, revenue — are recorded beside them but deliberately kept out of
 * that score, so a lucky week can never disguise a lazy one.
 *
 * Every campaign total is `daily target × 100`, derived rather than written
 * down twice, so editing a target can't leave the dashboard quietly wrong.
 */

import { fromISO, toISO } from './date'

export const MARKETING_DAYS = 100

// ---------------------------------------------------------------- the shape

/** Numeric inputs. Every one is capped at its target when scoring. */
export interface MarketingInputs {
  alexConn: number
  cianConn: number
  macConn: number
  richardConn: number
  alexOutreach: number
  coldEmails: number
  followUps: number
  valueReel: number
  btsReel: number
  alexPost: number
  cianPost: number
  macPost: number
  richardPost: number
  instagram: number
  tiktok: number
  youtube: number
  facebook: number
  companyLinkedin: number
  stories: number
  nurtureEmail: number
  engagements: number
}

export interface MarketingOutputs {
  paidLeads: number
  organicLeads: number
  outboundLeads: number
  meetingsBooked: number
  meetingsHeld: number
  proposalsSent: number
  pipelineCreated: number
  dealsWon: number
  revenueClosed: number
  cashCollected: number
}

export interface MarketingDay extends MarketingInputs, MarketingOutputs {
  /** The one non-numeric input. Counts as hit or missed, nothing between. */
  paidAds: boolean
}

export type InputKey = keyof MarketingInputs
export type OutputKey = keyof MarketingOutputs

export interface InputSpec {
  key: InputKey
  label: string
  short: string
  group: string
  target: number
}

/**
 * Order here is the order everywhere — the sheet's columns, the today form and
 * the score all read this one list, so a new input can never appear in two
 * places and be missing from a third.
 */
export const MARKETING_INPUTS: InputSpec[] = [
  { key: 'alexConn', label: 'Alex connections', short: 'Alex', group: 'LinkedIn connections', target: 25 },
  { key: 'cianConn', label: 'Cian connections', short: 'Cian', group: 'LinkedIn connections', target: 25 },
  { key: 'macConn', label: 'Mac connections', short: 'Mac', group: 'LinkedIn connections', target: 25 },
  { key: 'richardConn', label: 'Richard connections', short: 'Richard', group: 'LinkedIn connections', target: 25 },

  { key: 'alexOutreach', label: 'Alex high-value outreach', short: 'High-value', group: 'Outbound', target: 10 },
  { key: 'coldEmails', label: 'Cold emails sent', short: 'Cold email', group: 'Outbound', target: 1000 },
  { key: 'followUps', label: 'Follow-ups', short: 'Follow-up', group: 'Outbound', target: 100 },

  { key: 'valueReel', label: 'Value reel', short: 'Value', group: 'Content', target: 1 },
  { key: 'btsReel', label: 'BTS reel', short: 'BTS', group: 'Content', target: 1 },

  { key: 'alexPost', label: 'Alex post', short: 'Alex', group: 'Founder LinkedIn', target: 1 },
  { key: 'cianPost', label: 'Cian post', short: 'Cian', group: 'Founder LinkedIn', target: 1 },
  { key: 'macPost', label: 'Mac post', short: 'Mac', group: 'Founder LinkedIn', target: 1 },
  { key: 'richardPost', label: 'Richard post', short: 'Richard', group: 'Founder LinkedIn', target: 1 },

  { key: 'instagram', label: 'Instagram posts', short: 'Instagram', group: 'Company distribution', target: 2 },
  { key: 'tiktok', label: 'TikTok posts', short: 'TikTok', group: 'Company distribution', target: 2 },
  { key: 'youtube', label: 'YouTube posts / shorts', short: 'YouTube', group: 'Company distribution', target: 2 },
  { key: 'facebook', label: 'Facebook posts', short: 'Facebook', group: 'Company distribution', target: 2 },
  { key: 'companyLinkedin', label: 'Consulting.ie LinkedIn posts', short: 'LinkedIn', group: 'Company distribution', target: 2 },

  { key: 'stories', label: 'Consulting.ie Instagram stories', short: 'Stories', group: 'Stories', target: 5 },
  { key: 'nurtureEmail', label: 'Nurture email', short: 'Nurture', group: 'Email', target: 1 },
  { key: 'engagements', label: 'Strategic LinkedIn engagements', short: 'Engagements', group: 'Engagement', target: 20 },
]

export const MARKETING_OUTPUTS: { key: OutputKey; label: string; money?: boolean }[] = [
  { key: 'paidLeads', label: 'Paid leads' },
  { key: 'organicLeads', label: 'Organic leads' },
  { key: 'outboundLeads', label: 'Outbound leads' },
  { key: 'meetingsBooked', label: 'Meetings booked' },
  { key: 'meetingsHeld', label: 'Meetings held' },
  { key: 'proposalsSent', label: 'Proposals sent' },
  { key: 'pipelineCreated', label: 'Pipeline created', money: true },
  { key: 'dealsWon', label: 'Deals won' },
  { key: 'revenueClosed', label: 'Revenue closed', money: true },
  { key: 'cashCollected', label: 'Cash collected', money: true },
]

/** The campaign-level bars. Targets are derived, never typed twice. */
export const MARKETING_ROLLUPS: { id: string; label: string; keys: InputKey[] }[] = [
  { id: 'linkedin', label: 'LinkedIn connections', keys: ['alexConn', 'cianConn', 'macConn', 'richardConn'] },
  { id: 'outreach', label: 'Dream outreach', keys: ['alexOutreach'] },
  { id: 'email', label: 'Cold email', keys: ['coldEmails'] },
  { id: 'followups', label: 'Follow-ups', keys: ['followUps'] },
  { id: 'content', label: 'Core content', keys: ['valueReel', 'btsReel'] },
  { id: 'distribution', label: 'Content distribution', keys: ['instagram', 'tiktok', 'youtube', 'facebook', 'companyLinkedin'] },
  { id: 'founder', label: 'Founder LinkedIn', keys: ['alexPost', 'cianPost', 'macPost', 'richardPost'] },
  { id: 'stories', label: 'Stories', keys: ['stories'] },
  { id: 'nurture', label: 'Nurture emails', keys: ['nurtureEmail'] },
  { id: 'engagement', label: 'Strategic engagement', keys: ['engagements'] },
]

const TARGET_BY_KEY = Object.fromEntries(
  MARKETING_INPUTS.map((i) => [i.key, i.target]),
) as Record<InputKey, number>

/** Daily target for a rollup — the sum of the inputs feeding it. */
export function rollupDailyTarget(keys: InputKey[]): number {
  return keys.reduce((sum, k) => sum + TARGET_BY_KEY[k], 0)
}

/** What the whole 100 days should add up to. */
export function rollupCampaignTarget(keys: InputKey[]): number {
  return rollupDailyTarget(keys) * MARKETING_DAYS
}

export function emptyMarketingDay(): MarketingDay {
  const day = { paidAds: false } as MarketingDay
  for (const i of MARKETING_INPUTS) day[i.key] = 0
  for (const o of MARKETING_OUTPUTS) day[o.key] = 0
  return day
}

// -------------------------------------------------------------- the calendar

/** Monday to Friday only — the challenge is 100 *working* days. */
export function isWorkingDay(iso: string): boolean {
  const d = fromISO(iso).getDay()
  return d !== 0 && d !== 6
}

/** The next Mon-Fri strictly after `iso`. A challenge is committed to before it starts. */
export function nextWorkingDay(iso: string): string {
  const d = fromISO(iso)
  do {
    d.setDate(d.getDate() + 1)
  } while (!isWorkingDay(toISO(d)))
  return toISO(d)
}

/** The 100 working dates of the campaign, in order. Index 0 is day 1. */
export function workingDates(startDate: string, count = MARKETING_DAYS): string[] {
  const out: string[] = []
  const cursor = fromISO(startDate)
  while (out.length < count) {
    const iso = toISO(cursor)
    if (isWorkingDay(iso)) out.push(iso)
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

// ---------------------------------------------------------------- the score

export type ExecutionStatus = 'hit' | 'close' | 'missed'

export function executionStatus(pct: number): ExecutionStatus {
  if (pct >= 100) return 'hit'
  if (pct >= 75) return 'close'
  return 'missed'
}

/**
 * Actual over target, capped at 100% per input, then averaged.
 *
 * The cap is the whole point: 4,000 cold emails cannot paper over a day where
 * nobody posted. Every input carries equal weight for the same reason — this
 * measures whether the routine ran, not how much volume it moved.
 */
export function dayExecution(day: MarketingDay | undefined): number {
  if (!day) return 0
  let sum = 0
  for (const i of MARKETING_INPUTS) {
    sum += i.target > 0 ? Math.min(1, (day[i.key] || 0) / i.target) : 0
  }
  sum += day.paidAds ? 1 : 0
  return (sum / (MARKETING_INPUTS.length + 1)) * 100
}

/** A day counts as touched once anything at all is recorded against it. */
export function isMarketingLogged(day: MarketingDay | undefined): boolean {
  if (!day) return false
  if (day.paidAds) return true
  return (
    MARKETING_INPUTS.some((i) => (day[i.key] || 0) > 0) ||
    MARKETING_OUTPUTS.some((o) => (day[o.key] || 0) > 0)
  )
}

export function totalLeads(day: MarketingDay): number {
  return (day.paidLeads || 0) + (day.organicLeads || 0) + (day.outboundLeads || 0)
}
