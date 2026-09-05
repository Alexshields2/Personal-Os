/** Every persisted shape lives here. Bump STATE_VERSION on breaking changes. */

export const STATE_VERSION = 2

/** Numeric things logged once a day. Keys double as metric ids everywhere. */
export interface DayMetrics {
  acmrHours: number
  calories: number
  protein: number
  creatine: number
  waterL: number
  steps: number
  sleepHours: number
  pagesRead: number
  mobilityMin: number
  journalMin: number
  goalReviewMin: number
  socialMin: number
}

export type MetricKey = keyof DayMetrics

export const EMPTY_METRICS: DayMetrics = {
  acmrHours: 0,
  calories: 0,
  protein: 0,
  creatine: 0,
  waterL: 0,
  steps: 0,
  sleepHours: 0,
  pagesRead: 0,
  mobilityMin: 0,
  journalMin: 0,
  goalReviewMin: 0,
  socialMin: 0,
}

/** Which part of the empire a priority belongs to. */
export type PriorityTag = 'acmr' | 'onemedia' | 'life'

/**
 * One of the day's committed outcomes. Order is rank: the first is the day's
 * one thing, and the rest fall in behind it.
 */
export interface Priority {
  id: string
  text: string
  done: boolean
  tag: PriorityTag
}

/** A planned block of the day. `start`/`end` are 'HH:MM', 24-hour. */
export interface TimeBlock {
  id: string
  start: string
  end: string
  label: string
  tag: PriorityTag
}

export interface DayEntry {
  /** ISO date, YYYY-MM-DD. Also the map key. */
  date: string
  /** Checklist item id -> done. Absent means not done. */
  checks: Record<string, boolean>
  metrics: DayMetrics
  /** Trained vs. scheduled recovery — drives the workout count. */
  trained: boolean
  restDay: boolean
  biggestWin: string
  biggestMistake: string
  notes: string
  /** The day's committed outcomes, ranked. Set in the morning, graded at night. */
  priorities: Priority[]
  /** The intended shape of the day. Optional — a plan works without it. */
  blocks: TimeBlock[]
  /** Set when the morning plan is committed, so an unplanned day is visible. */
  planned: boolean
  /** Subjective 1-5. 0 means unrated. */
  energy: number
  /** What today teaches tomorrow. */
  lesson: string
  /** Ids of the loops that ran today. The raw material for pattern detection. */
  loops: string[]
  /** Nightly question id -> answer. */
  answers: Record<string, string>
  /** Set when the nightly scorecard is signed off. */
  closed: boolean
}

export type MoneyEntity = 'acmr' | 'onemedia'

/**
 * `netWorth` rides the same snapshot machinery as the bank accounts but is a
 * manual figure — it takes in property, investments and anything else that
 * never touches these three accounts, so it is never summed with them.
 */
export type AccountId = 'acmrBank' | 'onemediaBank' | 'personalBank' | 'netWorth'

export const BANK_ACCOUNTS: AccountId[] = ['acmrBank', 'onemediaBank', 'personalBank']

export type LedgerKind = 'revenue' | 'cashCollected' | 'profit' | 'payout' | 'expense'

/** A single money event, attributed to one business. */
export interface LedgerEntry {
  id: string
  date: string
  entity: MoneyEntity
  kind: LedgerKind
  amount: number
  note: string
}

/** A point-in-time bank reading. Latest per account is the current balance. */
export interface BalanceSnapshot {
  id: string
  date: string
  account: AccountId
  amount: number
}

export interface WeekEntry {
  /** ISO date of that week's Monday. */
  weekStart: string
  weightKg: number
  waistCm: number
  photos: boolean
  strengthNote: string
  biggestWin: string
  biggestBottleneck: string
  nextTarget: string
  spendingNote: string
  bookNotes: string
  dealsClosed: number
  qualifiedOpps: number
  newPipeline: number
  familyTime: boolean
  planned: boolean
}

/** A named failure pattern. Editable, because the real ones are personal. */
export interface Loop {
  id: string
  label: string
  note: string
  /** Retired loops stop being offered but keep their history. */
  archived: boolean
}

export type LearnKind = 'book' | 'course' | 'event'
export type LearnStatus = 'queued' | 'active' | 'done'

/**
 * One extracted lesson. `action` is what makes it worth capturing — a lesson
 * with no action is a highlight, and highlights change nothing.
 */
export interface Lesson {
  id: string
  date: string
  text: string
  action: string
  applied: boolean
}

/** A book, course or event, and everything taken from it. */
export interface LearnItem {
  id: string
  kind: LearnKind
  title: string
  /** Author, provider or host. */
  source: string
  status: LearnStatus
  /** ISO date. For an event, the date it happened. */
  date: string
  notes: string
  lessons: Lesson[]
}

export interface Goal {
  id: string
  title: string
  note: string
  /** Optional ISO deadline. */
  due: string
  done: boolean
}

export type ConnectionStatus = 'inner' | 'connected' | 'reachedOut' | 'target'

/**
 * Someone worth knowing, where that stands, and when you last actually spoke.
 * `cadenceDays` is what turns a list of names into a system — 0 means the
 * relationship runs on its own and shouldn't nag.
 */
export interface Connection {
  id: string
  name: string
  /** What they do, or where they sit. */
  role: string
  why: string
  status: ConnectionStatus
  /** ISO date of the last real contact. Empty means never. */
  lastContact: string
  cadenceDays: number
  notes: string
}

/** A recurring upkeep task — haircut every 14 days, and anything like it. */
export interface Upkeep {
  id: string
  label: string
  intervalDays: number
  /** ISO date it was last done; empty means never. */
  lastDone: string
}

export interface Targets {
  acmrHours: number
  calories: number
  protein: number
  creatine: number
  waterL: number
  steps: number
  sleepHours: number
  pagesRead: number
  mobilityMin: number
  journalMin: number
  goalReviewMin: number
  /** A ceiling, not a floor — under this is the win. */
  socialMin: number
  bonusPool: number
  personalPayout: number
  bodyweightKg: number
  netWorth: number
}

export interface AppState {
  version: number
  /** ISO timestamp of the last local mutation. Drives sync conflict order. */
  updatedAt: string
  startDate: string
  targets: Targets
  days: Record<string, DayEntry>
  weeks: Record<string, WeekEntry>
  ledger: LedgerEntry[]
  balances: BalanceSnapshot[]
  /** Cash actually landed in the personal account. Gates the rewards. */
  payoutReceived: number
  learning: LearnItem[]
  goals: Goal[]
  connections: Connection[]
  upkeep: Upkeep[]
  loops: Loop[]
  rewards: { id: string; label: string; detail: string }[]
}
