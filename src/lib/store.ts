import { useSyncExternalStore } from 'react'
import {
  CHECKLIST,
  DEFAULT_BOOKS,
  DEFAULT_GOALS,
  DEFAULT_REWARDS,
  DEFAULT_TARGETS,
  DEFAULT_UPKEEP,
  MORNING,
  PROTOCOL_DAYS,
} from './config'
import { todayISO, isoForDay } from './date'
import { EMPTY_METRICS, STATE_VERSION } from './types'
import type {
  AppState,
  BalanceSnapshot,
  Book,
  Connection,
  DayEntry,
  Goal,
  LedgerEntry,
  Targets,
  Upkeep,
  WeekEntry,
} from './types'

const KEY = 'protocol126:v1'

function initialState(): AppState {
  return {
    version: STATE_VERSION,
    startDate: todayISO(),
    targets: { ...DEFAULT_TARGETS },
    days: {},
    weeks: {},
    ledger: [],
    balances: [],
    payoutReceived: 0,
    books: DEFAULT_BOOKS.map((b) => ({ ...b })),
    goals: DEFAULT_GOALS.map((g) => ({ ...g })),
    connections: [],
    upkeep: DEFAULT_UPKEEP.map((u) => ({ ...u })),
    rewards: DEFAULT_REWARDS.map((r) => ({ ...r })),
  }
}

/**
 * Merge stored JSON over defaults so a state file written by an older build
 * gains new fields instead of rendering `undefined` into the UI.
 */
function hydrate(raw: string): AppState {
  const base = initialState()
  let parsed: Partial<AppState>
  try {
    parsed = JSON.parse(raw) as Partial<AppState>
  } catch {
    return base
  }
  const days: Record<string, DayEntry> = {}
  for (const [k, v] of Object.entries(parsed.days ?? {})) {
    days[k] = { ...emptyDay(k), ...v, metrics: { ...EMPTY_METRICS, ...(v?.metrics ?? {}) } }
  }
  return {
    ...base,
    ...parsed,
    version: STATE_VERSION,
    startDate: parsed.startDate ?? base.startDate,
    targets: { ...base.targets, ...(parsed.targets ?? {}) },
    days,
    weeks: parsed.weeks ?? {},
    ledger: parsed.ledger ?? [],
    balances: parsed.balances ?? [],
    payoutReceived: parsed.payoutReceived ?? 0,
    books: parsed.books ?? base.books,
    goals: parsed.goals ?? base.goals,
    connections: parsed.connections ?? base.connections,
    upkeep: parsed.upkeep ?? base.upkeep,
    rewards: parsed.rewards ?? base.rewards,
  }
}

export function emptyDay(date: string): DayEntry {
  return {
    date,
    checks: {},
    metrics: { ...EMPTY_METRICS },
    trained: false,
    restDay: false,
    biggestWin: '',
    biggestMistake: '',
    notes: '',
    closed: false,
  }
}

export function emptyWeek(weekStart: string): WeekEntry {
  return {
    weekStart,
    weightKg: 0,
    waistCm: 0,
    photos: false,
    strengthNote: '',
    biggestWin: '',
    biggestBottleneck: '',
    nextTarget: '',
    spendingNote: '',
    bookNotes: '',
    dealsClosed: 0,
    qualifiedOpps: 0,
    newPipeline: 0,
    familyTime: false,
    planned: false,
  }
}

// ---------------------------------------------------------------------------
// Store

let state: AppState = (() => {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? hydrate(raw) : initialState()
  } catch {
    return initialState()
  }
})()

const listeners = new Set<() => void>()
let saveTimer: ReturnType<typeof setTimeout> | undefined

function persist() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* quota or private mode — the session still works, it just won't survive */
    }
  }, 150)
}

