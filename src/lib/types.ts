/** Every persisted shape lives here. Bump STATE_VERSION on breaking changes. */

export const STATE_VERSION = 4

/** Numeric things logged once a day. Keys double as metric ids everywhere. */
export interface DayMetrics {
  consultingHours: number
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
  consultingHours: 0,
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
export type PriorityTag = 'consulting' | 'onemedia' | 'life'

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
  /**
   * Tracker id -> value. A check stores 1 or 0, a rating 1-10, a time the
   * minutes since midnight. Text trackers live in `trackerNotes` instead, so
   * the streak arithmetic never has to guess at a type.
   */
  trackers: Record<string, number>
  trackerNotes: Record<string, string>
  /** The day's journal entry, in your own words. */
  journal: string
  /** Set when the nightly scorecard is signed off. */
  closed: boolean
}

export type MoneyEntity = 'consulting' | 'onemedia'

/**
 * `netWorth` rides the same snapshot machinery as the bank accounts but is a
 * manual figure — it takes in property, investments and anything else that
 * never touches these three accounts, so it is never summed with them.
 */
export type AccountId = 'consultingBank' | 'onemediaBank' | 'personalBank' | 'netWorth'

export const BANK_ACCOUNTS: AccountId[] = ['consultingBank', 'onemediaBank', 'personalBank']

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

/** How far out a goal sits. The ladder is what stops a ten-year goal being a wish. */
export type GoalHorizon = 'life' | 'tenYear' | 'threeYear' | 'year' | 'quarter'

/**
 * How a key result knows where it stands. `manual` is a number you type;
 * everything else is pulled from data the app already holds, so it can't drift
 * out of date the way a hand-updated percentage always does.
 */
export type KeyResultSource = 'manual' | 'account' | 'ledger' | 'metric'

export interface KeyResult {
  id: string
  label: string
  source: KeyResultSource
  /** Account id, ledger kind or metric key, depending on `source`. */
  ref: string
  target: number
  /** Only read when `source` is manual. */
  current: number
  unit: string
}

export interface Goal {
  id: string
  /** Links a shorter goal up to the longer one it serves. Empty at the top. */
  parentId: string
  horizon: GoalHorizon
  /** Optional tie into the life map, so a goal sits on a branch. */
  domainId: string
  title: string
  note: string
  /** Optional ISO deadline. */
  due: string
  done: boolean
  keyResults: KeyResult[]
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
  consultingHours: number
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

// ---------------------------------------------------------------------- work

export type ClientStatus = 'prospect' | 'active' | 'paused' | 'churned'

/** Someone paying one of the businesses, and what they're worth per month. */
export interface Client {
  id: string
  entity: MoneyEntity
  name: string
  status: ClientStatus
  /** Recurring monthly value. 0 for project work. */
  monthlyValue: number
  since: string
  /** ISO date the contract comes up. Empty when there isn't one. */
  renewal: string
  notes: string
}

export type DealStage = 'lead' | 'qualified' | 'proposal' | 'won' | 'lost'

/**
 * A deal in flight. `probability` defaults from the stage but stays editable,
 * because the stage is a generalisation and you usually know better.
 */
export interface Deal {
  id: string
  entity: MoneyEntity
  name: string
  /** Optional link to an existing client. */
  clientId: string
  stage: DealStage
  value: number
  probability: number
  expectedClose: string
  /** The single next action. A deal with no next step is a deal going nowhere. */
  nextStep: string
  /** ISO date the stage last moved — drives the stale-deal warning. */
  moved: string
  notes: string
}

export type ProjectStatus = 'active' | 'paused' | 'done'

export interface Project {
  id: string
  entity: PriorityTag
  name: string
  clientId: string
  status: ProjectStatus
  due: string
  notes: string
}

/** A unit of work. `projectId` empty means it stands on its own. */
export interface Task {
  id: string
  projectId: string
  entity: PriorityTag
  title: string
  done: boolean
  due: string
  created: string
  doneDate: string
}

// ------------------------------------------------------------------- money

/** Who the money belongs to. Personal sits alongside the two businesses. */
export type Purse = MoneyEntity | 'personal'

export type BillCadence = 'weekly' | 'monthly' | 'quarterly' | 'annual'

/** A recurring outgoing. Normalised to a monthly figure wherever it's summed. */
export interface Bill {
  id: string
  label: string
  amount: number
  cadence: BillCadence
  /** ISO date the next payment lands. Empty means unscheduled. */
  nextDue: string
  purse: Purse
  category: string
}

export type HoldingKind = 'asset' | 'liability'

/**
 * A line of the balance sheet. Together these make net worth a calculated
 * number rather than a typed one — the old manual snapshot stays as a fallback
 * for anyone who hasn't itemised yet.
 */
export interface Holding {
  id: string
  kind: HoldingKind
  label: string
  value: number
  category: string
  /** Could you reach it this week? Drives the liquid split, not the total. */
  liquid: boolean
  updated: string
}

export type InvoiceStatus = 'draft' | 'sent' | 'paid'

export interface Invoice {
  id: string
  entity: MoneyEntity
  clientId: string
  reference: string
  amount: number
  issued: string
  due: string
  status: InvoiceStatus
  paidDate: string
}

// ---------------------------------------------------------------- trackers

export type TrackerKind = 'check' | 'number' | 'rating' | 'time' | 'text'

/**
 * Anything you want to watch that the fixed protocol doesn't cover. A habit and
 * a metric are the same object — one is a tick, the other is a number — so they
 * share one sheet, one streak rule and one place to edit them.
 */
export interface Tracker {
  id: string
  label: string
  kind: TrackerKind
  /** Number trackers only. */
  unit: string
  /**
   * The line that counts as a win. A rating is out of ten; a time is minutes
   * since midnight, so "in bed by 22:30" is 1350 with direction `atMost`.
   */
  target: number
  /** Whether the target is a floor to clear or a ceiling to stay under. */
  direction: 'atLeast' | 'atMost'
  /** Heading it sits under in the sheet. Empty groups together at the end. */
  group: string
  archived: boolean
}

export type Theme = 'dark' | 'light'

/**
 * A node in the life map. The tree is Alex at the root, then domains, then as
 * many levels of sub-domain as are useful. Bindings are what stop it being a
 * decorative mind-map: a node scores off the standards and metrics tied to it,
 * so a branch can be measurably weak rather than just feel weak.
 */
export interface DomainNode {
  id: string
  /** Empty for the root. */
  parentId: string
  label: string
  note: string
  /**
   * Board position. Undefined means never placed by hand, so the tidy layout
   * decides — which is what lets an existing map open as a sensible board
   * instead of a pile at the origin.
   */
  x?: number
  y?: number
  /** Loop ids that belong to this branch. */
  loopIds: string[]
  /** Checklist item ids whose hit rate feeds this node's score. */
  checkIds: string[]
  /** Metrics whose attainment against target feeds this node's score. */
  metricKeys: MetricKey[]
}

/** A believed cause → effect between two nodes. Yours to assert, not inferred. */
export interface DomainLink {
  id: string
  fromId: string
  toId: string
  note: string
  /** How strongly you hold it: 1 suspected, 2 likely, 3 certain. */
  weight: number
}

export interface AppState {
  version: number
  /** Monochrome either way — this only decides which end is the ground. */
  theme: Theme
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
  domains: DomainNode[]
  links: DomainLink[]
  trackers: Tracker[]
  bills: Bill[]
  holdings: Holding[]
  invoices: Invoice[]
  clients: Client[]
  deals: Deal[]
  projects: Project[]
  tasks: Task[]
  rewards: { id: string; label: string; detail: string }[]
}
