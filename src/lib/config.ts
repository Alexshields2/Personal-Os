import type {
  AccountId,
  BillCadence,
  ChecklistItem,
  PillarId,
  Purse,
  ShapeBlock,
  Tracker,
  Vision,
  DealStage,
  Goal,
  GoalHorizon,
  DomainLink,
  DomainNode,
  LearnItem,
  Loop,
  MetricKey,
  OutreachStage,
  PriorityTag,
  Targets,
} from './types'

export const PROTOCOL_DAYS = 126

export const DEFAULT_TARGETS: Targets = {
  consultingHours: 10,
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
  dailyCapacityMin: 480,
  protocolDays: PROTOCOL_DAYS,
}

export const PILLARS: { id: PillarId; label: string; points: number }[] = [
  { id: 'business', label: 'Business', points: 30 },
  { id: 'body', label: 'Body', points: 30 },
  { id: 'mind', label: 'Mind', points: 20 },
  { id: 'discipline', label: 'Discipline', points: 20 },
]

/**
 * Points per pillar summed to that pillar's allocation when this was a fixed
 * list; now that it's editable (`state.checklist`), this is only the seed a
 * fresh install starts from — the real total is whatever the checklist adds
 * up to, computed live in `scoreDay`.
 */
export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  // Business — 30
  {
    id: 'consulting_hours',
    label: '10 hours in office',
    pillar: 'business',
    points: 14,
    metric: 'consultingHours',
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
  { key: 'consultingHours', label: 'Consulting.ie hours', unit: 'h', step: 0.5, dp: 1 },
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
    id: 'consulting',
    label: 'Consulting.ie hours',
    unit: 'h',
    target: 1080,
    source: { type: 'metric', key: 'consultingHours' },
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
  'Caoimhe',
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
  consulting: 'Consulting.ie',
  onemedia: '1Media',
}

export const ACCOUNT_LABEL: Record<string, string> = {
  consultingBank: 'Consulting.ie bank',
  onemediaStripe: '1Media — Stripe',
  onemediaAib: '1Media — AIB business',
  onemediaRev: '1Media — Rev business',
  personalAib: 'Personal — AIB',
  personalRev: 'Personal — Rev',
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

export const GOAL_HORIZONS: { id: GoalHorizon; label: string; short: string }[] = [
  { id: 'life', label: 'Lifetime', short: 'Life' },
  { id: 'tenYear', label: 'Ten years', short: '10y' },
  { id: 'threeYear', label: 'Three years', short: '3y' },
  { id: 'year', label: 'This year', short: '1y' },
  { id: 'quarter', label: 'This quarter', short: 'Q' },
]

export const HORIZON_LABEL: Record<string, string> = Object.fromEntries(
  GOAL_HORIZONS.map((h) => [h.id, h.label]),
)

export const DEFAULT_GOALS: Goal[] = [
  {
    id: 'g1',
    parentId: '',
    horizon: 'tenYear',
    domainId: 'wealth',
    title: '€10M in the Consulting.ie bank',
    note: 'The scoreboard the 1,080 hours point at',
    due: '',
    done: false,
    keyResults: [
      {
        id: 'kr1',
        label: 'Consulting.ie bank balance',
        source: 'account',
        ref: 'consultingBank',
        target: 10_000_000,
        current: 0,
        unit: '€',
      },
    ],
  },
  {
    id: 'g2',
    parentId: 'g1',
    horizon: 'threeYear',
    domainId: 'capital',
    title: '€1M personal payout received',
    note: 'Received, not invoiced. Unlocks the rewards',
    due: '',
    done: false,
    keyResults: [
      {
        id: 'kr2',
        label: 'Payout received',
        source: 'ledger',
        ref: 'payout',
        target: 1_000_000,
        current: 0,
        unit: '€',
      },
    ],
  },
  {
    id: 'g3',
    parentId: '',
    horizon: 'threeYear',
    domainId: 'body',
    title: '95kg lean and muscular',
    note: 'Long-term physique target',
    due: '',
    done: false,
    keyResults: [],
  },
]

/** Where a business's day-to-day cash actually lands, by default. */
export const DEFAULT_ACCOUNT_FOR_ENTITY: Record<Purse, AccountId> = {
  consulting: 'consultingBank',
  onemedia: 'onemediaAib',
  personal: 'personalAib',
}

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
  { id: 'consulting', label: 'Consulting.ie' },
  { id: 'onemedia', label: '1Media' },
  { id: 'life', label: 'Life' },
]

