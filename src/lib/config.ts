import type { MetricKey, Targets } from './types'

export const PROTOCOL_DAYS = 126

export const DEFAULT_TARGETS: Targets = {
  acmrHours: 10,
  calories: 3000,
  protein: 180,
  creatine: 5,
  waterL: 3.5,
  steps: 10000,
  sleepHours: 8,
  pagesRead: 20,
  mobilityMin: 10,
  journalMin: 10,
  goalReviewMin: 10,
  socialMin: 30,
  bonusPool: 10_000_000,
  personalPayout: 1_000_000,
  bodyweightKg: 95,
  netWorth: 5_000_000,
}

export type PillarId = 'business' | 'body' | 'mind' | 'discipline'

export const PILLARS: { id: PillarId; label: string; points: number }[] = [
  { id: 'business', label: 'Business', points: 30 },
  { id: 'body', label: 'Body', points: 30 },
  { id: 'mind', label: 'Mind', points: 20 },
  { id: 'discipline', label: 'Discipline', points: 20 },
]

export interface ChecklistItem {
  id: string
  label: string
  pillar: PillarId
  points: number
  /** When set, ticking is driven by the metric hitting its target. */
  metric?: MetricKey
  /** Metric target is a ceiling to stay under rather than a floor to clear. */
  invert?: boolean
  hint?: string
}

/** Points per pillar sum to that pillar's allocation; all four sum to 100. */
export const CHECKLIST: ChecklistItem[] = [
  // Business — 30
  {
    id: 'acmr_hours',
    label: '10 hours in office',
    pillar: 'business',
    points: 14,
    metric: 'acmrHours',
    hint: 'or recovery day',
  },
  { id: 'measurable', label: 'Measurable progress produced', pillar: 'business', points: 6 },
  { id: 'sales_activity', label: 'Sales / revenue activity done', pillar: 'business', points: 4 },
  { id: 'highest_first', label: 'Highest-value task first', pillar: 'business', points: 3 },
  { id: 'client_work', label: 'Important client work done', pillar: 'business', points: 2 },
  { id: 'bottlenecks', label: 'Team bottlenecks removed', pillar: 'business', points: 1 },

  // Body — 30
  { id: 'training', label: 'Trained or active recovery', pillar: 'body', points: 6 },
  { id: 'calories', label: 'Calorie target', pillar: 'body', points: 4, metric: 'calories' },
  { id: 'protein', label: 'Protein target', pillar: 'body', points: 4, metric: 'protein' },
  { id: 'sleep', label: 'Sleep target', pillar: 'body', points: 4, metric: 'sleepHours' },
  { id: 'steps', label: 'Steps', pillar: 'body', points: 4, metric: 'steps' },
  { id: 'water', label: 'Water', pillar: 'body', points: 3, metric: 'waterL' },
  { id: 'creatine', label: 'Creatine', pillar: 'body', points: 2, metric: 'creatine' },
  { id: 'mobility', label: 'Mobility / posture', pillar: 'body', points: 2, metric: 'mobilityMin' },
  { id: 'grooming', label: 'Skincare / grooming', pillar: 'body', points: 1 },

  // Mind — 20
  { id: 'reading', label: 'Read 20 pages', pillar: 'mind', points: 6, metric: 'pagesRead' },
  { id: 'journal', label: 'Journal', pillar: 'mind', points: 4, metric: 'journalMin' },
  {
    id: 'goal_review',
    label: 'Goal review / visualisation',
    pillar: 'mind',
    points: 4,
    metric: 'goalReviewMin',
  },
  { id: 'notes', label: 'Took notes', pillar: 'mind', points: 3 },
  { id: 'learned', label: 'Learned something applicable', pillar: 'mind', points: 3 },

  // Discipline — 20
  { id: 'disappeared', label: 'Stayed disappeared', pillar: 'discipline', points: 3 },
  { id: 'no_alcohol', label: 'No alcohol', pillar: 'discipline', points: 3 },
  { id: 'no_drugs', label: 'No recreational drugs', pillar: 'discipline', points: 3 },
  { id: 'no_porn', label: 'No porn', pillar: 'discipline', points: 3 },
  {
    id: 'no_scrolling',
    label: 'Recreational scrolling under 30 min',
    pillar: 'discipline',
    points: 2,
    metric: 'socialMin',
    invert: true,
  },
  { id: 'no_spending', label: 'No unnecessary spending', pillar: 'discipline', points: 2 },
  { id: 'no_posting', label: 'No progress posting', pillar: 'discipline', points: 2 },
  { id: 'phone_away', label: 'Phone away during deep work', pillar: 'discipline', points: 1 },
  { id: 'promises', label: 'Kept promises', pillar: 'discipline', points: 1 },
]

