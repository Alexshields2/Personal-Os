/** Every persisted shape lives here. Bump STATE_VERSION on breaking changes. */

export const STATE_VERSION = 1

/** Numeric things logged once a day. Keys double as metric ids everywhere. */
export interface DayMetrics {
  acmrHours: number
  calories: number
  protein: number
  creatine: number
  waterL: number
  steps: number
  sleepHours: number
  readingMin: number
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
  readingMin: 0,
  mobilityMin: 0,
  journalMin: 0,
  goalReviewMin: 0,
  socialMin: 0,
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
  /** Set when the nightly scorecard is signed off. */
  closed: boolean
}

export type MoneyEntity = 'acmr' | 'onemedia'
export type AccountId = 'acmrBank' | 'onemediaBank' | 'personalBank'

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

export interface Book {
  id: string
  title: string
  status: 'reading' | 'done' | 'queued'
  notes: string
}

export interface Targets {
  acmrHours: number
  calories: number
  protein: number
  creatine: number
  waterL: number
  steps: number
  sleepHours: number
  readingMin: number
  mobilityMin: number
  journalMin: number
  goalReviewMin: number
  /** A ceiling, not a floor — under this is the win. */
  socialMin: number
  bonusPool: number
  personalPayout: number
  bodyweightKg: number
}

export interface AppState {
  version: number
  startDate: string
  targets: Targets
  days: Record<string, DayEntry>
  weeks: Record<string, WeekEntry>
  ledger: LedgerEntry[]
  balances: BalanceSnapshot[]
  /** Cash actually landed in the personal account. Gates the rewards. */
  payoutReceived: number
  books: Book[]
  rewards: { id: string; label: string; detail: string }[]
}
