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

export interface Book {
  id: string
  title: string
  status: 'reading' | 'done' | 'queued'
  notes: string
}

export interface Goal {
  id: string
  title: string
  note: string
  /** Optional ISO deadline. */
  due: string
  done: boolean
}

export type ConnectionStatus = 'target' | 'reachedOut' | 'connected'

/** Someone worth knowing, and where that stands. */
export interface Connection {
  id: string
  name: string
  why: string
  status: ConnectionStatus
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
  books: Book[]
  goals: Goal[]
  connections: Connection[]
  upkeep: Upkeep[]
  rewards: { id: string; label: string; detail: string }[]
}