/** Ritual, not scored — it sets the day up rather than grading it. */
export const MORNING: { id: string; label: string }[] = [
  { id: 'm_wake', label: 'Woke on time' },
  { id: 'm_water', label: 'Water' },
  { id: 'm_breakfast', label: 'Breakfast' },
  { id: 'm_creatine', label: 'Creatine' },
  { id: 'm_goals', label: 'Reviewed goals' },
  { id: 'm_noscroll', label: 'No morning scrolling' },
]

export interface MetricSpec {
  key: MetricKey
  label: string
  unit: string
  step: number
  /** Decimal places for display and rounding. */
  dp: number
  invert?: boolean
}

export const METRICS: MetricSpec[] = [
  { key: 'acmrHours', label: 'ACMR hours', unit: 'h', step: 0.5, dp: 1 },
  { key: 'calories', label: 'Calories', unit: 'kcal', step: 50, dp: 0 },
  { key: 'protein', label: 'Protein', unit: 'g', step: 10, dp: 0 },
  { key: 'creatine', label: 'Creatine', unit: 'g', step: 1, dp: 0 },
  { key: 'waterL', label: 'Water', unit: 'L', step: 0.25, dp: 2 },
  { key: 'steps', label: 'Steps', unit: '', step: 500, dp: 0 },
  { key: 'sleepHours', label: 'Sleep', unit: 'h', step: 0.25, dp: 2 },
  { key: 'pagesRead', label: 'Pages read', unit: '', step: 5, dp: 0 },
  { key: 'mobilityMin', label: 'Mobility', unit: 'min', step: 5, dp: 0 },
  { key: 'journalMin', label: 'Journal', unit: 'min', step: 5, dp: 0 },
  { key: 'goalReviewMin', label: 'Goal review', unit: 'min', step: 5, dp: 0 },
  { key: 'socialMin', label: 'Social media', unit: 'min', step: 5, dp: 0, invert: true },
]

export const METRIC_BY_KEY = Object.fromEntries(METRICS.map((m) => [m.key, m])) as Record<
  MetricKey,
  MetricSpec
>

/**
 * The 126-day totals. `perDay` multiplies the daily target; `fixed` is a flat
 * count that isn't a daily metric (workouts, weekends).
 */
export interface CompoundSpec {
  id: string
  label: string
  unit: string
  target: number
  /** How to derive the running total from logged days. */
  source:
    | { type: 'metric'; key: MetricKey; scale?: number }
    | { type: 'workouts' }
    | { type: 'weekends' }
    | { type: 'cleanDays' }
  invert?: boolean
  note?: string
}

