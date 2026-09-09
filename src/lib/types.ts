import type { MarketingDay } from './marketing'

/** Every persisted shape lives here. Bump STATE_VERSION on breaking changes. */

export const STATE_VERSION = 16

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

export type PillarId = 'business' | 'body' | 'mind' | 'discipline'

/** One standard the day is scored against — a check, or a metric hitting its target. */
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

/** What a block is for. Drives what the planner puts in it. */
export type BlockKind = 'routine' | 'deep' | 'calls' | 'admin' | 'shutdown' | 'break'

/** One row of your day shape. No fixed hours — every field is yours to set. */
export interface ShapeBlock {
  id: string
  start: string
  end: string
  label: string
  tag: PriorityTag
  kind: BlockKind
}

/** A planned block of the day. `start`/`end` are 'HH:MM', 24-hour. */
export interface TimeBlock {
  id: string
  start: string
  end: string
  label: string
  tag: PriorityTag
  kind: BlockKind
  /** Tasks the planner put in here. Editable by hand afterwards. */
  taskIds: string[]
  /** True when the planner placed it, so a hand-made block is never overwritten. */
  auto: boolean
}

/**
 * One quarter-hour of the day, as actually spent. Keyed by "HH:MM" so a slot
 * can be filled in long after it passed — the point is an honest record, not
 * a live timer you have to keep up with.
 */
export interface TimeLogSlot {
  text: string
  /** 1-10. 0 means unrated. */
  rating: number
}

/**
 * Where a cold approach has got to. Deliberately separate from Deal (which is
 * about money and probability) and Connection (which is about keeping a
 * relationship warm) — this is the narrow question of whether a named person
 * has heard from us, answered, and agreed to meet.
 */
export type OutreachStage = 'target' | 'sent' | 'replied' | 'meeting'

export interface OutreachContact {
  id: string
  name: string
  company: string
  role: string
  /** LinkedIn URL, email, wherever the approach is happening. */
  handle: string
  stage: OutreachStage
  notes: string
  /** When the stage last changed — what makes a stalled approach visible. */
  movedAt: string
  /** The screenshot they were created from, downscaled. Empty when typed by hand. */
  shot?: string
  /** Which channels you have for them — email, WhatsApp, SMS and so on. */
  channels: string[]
  workEmail: string
  personalEmail: string
  phone: string
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
  /** "HH:MM" slot -> what that quarter hour actually went on. */
  timeLog: Record<string, TimeLogSlot>
  /** Set when the nightly scorecard is signed off. */
  closed: boolean
}

export type MoneyEntity = 'consulting' | 'onemedia'

/** Who the money belongs to. Personal sits alongside the two businesses. */
export type Purse = MoneyEntity | 'personal'

/**
 * `netWorth` rides the same snapshot machinery as the bank accounts but is a
 * manual figure — it takes in property, investments and anything else that
 * never touches these three accounts, so it is never summed with them.
 */
/**
 * 1Media alone runs three real accounts — Stripe, AIB business, Revolut
 * business — so it gets three ids instead of one. `onemediaBank` still parses
 * for anything stored before this split; hydrate folds it into the AIB
 * balance, since that was the one operating account it stood for.
 */
export type AccountId =
  | 'consultingBank'
  | 'onemediaStripe'
  | 'onemediaAib'
  | 'onemediaRev'
  | 'personalAib'
  | 'personalRev'
  | 'netWorth'

export const BANK_ACCOUNTS: AccountId[] = [
  'consultingBank',
  'onemediaStripe',
  'onemediaAib',
  'onemediaRev',
  'personalAib',
  'personalRev',
]

/** The three that roll up into "1Media bank", for anywhere that wants one number. */
export const ONEMEDIA_ACCOUNTS: AccountId[] = ['onemediaStripe', 'onemediaAib', 'onemediaRev']

/** Personal runs two accounts too — AIB and Rev — same reasoning as 1Media. */
export const PERSONAL_ACCOUNTS: AccountId[] = ['personalAib', 'personalRev']

/**
 * Which purse each account naturally belongs to. `netWorth` isn't a spending
 * account, so it owns nothing here. Used to spot when an expense was paid
 * from an account that isn't the entity's own — that gap is money owed back.
 */
export const ACCOUNT_OWNER: Partial<Record<AccountId, Purse>> = {
  consultingBank: 'consulting',
  onemediaStripe: 'onemedia',
  onemediaAib: 'onemedia',
  onemediaRev: 'onemedia',
  personalAib: 'personal',
  personalRev: 'personal',
}

export type LedgerKind = 'revenue' | 'cashCollected' | 'profit' | 'payout' | 'expense'

/**
 * A single money event. `entity` is who it's *for* — a business or personal
 * — which can differ from who the `account` belongs to: an expense for
 * 1Media paid out of a personal account is still a 1Media expense, it just
 * also means 1Media owes personal that amount back.
 */
