import { useSyncExternalStore } from 'react'
import {
  CHECKLIST,
  CORE_PRIORITIES,
  DEAL_STAGES,
  DEFAULT_BLOCKS,
  DEFAULT_DOMAINS,
  DEFAULT_GOALS,
  DEFAULT_LINKS,
  DEFAULT_LEARNING,
  DEFAULT_LOOPS,
  DEFAULT_REWARDS,
  DEFAULT_TARGETS,
  DEFAULT_UPKEEP,
  MAX_PRIORITIES,
  MORNING,
  PROTOCOL_DAYS,
} from './config'
import { addMinutes, todayISO, isoForDay } from './date'
import { uid } from './format'
import { EMPTY_METRICS, STATE_VERSION } from './types'
import type {
  AppState,
  BalanceSnapshot,
  Bill,
  Client,
  Connection,
  DayEntry,
  Deal,
  DomainLink,
  DomainNode,
  Goal,
  Holding,
  Invoice,
  Project,
  Task,
  LearnItem,
  LedgerEntry,
  Lesson,
  Loop,
  Priority,
  Targets,
  Theme,
  TimeBlock,
  Upkeep,
  WeekEntry,
} from './types'

const KEY = 'protocol126:v1'

function initialState(): AppState {
  return {
    version: STATE_VERSION,
    theme: 'dark',
    updatedAt: new Date(0).toISOString(),
    startDate: todayISO(),
    targets: { ...DEFAULT_TARGETS },
    days: {},
    weeks: {},
    ledger: [],
    balances: [],
    payoutReceived: 0,
    learning: DEFAULT_LEARNING.map((b) => ({ ...b, lessons: [] })),
    goals: DEFAULT_GOALS.map((g) => ({ ...g })),
    connections: [],
    upkeep: DEFAULT_UPKEEP.map((u) => ({ ...u })),
    loops: DEFAULT_LOOPS.map((l) => ({ ...l })),
    domains: DEFAULT_DOMAINS.map((d) => ({ ...d })),
    links: DEFAULT_LINKS.map((l) => ({ ...l })),
    bills: [],
    holdings: [],
    invoices: [],
    clients: [],
    deals: [],
    projects: [],
    tasks: [],
    rewards: DEFAULT_REWARDS.map((r) => ({ ...r })),
  }
}

/** v1 shape of the reading list, before books became one kind of learning. */
interface LegacyBook {
  id: string
  title: string
  status: 'reading' | 'done' | 'queued'
  notes: string
}

/**
 * v1 stored a flat `books` array. Fold it into `learning` so nothing read is
 * lost; returns undefined when there is nothing to migrate.
 */
function migrateBooks(parsed: Partial<AppState> & { books?: LegacyBook[] }): LearnItem[] | undefined {
  if (!parsed.books) return undefined
  return parsed.books.map((b) => ({
    id: b.id,
    kind: 'book' as const,
    title: b.title,
    source: '',
    status: b.status === 'reading' ? ('active' as const) : b.status,
    date: '',
    notes: b.notes ?? '',
    lessons: [],
  }))
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
    days[k] = {
      ...emptyDay(k),
      ...v,
      metrics: { ...EMPTY_METRICS, ...(v?.metrics ?? {}) },
      priorities: v?.priorities ?? emptySlots(k),
      blocks: v?.blocks ?? [],
      loops: v?.loops ?? [],
      answers: v?.answers ?? {},
    }
  }
  return {
    ...base,
    ...parsed,
    version: STATE_VERSION,
    theme: parsed.theme ?? base.theme,
    updatedAt: parsed.updatedAt ?? base.updatedAt,
    startDate: parsed.startDate ?? base.startDate,
    targets: { ...base.targets, ...(parsed.targets ?? {}) },
    days,
    weeks: parsed.weeks ?? {},
    ledger: parsed.ledger ?? [],
    balances: parsed.balances ?? [],
    payoutReceived: parsed.payoutReceived ?? 0,
    learning: parsed.learning ?? migrateBooks(parsed) ?? base.learning,
    // v1 goals were a flat list with no ladder, no branch and no key results.
    goals: (parsed.goals ?? base.goals).map((g) => {
      const legacy = g as Partial<Goal>
      return {
        parentId: '',
        horizon: 'year' as const,
        domainId: '',
        keyResults: [],
        ...legacy,
      } as Goal
    }),
    connections: (parsed.connections ?? base.connections).map((c) => {
      // v1 connections carried only name, why and status. Reading them as
      // partial is what lets the defaults below survive the spread.
      const legacy = c as Partial<Connection>
      return {
        role: '',
        lastContact: '',
        cadenceDays: 0,
        notes: '',
        ...legacy,
      } as Connection
    }),
    upkeep: parsed.upkeep ?? base.upkeep,
    loops: parsed.loops ?? base.loops,
    domains: parsed.domains ?? base.domains,
    links: parsed.links ?? base.links,
    bills: parsed.bills ?? [],
    holdings: parsed.holdings ?? [],
    invoices: parsed.invoices ?? [],
    clients: parsed.clients ?? [],
    deals: parsed.deals ?? [],
    projects: parsed.projects ?? [],
    tasks: parsed.tasks ?? [],
    rewards: parsed.rewards ?? base.rewards,
  }
}