export const COMPOUNDING: CompoundSpec[] = [
  {
    id: 'acmr',
    label: 'ACMR hours',
    unit: 'h',
    target: 1080,
    source: { type: 'metric', key: 'acmrHours' },
    note: '10h × 6 days × 18 weeks',
  },
  { id: 'workouts', label: 'Workouts', unit: '', target: 108, source: { type: 'workouts' } },
  {
    id: 'steps',
    label: 'Steps',
    unit: '',
    target: 1_000_000,
    source: { type: 'metric', key: 'steps' },
    note: 'Stretch: 1,260,000',
  },
  {
    id: 'sleep',
    label: 'Sleep',
    unit: 'h',
    target: 1008,
    source: { type: 'metric', key: 'sleepHours' },
  },
  {
    id: 'protein',
    label: 'Protein',
    unit: 'kg',
    target: 22.68,
    source: { type: 'metric', key: 'protein', scale: 0.001 },
    note: '180g/day',
  },
  {
    id: 'water',
    label: 'Water',
    unit: 'L',
    target: 441,
    source: { type: 'metric', key: 'waterL' },
  },
  {
    id: 'creatine',
    label: 'Creatine',
    unit: 'g',
    target: 630,
    source: { type: 'metric', key: 'creatine' },
  },
  {
    id: 'reading',
    label: 'Pages read',
    unit: '',
    target: 2520,
    source: { type: 'metric', key: 'pagesRead' },
    note: '20 pages × 126 days',
  },
  {
    id: 'journal',
    label: 'Journaling',
    unit: 'h',
    target: 21,
    source: { type: 'metric', key: 'journalMin', scale: 1 / 60 },
  },
  {
    id: 'mobility',
    label: 'Mobility',
    unit: 'h',
    target: 21,
    source: { type: 'metric', key: 'mobilityMin', scale: 1 / 60 },
  },
  {
    id: 'goalreview',
    label: 'Goal review',
    unit: 'h',
    target: 21,
    source: { type: 'metric', key: 'goalReviewMin', scale: 1 / 60 },
  },
  {
    id: 'social',
    label: 'Social media',
    unit: 'h',
    target: 63,
    source: { type: 'metric', key: 'socialMin', scale: 1 / 60 },
    invert: true,
    note: 'Ceiling, not a goal',
  },
  {
    id: 'weekends',
    label: 'Weekends protected',
    unit: '',
    target: 18,
    source: { type: 'weekends' },
  },
  { id: 'clean', label: 'Clean days', unit: '', target: 126, source: { type: 'cleanDays' } },
]

/** Every one of these must hold for a day to count as clean. */
export const CLEAN_IDS = ['no_alcohol', 'no_drugs', 'no_porn', 'no_posting', 'disappeared']

export const INNER_CIRCLE = [
  'Bella',
  'Mam',
  'Dad',
  'Cian',
  'Mac',
  'Richard',
  'Office / team',
  'Clients',
  'Prospects',
]

export const DEFAULT_BOOKS = [
  { id: 'b1', title: 'Reality Transurfing', status: 'reading' as const, notes: '' },
  {
    id: 'b2',
    title: 'How to Win Friends and Influence People',
    status: 'queued' as const,
    notes: '',
  },
]

export const DEFAULT_REWARDS = [
  { id: 'r1', label: 'Porsche Taycan', detail: 'Bought only once €1M has actually landed' },
  { id: 'r2', label: 'Black Rolex Submariner', detail: 'Same rule. Received, not projected' },
]

export const MILESTONES = [
  { day: 1, label: 'Normal' },
  { day: 30, label: 'Routine established' },
  { day: 60, label: 'Visible progress' },
  { day: 90, label: 'Significant difference' },
  { day: 126, label: 'Undeniable' },
]

export const ENTITY_LABEL: Record<string, string> = {
  acmr: 'ACMR',
  onemedia: '1Media',
}

export const ACCOUNT_LABEL: Record<string, string> = {
  acmrBank: 'ACMR bank',
  onemediaBank: '1Media bank',
  personalBank: 'Personal bank',
  netWorth: 'Net worth',
}

export const CONNECTION_LABEL: Record<string, string> = {
  target: 'Target',
  reachedOut: 'Reached out',
  connected: 'Connected',
}

export const DEFAULT_UPKEEP = [
  { id: 'u1', label: 'Haircut', intervalDays: 14, lastDone: '' },
  { id: 'u2', label: 'Progress photos', intervalDays: 7, lastDone: '' },
]

export const DEFAULT_GOALS = [
  {
    id: 'g1',
    title: '€10M in the ACMR bank',
    note: 'The scoreboard the 1,080 hours point at',
    due: '',
    done: false,
  },
  {
    id: 'g2',
    title: '€1M personal payout received',
    note: 'Received, not invoiced. Unlocks the rewards',
    due: '',
    done: false,
  },
  { id: 'g3', title: '95kg lean and muscular', note: 'Long-term physique target', due: '', done: false },
]

export const KIND_LABEL: Record<string, string> = {
  revenue: 'Revenue',
  cashCollected: 'Cash collected',
  profit: 'Profit',
  payout: 'Payout to me',
  expense: 'Expense',
}