export interface LedgerEntry {
  id: string
  date: string
  entity: Purse
  kind: LedgerKind
  amount: number
  note: string
  /**
   * Which real account cash-collected or expense actually moved. Empty means
   * unattributed — revenue and profit entries don't move a bank balance, and
   * older entries predate this field. Only a cashCollected or expense entry
   * with an account set feeds the live balance.
   */
  account: AccountId | ''
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
  /** Minutes of real work a day can hold. The line the week is planned against. */
  dailyCapacityMin: number
  /** Length of the protocol, in days. The one number everything else counts against. */
  protocolDays: number
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

/** 1 is the highest. Three bands is as many as anyone actually sorts by. */
export type TaskPriority = 1 | 2 | 3

/** A unit of work. `projectId` empty means it stands on its own. */
export interface Task {
  id: string
  projectId: string
  entity: PriorityTag
  title: string
  done: boolean
  /**
   * When it is *owed*. Distinct from `scheduled`, which is when you intend to
   * sit down and do it — conflating the two is why week plans quietly slip.
   */
  due: string
  /** ISO date it is planned for. Empty means it sits in the backlog. */
  scheduled: string
  /** How long you think it takes, in minutes. 0 means unestimated. */
  estimateMin: number
  priority: TaskPriority
  /** Loose hint for what kind of work this is — currently only 'calls' is read anywhere. */
  kindHint: string
  created: string
  doneDate: string
  /** Which goal this moves forward, if any. Empty means untagged. */
  goalId: string
}

// ------------------------------------------------------------------- money

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

// ------------------------------------------------------------- transactions

export type TxCategory = 'personal' | 'consulting' | 'onemedia' | ''

/**
 * One bank line, imported from a statement. `amount` is signed — positive is
 * money in, negative is money out — so a spend total is just a sum with no
 * separate direction field to keep in sync.
 */
export interface Transaction {
  id: string
  date: string
  description: string
  amount: number
  account: AccountId | ''
  /** '' means not yet gone through — the whole point of the log. */
  category: TxCategory
  notes: string
  /** Which statement it came in on, so a re-import can't duplicate it. */
  importBatch: string
}

// ---------------------------------------------------------------- calendar

export type EventRepeat = 'none' | 'weekly' | 'monthly' | 'yearly'

/**
 * Something that happens on a date. Repeats are computed rather than stored as
 * copies, so editing a birthday changes every year of it rather than one.
 */
export interface CalendarEvent {
  id: string
  title: string
  /** ISO date of the first occurrence. */
  date: string
  /** 'HH:MM'. Empty means it takes the whole day. */
  time: string
  durationMin: number
  repeat: EventRepeat
  tag: PriorityTag
  notes: string
  /** Days ahead it starts showing as coming up. 0 means on the day. */
  remindDays: number
}

// ------------------------------------------------------------------ vision

/** One picture on the board. `src` is a data URI or a plain URL. */
export interface VisionImage {
  id: string
  src: string
  caption: string
}

export interface VisionColumn {
  id: string
  title: string
  /** The one-line target. The thing the column is actually for. */
  headline: string
  /** The written plan underneath it. */
  body: string
  images: VisionImage[]
}

export interface Vision {
  title: string
  year: number
  /** The document at the top: the year's plan in prose. */
  intro: string
  columns: VisionColumn[]
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
  transactions: Transaction[]
  events: CalendarEvent[]
  vision: Vision
  trackers: Tracker[]
  /** Your own day shape — start empty, edited entirely in Settings. */
  dayShape: ShapeBlock[]
  /** The six-tap morning ritual. Editable — add, rename, remove any of it. */
  morningRitual: { id: string; label: string }[]
  /** The end-of-day close-out. Same editing rules as the morning ritual. */
  shutdownRitual: { id: string; label: string; hint: string }[]
  /** The four questions asked every night, in your own words. */
  nightlyQuestions: { id: string; q: string; hint: string }[]
  bills: Bill[]
  holdings: Holding[]
  invoices: Invoice[]
  clients: Client[]
  deals: Deal[]
  projects: Project[]
  tasks: Task[]
  rewards: { id: string; label: string; detail: string }[]
  /** The named people we are cold-approaching, and how far each has got. */
  outreach: OutreachContact[]
  /**
   * The 100-day marketing execution tracker. Keyed by ISO date; the campaign's
   * working-day calendar is derived from `startDate`, so the 100 days shift
   * with it rather than being pinned to stored day numbers.
   */
  marketing: {
    startDate: string
    days: Record<string, MarketingDay>
  }
  /** The standards the day is scored against. Editable — add, reweight, remove. */
  checklist: ChecklistItem[]
}