export const PRIORITY_TAG_LABEL: Record<PriorityTag, string> = {
  consulting: 'Consulting.ie',
  onemedia: '1Media',
  life: 'Life',
}

/** Rank labels for the first three slots. Slot 1 is the day's one thing. */
export const PRIORITY_RANK = ['The one thing', 'Second', 'Third']

/**
 * Nothing here is enforced — this is only what a brand-new shape starts from,
 * a suggestion you're free to clear entirely. The real shape lives in
 * `state.dayShape`, and every start, end, label and block is yours to edit,
 * add or delete in Settings. No fixed 10-hour day, no fixed anything.
 */
export const STARTER_SHAPE: Omit<ShapeBlock, 'id'>[] = [
  { start: '07:00', end: '08:00', label: 'Morning routine', tag: 'life', kind: 'routine' },
  { start: '09:00', end: '12:00', label: 'Deep work', tag: 'consulting', kind: 'deep' },
  { start: '13:00', end: '17:00', label: 'Client work', tag: 'consulting', kind: 'calls' },
  { start: '17:00', end: '19:00', label: '1Media', tag: 'onemedia', kind: 'deep' },
  { start: '21:00', end: '21:30', label: 'Shutdown', tag: 'life', kind: 'shutdown' },
]

/** Kept for the older per-day editor, which still just wants start/end/label. */
export const DEFAULT_BLOCKS = STARTER_SHAPE

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

// ------------------------------------------------------------------ the map

/**
 * The life map. Four domains under one root, each broken down twice where the
 * breakdown earns its place. `checkIds` and `metricKeys` are what give a node a
 * score — a node with no bindings inherits from its children, and a leaf with
 * no bindings simply has no score rather than a fake one.
 */
export const DEFAULT_DOMAINS: DomainNode[] = [
  { id: 'root', parentId: '', label: 'Alex', note: 'Everything below rolls up here', loopIds: [], checkIds: [], metricKeys: [] },

  // ---- Health
  { id: 'health', parentId: 'root', label: 'Health', note: 'The base everything else runs on', loopIds: [], checkIds: [], metricKeys: [] },
  { id: 'body', parentId: 'health', label: 'Body', note: '', loopIds: [], checkIds: [], metricKeys: [] },
  { id: 'training', parentId: 'body', label: 'Training', note: '', loopIds: [], checkIds: ['training'], metricKeys: [] },
  { id: 'nutrition', parentId: 'body', label: 'Nutrition', note: '', loopIds: [], checkIds: [], metricKeys: ['calories', 'protein', 'creatine', 'waterL'] },
  { id: 'movement', parentId: 'body', label: 'Movement', note: 'Steps and mobility, outside the gym', loopIds: [], checkIds: [], metricKeys: ['steps', 'mobilityMin'] },
  { id: 'recovery', parentId: 'health', label: 'Recovery', note: 'The one that quietly decides the rest', loopIds: ['l_latenight'], checkIds: [], metricKeys: ['sleepHours'] },
  { id: 'appearance', parentId: 'health', label: 'Appearance', note: '', loopIds: [], checkIds: ['grooming'], metricKeys: [] },

  // ---- Wealth
  { id: 'wealth', parentId: 'root', label: 'Wealth', note: 'Both businesses and the capital they throw off', loopIds: [], checkIds: [], metricKeys: [] },
  { id: 'consulting', parentId: 'wealth', label: 'Consulting.ie', note: '', loopIds: [], checkIds: [], metricKeys: [] },
  { id: 'consulting_sales', parentId: 'consulting', label: 'Sales', note: 'The only input that changes the top line', loopIds: ['l_avoid'], checkIds: ['sales_activity'], metricKeys: [] },
  { id: 'consulting_delivery', parentId: 'consulting', label: 'Delivery', note: '', loopIds: [], checkIds: ['client_work', 'measurable'], metricKeys: ['consultingHours'] },
  { id: 'consulting_team', parentId: 'consulting', label: 'Team', note: '', loopIds: [], checkIds: ['bottlenecks'], metricKeys: [] },
  { id: 'onemedia', parentId: 'wealth', label: '1Media', note: '', loopIds: [], checkIds: [], metricKeys: [] },
  { id: 'capital', parentId: 'wealth', label: 'Capital', note: 'What survives if both businesses go to zero', loopIds: [], checkIds: ['no_spending'], metricKeys: [] },

  // ---- Relationships
  { id: 'relationships', parentId: 'root', label: 'Relationships', note: '', loopIds: ['l_isolate'], checkIds: [], metricKeys: [] },
  { id: 'inner', parentId: 'relationships', label: 'Inner circle', note: 'The few it is actually for', loopIds: [], checkIds: ['promises'], metricKeys: [] },
  { id: 'network', parentId: 'relationships', label: 'Network', note: '', loopIds: [], checkIds: [], metricKeys: [] },

  // ---- Self
  { id: 'self', parentId: 'root', label: 'Self', note: 'The operator, not the operation', loopIds: [], checkIds: [], metricKeys: [] },
  { id: 'discipline', parentId: 'self', label: 'Discipline', note: '', loopIds: ['l_numb', 'l_scroll'], checkIds: ['no_alcohol', 'no_drugs', 'no_porn', 'no_posting', 'disappeared'], metricKeys: ['socialMin'] },
  { id: 'focus', parentId: 'self', label: 'Focus', note: '', loopIds: ['l_busywork', 'l_reactive', 'l_noplan', 'l_perfection'], checkIds: ['highest_first', 'phone_away'], metricKeys: [] },
  { id: 'mind', parentId: 'self', label: 'Mind', note: '', loopIds: [], checkIds: ['notes', 'learned'], metricKeys: ['pagesRead', 'journalMin', 'goalReviewMin'] },
  { id: 'boundaries', parentId: 'self', label: 'Boundaries', note: '', loopIds: ['l_overcommit'], checkIds: [], metricKeys: [] },
]

