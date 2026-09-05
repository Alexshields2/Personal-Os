import type { LearnItem, Loop, MetricKey, PriorityTag, Targets } from './types'

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

export const DEFAULT_LEARNING: LearnItem[] = [
  {
    id: 'b1',
    kind: 'book',
    title: 'Reality Transurfing',
    source: 'Vadim Zeland',
    status: 'active',
    date: '',
    notes: '',
    lessons: [],
  },
  {
    id: 'b2',
    kind: 'book',
    title: 'How to Win Friends and Influence People',
    source: 'Dale Carnegie',
    status: 'queued',
    date: '',
    notes: '',
    lessons: [],
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
  inner: 'Inner circle',
  connected: 'Connected',
  reachedOut: 'Reached out',
  target: 'Target',
}

/** Sensible starting cadences, in days. 0 is "no cadence". */
export const CADENCE_OPTIONS = [0, 7, 14, 30, 90]

export function cadenceLabel(days: number): string {
  if (days <= 0) return 'No cadence'
  if (days === 7) return 'Weekly'
  if (days === 14) return 'Fortnightly'
  if (days === 30) return 'Monthly'
  if (days === 90) return 'Quarterly'
  return `Every ${days} days`
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

// --------------------------------------------------------------- daily plan

/** The three slots are the discipline; the rest is overflow for a heavy day. */
export const CORE_PRIORITIES = 3
export const MAX_PRIORITIES = 6

export const PRIORITY_TAGS: { id: PriorityTag; label: string }[] = [
  { id: 'acmr', label: 'ACMR' },
  { id: 'onemedia', label: '1Media' },
  { id: 'life', label: 'Life' },
]

export const PRIORITY_TAG_LABEL: Record<PriorityTag, string> = {
  acmr: 'ACMR',
  onemedia: '1Media',
  life: 'Life',
}

/** Rank labels for the first three slots. Slot 1 is the day's one thing. */
export const PRIORITY_RANK = ['The one thing', 'Second', 'Third']

/** Dropped in when a plan is started from scratch. Edit or delete freely. */
export const DEFAULT_BLOCKS: { start: string; end: string; label: string; tag: PriorityTag }[] = [
  { start: '07:00', end: '09:00', label: 'Morning routine + gym', tag: 'life' },
  { start: '09:00', end: '12:00', label: 'Deep work — the one thing', tag: 'acmr' },
  { start: '13:00', end: '17:00', label: 'Client work + sales', tag: 'acmr' },
  { start: '17:00', end: '19:00', label: '1Media', tag: 'onemedia' },
  { start: '21:00', end: '21:30', label: 'Shutdown + tomorrow’s plan', tag: 'life' },
]

/**
 * The end-of-day ritual. Unscored, like MORNING — it closes the day rather
 * than grading it. `derived` items are ticked by the app, not by hand.
 */
export const SHUTDOWN: { id: string; label: string; hint?: string; derived?: boolean }[] = [
  { id: 's_logged', label: 'Day logged honestly', hint: 'The numbers above, as they actually were' },
  { id: 's_inbox', label: 'Inbox and messages cleared' },
  { id: 's_tomorrow', label: 'Tomorrow’s three are set', derived: true, hint: 'Filled in below' },
  { id: 's_desk', label: 'Desk clear, laptop shut' },
]

export const ENERGY_LABEL = ['', 'Empty', 'Low', 'Steady', 'Strong', 'Peak']

// ------------------------------------------------------------------ learning

export const LEARN_KIND_LABEL: Record<string, string> = {
  book: 'Book',
  course: 'Course',
  event: 'Event',
}

export const LEARN_STATUS_LABEL: Record<string, string> = {
  queued: 'Queued',
  active: 'In progress',
  done: 'Finished',
}

// --------------------------------------------------------------------- loops

/**
 * Starting set of failure patterns. Free-text mistakes can't be counted, so a
 * loop has to be a thing you pick rather than a thing you write — that's what
 * makes the pattern detection possible at all. Edit the list to match the ones
 * that are actually yours; a generic loop never gets ticked.
 */
export const DEFAULT_LOOPS: Loop[] = [
  {
    id: 'l_avoid',
    label: 'Avoided the hard thing',
    note: 'Did everything except the one thing',
    archived: false,
  },
  { id: 'l_noplan', label: 'Started the day without a plan', note: '', archived: false },
  {
    id: 'l_reactive',
    label: 'Let other people set the agenda',
    note: 'Inbox and phone ran the day',
    archived: false,
  },
  {
    id: 'l_busywork',
    label: 'Busywork instead of revenue',
    note: 'Felt productive, moved nothing',
    archived: false,
  },
  {
    id: 'l_perfection',
    label: 'Polished instead of shipped',
    note: '',
    archived: false,
  },
  { id: 'l_scroll', label: 'Scrolled to escape', note: '', archived: false },
  {
    id: 'l_numb',
    label: 'Numbed out',
    note: 'Drink, porn, food — whichever it was',
    archived: false,
  },
  { id: 'l_latenight', label: 'Late night, wrecked the morning', note: '', archived: false },
  {
    id: 'l_overcommit',
    label: 'Said yes when I meant no',
    note: '',
    archived: false,
  },
  { id: 'l_isolate', label: 'Withdrew from people', note: '', archived: false },
]

// --------------------------------------------------------- nightly questions

export interface Question {
  id: string
  q: string
  hint?: string
}

/** Asked every night. Four is the most that gets answered honestly. */
export const CORE_QUESTIONS: Question[] = [
  { id: 'q_moved', q: 'What actually moved the needle today?', hint: 'Outcome, not activity' },
  { id: 'q_avoided', q: 'What did I avoid — and what was I really avoiding?' },
  { id: 'q_cost', q: 'What did today cost me?', hint: 'Time, money, energy, trust' },
  { id: 'q_apply', q: 'What do I do differently tomorrow because of today?' },
]

/**
 * One deeper question per weekday, so the reflection can't go on autopilot.
 * Indexed by `Date.getDay()` — Sunday first.
 */
export const ROTATING_QUESTIONS: Question[] = [
  { id: 'q_sun', q: 'What pattern showed up more than once this week?' },
  { id: 'q_mon', q: 'What am I pretending not to know?' },
  { id: 'q_tue', q: 'Who did I make progress for besides myself?' },
  { id: 'q_wed', q: 'If today repeated for a year, where would I end up?' },
  { id: 'q_thu', q: 'What am I doing that someone else should be doing?' },
  { id: 'q_fri', q: 'What did I say I would do and not do?' },
  { id: 'q_sat', q: 'What would the version of me I am building have done differently?' },
]