/**
 * Slot ids are derived from the date rather than random, because `emptyDay` is
 * called during render for any day not yet logged — fresh ids each pass would
 * remount the inputs and lose what was being typed.
 */
export function emptySlots(date: string, n = CORE_PRIORITIES): Priority[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${date}-p${i + 1}`,
    text: '',
    done: false,
    tag: 'acmr' as const,
  }))
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
    priorities: emptySlots(date),
    blocks: [],
    planned: false,
    energy: 0,
    lesson: '',
    loops: [],
    answers: {},
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

/**
 * `stamp: false` is for state arriving from the server — re-stamping it would
 * make every pull look like a fresh local edit and the two devices would push
 * at each other forever.
 */
function set(next: AppState, stamp = true) {
  state = stamp ? { ...next, updatedAt: new Date().toISOString() } : next
  persist()
  listeners.forEach((l) => l())
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

/** Lets the sync layer react to local edits without rendering. */
export const subscribeStore = subscribe

export function getState(): AppState {
  return state
}

/** Replace local state with something already reconciled against the server. */
export function applyRemote(next: AppState) {
  set(hydrate(JSON.stringify(next)), false)
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

  setTheme(theme: Theme) {
    set({ ...state, theme })
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

  setPriorities(date: string, priorities: Priority[]) {
    actions.updateDay(date, { priorities })
  },

  updatePriority(date: string, id: string, patch: Partial<Priority>) {
    const prev = state.days[date] ?? emptyDay(date)
    actions.setPriorities(
      date,
      prev.priorities.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    )
  },

  addPriority(date: string) {
    const prev = state.days[date] ?? emptyDay(date)
    if (prev.priorities.length >= MAX_PRIORITIES) return
    actions.setPriorities(date, [
      ...prev.priorities,
      { id: uid(), text: '', done: false, tag: 'acmr' },
    ])
  },

  removePriority(date: string, id: string) {
    const prev = state.days[date] ?? emptyDay(date)
    actions.setPriorities(
      date,
      prev.priorities.filter((p) => p.id !== id),
    )
  },

  setBlocks(date: string, blocks: TimeBlock[]) {
    // Kept in clock order so the plan always reads top-to-bottom as the day runs.
    actions.updateDay(date, { blocks: [...blocks].sort((a, b) => a.start.localeCompare(b.start)) })
  },

  updateBlock(date: string, id: string, patch: Partial<TimeBlock>) {
    const prev = state.days[date] ?? emptyDay(date)
    actions.setBlocks(
      date,
      prev.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    )
  },

  addBlock(date: string) {
    const prev = state.days[date] ?? emptyDay(date)
    const last = prev.blocks[prev.blocks.length - 1]
    const start = last ? last.end : '09:00'
    actions.setBlocks(date, [
      ...prev.blocks,
      { id: uid(), start, end: addMinutes(start, 60), label: '', tag: 'acmr' },
    ])
  },

  removeBlock(date: string, id: string) {
    const prev = state.days[date] ?? emptyDay(date)
    actions.setBlocks(
      date,
      prev.blocks.filter((b) => b.id !== id),
    )
  },

  /** Lay the default shape over an empty day so there's something to edit. */
  seedBlocks(date: string) {
    const prev = state.days[date] ?? emptyDay(date)
    if (prev.blocks.length > 0) return
    actions.setBlocks(
      date,
      DEFAULT_BLOCKS.map((b) => ({ ...b, id: uid() })),
    )
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

  toggleLoop(date: string, id: string) {
    const prev = state.days[date] ?? emptyDay(date)
    const on = prev.loops.includes(id)
    actions.updateDay(date, {
      loops: on ? prev.loops.filter((l) => l !== id) : [...prev.loops, id],
    })
  },

  setAnswer(date: string, id: string, text: string) {
    const prev = state.days[date] ?? emptyDay(date)
    actions.updateDay(date, { answers: { ...prev.answers, [id]: text } })
  },

  setLoops(loops: Loop[]) {
    set({ ...state, loops })
  },

  setDomains(domains: DomainNode[]) {
    set({ ...state, domains })
  },

  updateDomain(id: string, patch: Partial<DomainNode>) {
    set({
      ...state,
      domains: state.domains.map((d) => (d.id === id ? { ...d, ...patch } : d)),
    })
  },

  addDomain(parentId: string, label: string) {
    set({
      ...state,
      domains: [
        ...state.domains,
        { id: uid(), parentId, label, note: '', loopIds: [], checkIds: [], metricKeys: [] },
      ],
    })
  },

  /** Removing a node takes its whole subtree, and any link touching it. */
  removeDomain(id: string) {
    const doomed = new Set<string>()
    const collect = (nodeId: string) => {
      doomed.add(nodeId)
      for (const child of state.domains.filter((d) => d.parentId === nodeId)) collect(child.id)
    }
    collect(id)
    set({
      ...state,
      domains: state.domains.filter((d) => !doomed.has(d.id)),
      links: state.links.filter((l) => !doomed.has(l.fromId) && !doomed.has(l.toId)),
    })
  },

  setLinks(links: DomainLink[]) {
    set({ ...state, links })
  },

  // --------------------------------------------------------------- money

  setBills(bills: Bill[]) {
    set({ ...state, bills })
  },

  updateBill(id: string, patch: Partial<Bill>) {
    set({ ...state, bills: state.bills.map((b) => (b.id === id ? { ...b, ...patch } : b)) })
  },

  setHoldings(holdings: Holding[]) {
    set({ ...state, holdings })
  },

  updateHolding(id: string, patch: Partial<Holding>) {
    set({
      ...state,
      holdings: state.holdings.map((h) =>
        h.id === id ? { ...h, ...patch, updated: todayISO() } : h,
      ),
    })
  },

  setInvoices(invoices: Invoice[]) {
    set({ ...state, invoices })
  },

  updateInvoice(id: string, patch: Partial<Invoice>) {
    set({
      ...state,
      invoices: state.invoices.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    })
  },

  /** Marking one paid stamps the date, which is what the days-to-pay average reads. */
  markInvoicePaid(id: string, iso = todayISO()) {
    actions.updateInvoice(id, { status: 'paid', paidDate: iso })
  },

  // ---------------------------------------------------------------- work

  setClients(clients: Client[]) {
    set({ ...state, clients })
  },

  updateClient(id: string, patch: Partial<Client>) {
    set({ ...state, clients: state.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) })
  },

  setDeals(deals: Deal[]) {
    set({ ...state, deals })
  },

  updateDeal(id: string, patch: Partial<Deal>) {
    set({ ...state, deals: state.deals.map((d) => (d.id === id ? { ...d, ...patch } : d)) })
  },

  /** Moving a stage restamps `moved`, which is what the stale check reads. */
  moveDeal(id: string, stage: Deal['stage']) {
    const deal = state.deals.find((d) => d.id === id)
    if (!deal || deal.stage === stage) return
    const preset = DEAL_STAGES.find((s) => s.id === stage)
    actions.updateDeal(id, {
      stage,
      moved: todayISO(),
      // Keep a hand-set probability unless the stage is terminal.
      probability:
        stage === 'won' || stage === 'lost' ? (preset?.probability ?? 0) : deal.probability,
    })
  },

  setProjects(projects: Project[]) {
    set({ ...state, projects })
  },

  updateProject(id: string, patch: Partial<Project>) {
    set({ ...state, projects: state.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) })
  },

  setTasks(tasks: Task[]) {
    set({ ...state, tasks })
  },

  addTask(task: Task) {
    set({ ...state, tasks: [task, ...state.tasks] })
  },

  updateTask(id: string, patch: Partial<Task>) {
    set({ ...state, tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })
  },

  toggleTask(id: string) {
    const task = state.tasks.find((t) => t.id === id)
    if (!task) return
    const done = !task.done
    actions.updateTask(id, { done, doneDate: done ? todayISO() : '' })
  },

  removeTask(id: string) {
    set({ ...state, tasks: state.tasks.filter((t) => t.id !== id) })
  },

  setLearning(learning: LearnItem[]) {
    set({ ...state, learning })
  },

  updateLearnItem(id: string, patch: Partial<LearnItem>) {
    set({
      ...state,
      learning: state.learning.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    })
  },

  addLesson(itemId: string, lesson: Lesson) {
    actions.updateLearnItem(itemId, {
      lessons: [lesson, ...(state.learning.find((i) => i.id === itemId)?.lessons ?? [])],
    })
  },

  updateLesson(itemId: string, lessonId: string, patch: Partial<Lesson>) {
    const item = state.learning.find((i) => i.id === itemId)
    if (!item) return
    actions.updateLearnItem(itemId, {
      lessons: item.lessons.map((l) => (l.id === lessonId ? { ...l, ...patch } : l)),
    })
  },

  removeLesson(itemId: string, lessonId: string) {
    const item = state.learning.find((i) => i.id === itemId)
    if (!item) return
    actions.updateLearnItem(itemId, {
      lessons: item.lessons.filter((l) => l.id !== lessonId),
    })
  },

  setGoals(goals: Goal[]) {
    set({ ...state, goals })
  },

  setConnections(connections: Connection[]) {
    set({ ...state, connections })
  },

  updateConnection(id: string, patch: Partial<Connection>) {
    set({
      ...state,
      connections: state.connections.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    })
  },

  /** Log a real conversation, which is what restarts the cadence clock. */
  logContact(id: string, iso = todayISO()) {
    actions.updateConnection(id, { lastContact: iso })
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