/** Cause → effect you actually believe. Editable; these are the obvious ones. */
export const DEFAULT_LINKS: DomainLink[] = [
  { id: 'k1', fromId: 'recovery', toId: 'focus', note: 'Short sleep and the day gets reactive', weight: 3 },
  { id: 'k2', fromId: 'focus', toId: 'consulting_sales', note: 'Reactive days are the ones with no selling in them', weight: 3 },
  { id: 'k3', fromId: 'discipline', toId: 'recovery', note: 'Late nights start as something else', weight: 2 },
  { id: 'k4', fromId: 'consulting_sales', toId: 'capital', note: '', weight: 3 },
  { id: 'k5', fromId: 'boundaries', toId: 'consulting_delivery', note: 'Saying yes too often is what buries the week', weight: 2 },
  { id: 'k6', fromId: 'training', toId: 'focus', note: '', weight: 2 },
]

export const LINK_WEIGHT_LABEL: Record<number, string> = {
  1: 'Suspected',
  2: 'Likely',
  3: 'Certain',
}

// ---------------------------------------------------------------------- work

export const CLIENT_STATUS_LABEL: Record<string, string> = {
  prospect: 'Prospect',
  active: 'Active',
  paused: 'Paused',
  churned: 'Churned',
}

export const PROJECT_STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  paused: 'Paused',
  done: 'Done',
}

/**
 * The pipeline, in order. `probability` is the default weighting for a deal at
 * that stage — good enough to forecast with, and overridable per deal because
 * you usually know more about one deal than its stage does.
 */
/** How you actually reach someone. A contact can carry several. */
export const CONTACT_CHANNELS = [
  'Email',
  'LinkedIn',
  'WhatsApp',
  'SMS',
  'Call',
  'Instagram',
  'X',
  'In person',
]

export const OUTREACH_STAGES: { id: OutreachStage; label: string; hint: string }[] = [
  { id: 'target', label: 'Target', hint: 'identified, not yet approached' },
  { id: 'sent', label: 'Message sent', hint: 'waiting on them' },
  { id: 'replied', label: 'Replied', hint: 'a conversation exists' },
  { id: 'meeting', label: 'Meeting booked', hint: 'in the diary' },
]

