/**
 * Test fixtures. Building an AppState by hand in every test buries the one
 * thing each test is actually about, so everything here defaults to "empty and
 * valid" and takes an override for the part under test.
 */

import {
  DEFAULT_DOMAINS,
  DEFAULT_LINKS,
  DEFAULT_LOOPS,
  DEFAULT_TARGETS,
  MORNING,
} from './config'
import { EMPTY_METRICS, STATE_VERSION } from './types'
import type {
  AppState,
  Client,
  Connection,
  DayEntry,
  DayMetrics,
  Deal,
  Goal,
  LedgerEntry,
  Priority,
  Task,
} from './types'

/** A day that is logged but scores nothing, so a test can add just what it needs. */
export function day(date: string, over: Partial<DayEntry> = {}): DayEntry {
  return {
    date,
    checks: {},
    metrics: { ...EMPTY_METRICS },
    trained: false,
    restDay: false,
    biggestWin: '',
    biggestMistake: '',
    notes: '',
    priorities: [],
    blocks: [],
    planned: false,
    energy: 0,
    lesson: '',
    loops: [],
    answers: {},
    trackers: {},
    trackerNotes: {},
    journal: '',
    // Closed is what makes `isLogged` true without inventing metric values.
    closed: true,
    ...over,
  }
}

/** A day that hits every target — the top of the scoring range. */
export function perfectMetrics(): DayMetrics {
  return {
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
    // A ceiling, so zero is the winning value.
    socialMin: 0,
  }
}

export function priority(id: string, over: Partial<Priority> = {}): Priority {
  return { id, text: `task ${id}`, done: false, tag: 'consulting', ...over }
}

export function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    projectId: '',
    entity: 'consulting',
    title: `task ${id}`,
    done: false,
    due: '',
    scheduled: '',
    estimateMin: 0,
    priority: 2,
    kindHint: '',
    created: '2026-01-01',
    doneDate: '',
    ...over,
  }
}

export function deal(id: string, over: Partial<Deal> = {}): Deal {
  return {
    id,
    entity: 'consulting',
    name: `deal ${id}`,
    clientId: '',
    stage: 'lead',
    value: 1000,
    probability: 10,
    expectedClose: '',
    nextStep: '',
    moved: '2026-01-01',
    notes: '',
    ...over,
  }
}

export function client(id: string, over: Partial<Client> = {}): Client {
  return {
    id,
    entity: 'consulting',
    name: `client ${id}`,
    status: 'active',
    monthlyValue: 1000,
    since: '2026-01-01',
    renewal: '',
    notes: '',
    ...over,
  }
}

export function connection(id: string, over: Partial<Connection> = {}): Connection {
  return {
    id,
    name: `person ${id}`,
    role: '',
    why: '',
    status: 'connected',
    lastContact: '',
    cadenceDays: 0,
    notes: '',
    ...over,
  }
}

export function goal(id: string, over: Partial<Goal> = {}): Goal {
  return {
    id,
    parentId: '',
    horizon: 'year',
    domainId: '',
    title: `goal ${id}`,
    note: '',
    due: '',
    done: false,
    keyResults: [],
    ...over,
  }
}

export function ledger(id: string, over: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id,
    date: '2026-01-01',
    entity: 'consulting',
    kind: 'revenue',
    amount: 1000,
    note: '',
    account: '',
    ...over,
  }
}

/** Turn a list of days into the keyed map the state holds. */
export function daysMap(list: DayEntry[]): Record<string, DayEntry> {
  return Object.fromEntries(list.map((d) => [d.date, d]))
}

export function makeState(over: Partial<AppState> = {}): AppState {
  return {
    version: STATE_VERSION,
    theme: 'dark',
    updatedAt: '2026-01-01T00:00:00.000Z',
    startDate: '2026-01-01',
    targets: { ...DEFAULT_TARGETS },
    days: {},
    weeks: {},
    ledger: [],
    balances: [],
    payoutReceived: 0,
    learning: [],
    goals: [],
    connections: [],
    upkeep: [],
    loops: DEFAULT_LOOPS.map((l) => ({ ...l })),
    domains: DEFAULT_DOMAINS.map((d) => ({ ...d })),
    links: DEFAULT_LINKS.map((l) => ({ ...l })),
    transactions: [],
    events: [],
    dayShape: [],
    morningRitual: [],
    shutdownRitual: [],
    nightlyQuestions: [],
    vision: { title: 'Warplan', year: 2027, intro: '', columns: [] },
    trackers: [],
    bills: [],
    holdings: [],
    invoices: [],
    clients: [],
    deals: [],
    projects: [],
    tasks: [],
    rewards: [],
    ...over,
  }
}

/** Every morning-ritual id ticked, for tests that need a fully logged day. */
export function morningChecks(): Record<string, boolean> {
  return Object.fromEntries(MORNING.map((m) => [m.id, true]))
}