function set(next: AppState) {
  state = next
  persist()
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function getState(): AppState {
  return state
}

export function useStore(): AppState {
  return useSyncExternalStore(subscribe, getState, getState)
}

// ---------------------------------------------------------------------------
// Actions

export const actions = {
  setStartDate(iso: string) {
    set({ ...state, startDate: iso })
  },

  setTargets(patch: Partial<Targets>) {
    set({ ...state, targets: { ...state.targets, ...patch } })
  },

  updateDay(date: string, patch: Partial<DayEntry>) {
    const prev = state.days[date] ?? emptyDay(date)
    set({ ...state, days: { ...state.days, [date]: { ...prev, ...patch } } })
  },

  toggleCheck(date: string, id: string, value?: boolean) {
    const prev = state.days[date] ?? emptyDay(date)
    const next = value ?? !prev.checks[id]
    actions.updateDay(date, { checks: { ...prev.checks, [id]: next } })
  },

  setMetric(date: string, key: keyof typeof EMPTY_METRICS, value: number) {
    const prev = state.days[date] ?? emptyDay(date)
    actions.updateDay(date, {
      metrics: { ...prev.metrics, [key]: Number.isFinite(value) ? Math.max(0, value) : 0 },
    })
  },

  updateWeek(weekStart: string, patch: Partial<WeekEntry>) {
    const prev = state.weeks[weekStart] ?? emptyWeek(weekStart)
    set({ ...state, weeks: { ...state.weeks, [weekStart]: { ...prev, ...patch } } })
  },

  addLedger(entry: LedgerEntry) {
    set({ ...state, ledger: [entry, ...state.ledger] })
  },

  removeLedger(id: string) {
    set({ ...state, ledger: state.ledger.filter((e) => e.id !== id) })
  },

  addBalance(snap: BalanceSnapshot) {
    // One reading per account per day — a correction replaces, never stacks.
    const rest = state.balances.filter(
      (b) => !(b.account === snap.account && b.date === snap.date),
    )
    set({ ...state, balances: [...rest, snap] })
  },

  removeBalance(id: string) {
    set({ ...state, balances: state.balances.filter((b) => b.id !== id) })
  },

  setPayoutReceived(amount: number) {
    set({ ...state, payoutReceived: Math.max(0, amount) })
  },

  setBooks(books: Book[]) {
    set({ ...state, books })
  },

  setGoals(goals: Goal[]) {
    set({ ...state, goals })
  },

  setConnections(connections: Connection[]) {
    set({ ...state, connections })
  },

  setUpkeep(upkeep: Upkeep[]) {
    set({ ...state, upkeep })
  },

  replaceAll(next: AppState) {
    set(hydrate(JSON.stringify(next)))
  },

  reset() {
    set(initialState())
  },

  /**
   * Populate the first few weeks so the dashboards have something to draw.
   * Refuses to run once anything real is logged — this must never be able to
   * overwrite actual entries.
   */
  seedDemo(): boolean {
    if (Object.keys(state.days).length > 0) return false
    const days: Record<string, DayEntry> = {}
    const checks: Record<string, boolean> = {}
    for (const item of CHECKLIST) checks[item.id] = true
    for (const item of MORNING) checks[item.id] = true
    const upTo = Math.min(PROTOCOL_DAYS, 24)
    for (let i = 1; i <= upTo; i++) {
      const date = isoForDay(state.startDate, i)
      const d = emptyDay(date)
      d.checks = { ...checks }
      d.metrics = {
        acmrHours: 10,
        calories: 3000,
        protein: 185,
        creatine: 5,
        waterL: 3.5,
        steps: 10400,
        sleepHours: 8,
        pagesRead: 22,
        mobilityMin: 10,
        journalMin: 10,
        goalReviewMin: 10,
        socialMin: 18,
      }
      d.trained = i % 7 !== 0
      d.restDay = i % 7 === 0
      d.closed = true
      days[date] = d
    }
    set({ ...state, days })
    return true
  },
}

export function exportJSON(): string {
  return JSON.stringify(state, null, 2)
}