export const DEAL_STAGES: { id: DealStage; label: string; probability: number }[] = [
  { id: 'lead', label: 'Lead', probability: 10 },
  { id: 'qualified', label: 'Qualified', probability: 30 },
  { id: 'proposal', label: 'Proposal out', probability: 60 },
  { id: 'won', label: 'Won', probability: 100 },
  { id: 'lost', label: 'Lost', probability: 0 },
]

export const DEAL_STAGE_LABEL: Record<string, string> = Object.fromEntries(
  DEAL_STAGES.map((s) => [s.id, s.label]),
)

/** Open stages only — won and lost have left the pipeline. */
export const OPEN_STAGES: DealStage[] = ['lead', 'qualified', 'proposal']

/** A deal that hasn't moved in this long is drifting, whatever the stage says. */
export const STALE_DEAL_DAYS = 14

// --------------------------------------------------------------- money depth

export const PURSE_LABEL: Record<string, string> = {
  consulting: 'Consulting.ie',
  onemedia: '1Media',
  personal: 'Personal',
}

/** Multiplier that turns each cadence into a monthly figure. */
export const CADENCE_PER_MONTH: Record<BillCadence, number> = {
  weekly: 52 / 12,
  monthly: 1,
  quarterly: 1 / 3,
  annual: 1 / 12,
}

export const CADENCE_LABEL: Record<BillCadence, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
}

export const HOLDING_CATEGORIES = [
  'Property',
  'Investments',
  'Cash',
  'Pension',
  'Vehicle',
  'Business equity',
  'Loan',
  'Mortgage',
  'Tax owed',
  'Other',
]

export const INVOICE_STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  paid: 'Paid',
}

export const TASK_PRIORITY_LABEL: Record<number, string> = {
  1: 'Must',
  2: 'Should',
  3: 'Could',
}

/** Quick estimates, in minutes. Anything longer belongs in a project. */
export const ESTIMATE_STEPS = [15, 30, 45, 60, 90, 120, 180, 240]

// ---------------------------------------------------------------- calendar

export const REPEAT_LABEL: Record<string, string> = {
  none: 'Once',
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
}

/** How far ahead the agenda looks by default. */
export const AGENDA_DAYS = 30

// ------------------------------------------------------------------ vision

/**
 * The year on one wall. Five columns because five is what fits across a screen
 * and still reads — a sixth turns the whole thing into a list, which is the one
 * thing a vision board must not be.
 */
export const DEFAULT_VISION: Vision = {
  title: 'Warplan',
  year: new Date().getFullYear(),
  intro: '',
  columns: [
    { id: 'v_health', title: 'Health', headline: '', body: '', images: [] },
    { id: 'v_wealth', title: 'Wealth', headline: '', body: '', images: [] },
    { id: 'v_love', title: 'Love', headline: '', body: '', images: [] },
    { id: 'v_network', title: 'Network', headline: '', body: '', images: [] },
    { id: 'v_happiness', title: 'Happiness', headline: '', body: '', images: [] },
  ],
}

/**
 * Uploads are downscaled to this before being stored. A board is a dozen
 * pictures and the whole document lives in localStorage, so a full-resolution
 * photo would eat the quota on its own.
 */
export const VISION_IMAGE_MAX_PX = 640
export const VISION_IMAGE_QUALITY = 0.72

// ---------------------------------------------------------------- trackers

/**
 * The nightly sheet, taken from the spreadsheet this replaced. Anything already
 * scored by the protocol checklist — calories, sleep, water, the gym, scrolling
 * — is deliberately absent, because logging the same number twice is how two
 * records start disagreeing.
 */
export const DEFAULT_TRACKERS: Tracker[] = [
  // Times. Stored as minutes since midnight; the two bookends of the day.
  { id: 'tk_wake', label: 'Wake up', kind: 'time', unit: '', target: 6 * 60, direction: 'atMost', group: 'The day', archived: false },
  { id: 'tk_bed', label: 'In bed', kind: 'time', unit: '', target: 22 * 60 + 30, direction: 'atMost', group: 'The day', archived: false },
  { id: 'tk_shutoff', label: 'Shut off', kind: 'time', unit: '', target: 21 * 60, direction: 'atMost', group: 'The day', archived: false },
  { id: 'tk_tech', label: 'Tech off by 22:30', kind: 'check', unit: '', target: 1, direction: 'atLeast', group: 'The day', archived: false },

  // Body
  { id: 'tk_diet', label: 'Diet', kind: 'rating', unit: '', target: 7, direction: 'atLeast', group: 'Body', archived: false },
  { id: 'tk_sugar', label: 'No sugar or junk', kind: 'check', unit: '', target: 1, direction: 'atLeast', group: 'Body', archived: false },
  { id: 'tk_cold', label: 'Cold exposure', kind: 'check', unit: '', target: 1, direction: 'atLeast', group: 'Body', archived: false },
  { id: 'tk_workout', label: 'Workout quality', kind: 'rating', unit: '', target: 7, direction: 'atLeast', group: 'Body', archived: false },

  // Mind
  { id: 'tk_meditation', label: 'Meditation', kind: 'number', unit: 'min', target: 10, direction: 'atLeast', group: 'Mind', archived: false },
  { id: 'tk_focus', label: 'Focus', kind: 'rating', unit: '', target: 7, direction: 'atLeast', group: 'Mind', archived: false },
  { id: 'tk_wellbeing', label: 'Wellbeing', kind: 'rating', unit: '', target: 7, direction: 'atLeast', group: 'Mind', archived: false },

  // Work
  { id: 'tk_workdone', label: 'All work completed', kind: 'check', unit: '', target: 1, direction: 'atLeast', group: 'Work', archived: false },
  { id: 'tk_schedule', label: 'Schedule updated', kind: 'check', unit: '', target: 1, direction: 'atLeast', group: 'Work', archived: false },
  { id: 'tk_cash', label: 'Cash collected today', kind: 'number', unit: '€', target: 0, direction: 'atLeast', group: 'Work', archived: false },

  // Truth. Uncomfortable on purpose — a ceiling of zero.
  { id: 'tk_lies', label: 'Lies told today', kind: 'number', unit: '', target: 0, direction: 'atMost', group: 'Truth', archived: false },
  { id: 'tk_con_biz', label: 'Constraint — business', kind: 'text', unit: '', target: 0, direction: 'atLeast', group: 'Truth', archived: false },
  { id: 'tk_con_life', label: 'Constraint — personal', kind: 'text', unit: '', target: 0, direction: 'atLeast', group: 'Truth', archived: false },
]

// ------------------------------------------------------------------ sections

/**
 * The sections, in nav order. Kept here rather than in App so search can offer
 * them as results without importing the shell.
 */
export const SECTIONS: { id: string; label: string; blurb: string }[] = [
  { id: 'alex', label: 'Alex', blurb: 'The overview, and what it adds up to' },
  { id: 'today', label: 'Today', blurb: 'Plan, log and review the day' },
  { id: 'home', label: 'Home', blurb: 'What needs you right now' },
  { id: 'work', label: 'Work', blurb: 'Tasks, projects, clients, pipeline' },
  { id: 'money', label: 'Money', blurb: 'Balances, net worth, the ledger' },
  { id: 'marketing', label: 'Marketing', blurb: '100 days of execution, scored' },
  { id: 'calendar', label: 'Calendar', blurb: "Events, and what's coming" },
  { id: 'map', label: 'Map', blurb: 'The life tree and its causes' },
  { id: 'goals', label: 'Goals', blurb: 'The ladder, and upkeep' },
  { id: 'learn', label: 'Learn', blurb: 'Books, courses, events and lessons' },
  { id: 'network', label: 'Network', blurb: 'People and contact cadence' },
  { id: 'vision', label: 'Vision', blurb: 'The year on one wall' },
  { id: 'patterns', label: 'Patterns', blurb: 'Loops, breakdowns, your two versions' },
  { id: 'progress', label: 'Progress', blurb: 'The 126-day totals' },
  { id: 'review', label: 'Review', blurb: 'The Sunday page' },
  { id: 'settings', label: 'Settings', blurb: 'Targets, loops, appearance, sync' },
]

export const MONTH_LABEL = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]
