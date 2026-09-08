import { useSyncExternalStore } from 'react'
import {
  DEFAULT_CHECKLIST,
  CORE_PRIORITIES,
  DEAL_STAGES,
  DEFAULT_BLOCKS,
  DEFAULT_DOMAINS,
  DEFAULT_GOALS,
  DEFAULT_LINKS,
  DEFAULT_LEARNING,
  DEFAULT_LOOPS,
  DEFAULT_TRACKERS,
  DEFAULT_VISION,
  STARTER_SHAPE,
  DEFAULT_REWARDS,
  DEFAULT_TARGETS,
  DEFAULT_UPKEEP,
  CORE_QUESTIONS,
  MAX_PRIORITIES,
  MORNING,
  SHUTDOWN,
} from './config'
import { addDays, addMinutes, todayISO } from './date'
import { uid } from './format'
import { emptyMarketingDay } from './marketing'
import type { MarketingDay } from './marketing'
import { EMPTY_METRICS, STATE_VERSION } from './types'
import type {
  AppState,
  BalanceSnapshot,
  Bill,
  CalendarEvent,
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
  ShapeBlock,
  Transaction,
  Targets,
  Theme,
  TimeBlock,
  Tracker,
  TimeLogSlot,
  Upkeep,
  Vision,
  VisionColumn,
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
    transactions: [],
    events: [],
    vision: { ...DEFAULT_VISION, columns: DEFAULT_VISION.columns.map((c) => ({ ...c, images: [] })) },
    // Empty by default — nothing is assumed about anyone's day. The starter
    // shape is offered once, from Settings, never forced.
    dayShape: [],
    morningRitual: MORNING.map((m) => ({ ...m })),
    shutdownRitual: SHUTDOWN.map((s) => ({ id: s.id, label: s.label, hint: s.hint ?? '' })),
    nightlyQuestions: CORE_QUESTIONS.map((q) => ({ id: q.id, q: q.q, hint: q.hint ?? '' })),
    trackers: DEFAULT_TRACKERS.map((t) => ({ ...t })),
    bills: [],
    holdings: [],
    invoices: [],
    clients: [],
    deals: [],
    projects: [],
    tasks: [],
    rewards: DEFAULT_REWARDS.map((r) => ({ ...r })),
    checklist: DEFAULT_CHECKLIST.map((c) => ({ ...c })),
    marketing: { startDate: todayISO(), days: {} },
  }
}

/**
 * v2 and earlier called the consulting business ACMR, and the id leaked into
 * every corner of the document: metric keys, account ids, entity tags, domain
 * ids, even free text. A deep rename is the only honest migration — anything
 * narrower would leave a stored day keyed `acmrHours` that the app no longer
 * reads, and the hours would silently vanish.
 */
const RENAMES: [RegExp, string][] = [
  [/\bacmrBank\b/g, 'consultingBank'],
  [/\bacmrHours\b/g, 'consultingHours'],
  [/\bacmr_/g, 'consulting_'],
  [/\bacmr\b/g, 'consulting'],
  [/ACMR/g, 'Consulting.ie'],
]

function renamed(text: string): string {
  return RENAMES.reduce((acc, [from, to]) => acc.replace(from, to), text)
}

function migrateEntityIds<T>(value: T): T {
  if (typeof value === 'string') return renamed(value) as unknown as T
  if (Array.isArray(value)) return value.map(migrateEntityIds) as unknown as T
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        renamed(k),
        migrateEntityIds(v),
      ]),
    ) as T
  }
  return value
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
  // Runs before anything reads a key, so the rest of hydrate sees only new ids.
  if ((parsed.version ?? 1) < 3) parsed = migrateEntityIds(parsed)
  // 1Media split from one account into three. The single old balance becomes
  // the AIB one — the operating account it actually stood for — so nothing
  // written before the split just vanishes.
  if ((parsed.version ?? 1) < 8 && Array.isArray(parsed.balances)) {
    parsed = {
      ...parsed,
      balances: parsed.balances.map((b) =>
        (b as { account: string }).account === 'onemediaBank'
          ? { ...b, account: 'onemediaAib' }
          : b,
      ),
    }
  }
  // Personal split the same way — one account becomes two, and the old
  // balance becomes the AIB one, the account it actually was.
  if ((parsed.version ?? 1) < 9 && Array.isArray(parsed.balances)) {
    parsed = {
      ...parsed,
      balances: parsed.balances.map((b) =>
        (b as { account: string }).account === 'personalBank'
          ? { ...b, account: 'personalAib' }
          : b,
      ),
    }
  }
  // "Cash in bank" was a manual tracker that duplicated what the ledger
  // already computes live from expense and cash-collected entries — it's
  // gone, so nobody's left with a dead field asking to be re-entered by hand.
  if ((parsed.version ?? 1) < 12) {
    parsed = {
      ...parsed,
      trackers: (parsed.trackers ?? []).filter((t) => t.id !== 'tk_bank'),
      days: Object.fromEntries(
        Object.entries(parsed.days ?? {}).map(([k, v]) => {
          if (!v?.trackers?.tk_bank && !v?.trackerNotes?.tk_bank) return [k, v]
          const trackers = { ...v.trackers }
          const trackerNotes = { ...v.trackerNotes }
          delete trackers.tk_bank
          delete trackerNotes.tk_bank
          return [k, { ...v, trackers, trackerNotes }]
        }),
      ),
    }
  }
  const days: Record<string, DayEntry> = {}
  for (const [k, v] of Object.entries(parsed.days ?? {})) {
    days[k] = {
      ...emptyDay(k),
      ...v,
      metrics: { ...EMPTY_METRICS, ...(v?.metrics ?? {}) },
      priorities: v?.priorities ?? emptySlots(k),
      // Blocks predate kinds and task assignment. Read as partial: TS treats
      // an already-typed TimeBlock as carrying those fields for real, so a
      // plain spread after the defaults is flagged as overwriting itself.
      blocks: (v?.blocks ?? []).map((b) => {
        const legacy = b as Partial<TimeBlock>
        return { kind: 'deep' as const, taskIds: [], auto: false, ...legacy } as TimeBlock
      }),
      loops: v?.loops ?? [],
      answers: v?.answers ?? {},
      trackers: v?.trackers ?? {},
      trackerNotes: v?.trackerNotes ?? {},
      journal: v?.journal ?? '',
      timeLog: v?.timeLog ?? {},
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
    // Ledger entries predate account attribution — unattributed is correct
    // for anything logged before this, since there is no way to know which
    // account it touched.
    ledger: (parsed.ledger ?? []).map((e) => {
      const legacy = e as Partial<LedgerEntry>
      return { account: '' as const, ...legacy } as LedgerEntry
    }),
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
    transactions: parsed.transactions ?? [],
    events: parsed.events ?? [],
    vision: parsed.vision ?? base.vision,
    dayShape: parsed.dayShape ?? base.dayShape,
    morningRitual: parsed.morningRitual ?? base.morningRitual,
    shutdownRitual: parsed.shutdownRitual ?? base.shutdownRitual,
    nightlyQuestions: parsed.nightlyQuestions ?? base.nightlyQuestions,
    trackers: parsed.trackers ?? base.trackers,
    bills: parsed.bills ?? [],
    holdings: parsed.holdings ?? [],
    invoices: parsed.invoices ?? [],
    clients: parsed.clients ?? [],
    deals: parsed.deals ?? [],
    projects: parsed.projects ?? [],
    // Tasks predate scheduling, estimates, priority bands and goal tagging.
    tasks: (parsed.tasks ?? []).map((t) => {
      const legacy = t as Partial<Task>
      return {
        scheduled: '',
        estimateMin: 0,
        priority: 2,
        kindHint: '',
        goalId: '',
        ...legacy,
      } as Task
    }),
    rewards: parsed.rewards ?? base.rewards,
    checklist: parsed.checklist ?? base.checklist,
    marketing: {
      startDate: parsed.marketing?.startDate ?? base.marketing.startDate,
      days: parsed.marketing?.days ?? {},
    },
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
    tag: 'consulting' as const,
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
    trackers: {},
    trackerNotes: {},
    journal: '',
    timeLog: {},
    closed: false,
  }
}

/**
 * One place that knows a task's shape. Four call sites were building the object
 * by hand, so every new field broke all of them.
 */
export function newTask(title: string, over: Partial<Task> = {}): Task {
  return {
    id: uid(),
    projectId: '',
    entity: 'consulting',
    title,
    done: false,
    due: '',
    scheduled: '',
    estimateMin: 0,
    priority: 2,
    kindHint: '',
    created: todayISO(),
    doneDate: '',
    goalId: '',
    ...over,
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
      { id: uid(), text: '', done: false, tag: 'consulting' },
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
      {
        id: uid(),
        start,
        end: addMinutes(start, 60),
        label: '',
        tag: 'consulting',
        kind: 'deep',
        taskIds: [],
        auto: false,
      },
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
    const shape = state.dayShape.length ? state.dayShape : DEFAULT_BLOCKS.map((b) => ({ ...b, id: '' }))
    actions.setBlocks(
      date,
      shape.map((b) => ({
        id: uid(),
        start: b.start,
        end: b.end,
        label: b.label,
        tag: b.tag,
        kind: b.kind,
        taskIds: [],
        auto: false,
      })),
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

  setRewards(rewards: AppState['rewards']) {
    set({ ...state, rewards })
  },

  /** One field of one marketing day. Absent days are created on first write. */
  setMarketingField<K extends keyof MarketingDay>(
    date: string,
    key: K,
    value: MarketingDay[K],
  ) {
    const prev = state.marketing.days[date] ?? emptyMarketingDay()
    set({
      ...state,
      marketing: {
        ...state.marketing,
        days: { ...state.marketing.days, [date]: { ...prev, [key]: value } },
      },
    })
  },

  setMarketingStart(startDate: string) {
    set({ ...state, marketing: { ...state.marketing, startDate } })
  },

  setChecklist(checklist: AppState['checklist']) {
    set({ ...state, checklist })
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

  /** Board drag. Stamping a position is what opts a node out of auto-layout. */
  moveDomain(id: string, x: number, y: number) {
    set({
      ...state,
      domains: state.domains.map((d) => (d.id === id ? { ...d, x, y } : d)),
    })
  },

  /** Hand every node back to the tidy layout. */
  resetDomainLayout() {
    set({
      ...state,
      domains: state.domains.map(({ x: _x, y: _y, ...rest }) => rest),
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

  // -------------------------------------------------------- transactions

  /**
   * Bulk import, deduplicated against what's already there. A transaction is
   * treated as the same one if its date, amount and description all match —
   * good enough for a bank export, where that combination is effectively
   * unique, and it's what lets re-importing an overlapping statement be safe
   * rather than something you have to be careful about.
   */
  importTransactions(
    rows: Omit<Transaction, 'id' | 'category' | 'notes' | 'importBatch'>[],
    batch: string,
  ) {
    const seen = new Set(
      state.transactions.map((t) => `${t.date}|${t.amount}|${t.description}`),
    )
    const fresh = rows.filter((r) => !seen.has(`${r.date}|${r.amount}|${r.description}`))
    const added = fresh.map((r) => ({
      ...r,
      id: uid(),
      category: '' as const,
      notes: '',
      importBatch: batch,
    }))
    set({ ...state, transactions: [...added, ...state.transactions] })
    return added.length
  },

  categoriseTransaction(id: string, category: Transaction['category']) {
    set({
      ...state,
      transactions: state.transactions.map((t) => (t.id === id ? { ...t, category } : t)),
    })
  },

  setTransactionAccount(id: string, account: Transaction['account']) {
    set({
      ...state,
      transactions: state.transactions.map((t) => (t.id === id ? { ...t, account } : t)),
    })
  },

  removeTransaction(id: string) {
    set({ ...state, transactions: state.transactions.filter((t) => t.id !== id) })
  },

  clearImportBatch(batch: string) {
    set({ ...state, transactions: state.transactions.filter((t) => t.importBatch !== batch) })
  },

  // ------------------------------------------------------------ calendar

  setEvents(events: CalendarEvent[]) {
    set({ ...state, events })
  },

  addEvent(event: CalendarEvent) {
    set({ ...state, events: [...state.events, event] })
  },

  updateEvent(id: string, patch: Partial<CalendarEvent>) {
    set({ ...state, events: state.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
  },

  removeEvent(id: string) {
    set({ ...state, events: state.events.filter((e) => e.id !== id) })
  },

  // -------------------------------------------------------------- vision

  setVision(patch: Partial<Vision>) {
    set({ ...state, vision: { ...state.vision, ...patch } })
  },

  updateVisionColumn(id: string, patch: Partial<VisionColumn>) {
    set({
      ...state,
      vision: {
        ...state.vision,
        columns: state.vision.columns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      },
    })
  },

  addVisionColumn(title: string) {
    actions.setVision({
      columns: [...state.vision.columns, { id: uid(), title, headline: '', body: '', images: [] }],
    })
  },

  removeVisionColumn(id: string) {
    actions.setVision({ columns: state.vision.columns.filter((c) => c.id !== id) })
  },

  addVisionImage(columnId: string, src: string, caption = '') {
    const col = state.vision.columns.find((c) => c.id === columnId)
    if (!col) return
    actions.updateVisionColumn(columnId, {
      images: [...col.images, { id: uid(), src, caption }],
    })
  },

  removeVisionImage(columnId: string, imageId: string) {
    const col = state.vision.columns.find((c) => c.id === columnId)
    if (!col) return
    actions.updateVisionColumn(columnId, {
      images: col.images.filter((i) => i.id !== imageId),
    })
  },

  // ------------------------------------------------------------ trackers

  setTrackers(trackers: Tracker[]) {
    set({ ...state, trackers })
  },

  setTrackerValue(date: string, id: string, value: number) {
    const prev = state.days[date] ?? emptyDay(date)
    actions.updateDay(date, {
      trackers: { ...prev.trackers, [id]: Math.max(0, value) },
    })
  },

  /** Writes one quarter-hour slot. Empty text and 0 rating removes it. */
  setTimeLogSlot(date: string, slot: string, patch: Partial<TimeLogSlot>) {
    const prev = state.days[date] ?? emptyDay(date)
    const current = prev.timeLog[slot] ?? { text: '', rating: 0 }
    const next = { ...current, ...patch }
    const timeLog = { ...prev.timeLog }
    if (next.text.trim() === '' && next.rating === 0) delete timeLog[slot]
    else timeLog[slot] = next
    actions.updateDay(date, { timeLog })
  },

  setTrackerNote(date: string, id: string, text: string) {
    const prev = state.days[date] ?? emptyDay(date)
    actions.updateDay(date, { trackerNotes: { ...prev.trackerNotes, [id]: text } })
  },

  toggleTracker(date: string, id: string) {
    const prev = state.days[date] ?? emptyDay(date)
    actions.setTrackerValue(date, id, prev.trackers[id] ? 0 : 1)
  },

  // -------------------------------------------------------- editable rituals

  setMorningRitual(items: { id: string; label: string }[]) {
    set({ ...state, morningRitual: items })
  },

  addMorningItem(label: string) {
    actions.setMorningRitual([...state.morningRitual, { id: uid(), label }])
  },

  removeMorningItem(id: string) {
    actions.setMorningRitual(state.morningRitual.filter((m) => m.id !== id))
  },

  setShutdownRitual(items: { id: string; label: string; hint: string }[]) {
    set({ ...state, shutdownRitual: items })
  },

  addShutdownItem(label: string) {
    actions.setShutdownRitual([...state.shutdownRitual, { id: uid(), label, hint: '' }])
  },

  removeShutdownItem(id: string) {
    actions.setShutdownRitual(state.shutdownRitual.filter((s) => s.id !== id))
  },

  setNightlyQuestions(items: { id: string; q: string; hint: string }[]) {
    set({ ...state, nightlyQuestions: items })
  },

  addNightlyQuestion(q: string) {
    actions.setNightlyQuestions([...state.nightlyQuestions, { id: uid(), q, hint: '' }])
  },

  removeNightlyQuestion(id: string) {
    actions.setNightlyQuestions(state.nightlyQuestions.filter((q) => q.id !== id))
  },

  // ------------------------------------------------------------ day shape

  setDayShape(dayShape: ShapeBlock[]) {
    // Kept in clock order so it always reads top-to-bottom.
    set({ ...state, dayShape: [...dayShape].sort((a, b) => a.start.localeCompare(b.start)) })
  },

  addShapeBlock() {
    const last = state.dayShape[state.dayShape.length - 1]
    const start = last ? last.end : '09:00'
    actions.setDayShape([
      ...state.dayShape,
      { id: uid(), start, end: addMinutes(start, 60), label: '', tag: 'consulting', kind: 'deep' },
    ])
  },

  updateShapeBlock(id: string, patch: Partial<ShapeBlock>) {
    actions.setDayShape(state.dayShape.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  },

  removeShapeBlock(id: string) {
    actions.setDayShape(state.dayShape.filter((b) => b.id !== id))
  },

  /** Loads the suggested starting shape. Only offered while yours is empty. */
  useStarterShape() {
    if (state.dayShape.length > 0) return
    actions.setDayShape(STARTER_SHAPE.map((b) => ({ ...b, id: uid() })) as ShapeBlock[])
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

  scheduleTask(id: string, date: string) {
    actions.updateTask(id, { scheduled: date })
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
  /**
   * Fill the app with a plausible sixty days so every screen has something to
   * show. An empty personal OS can't be judged: no oscillation, no patterns, no
   * runway, and no way to tell whether any of it would be useful to you.
   *
   * The run deliberately oscillates and trends upward, because that is the
   * shape the pattern engine exists to find. Refuses to run once anything real
   * is logged — this must never be able to overwrite actual entries.
   */
  seedDemo(): boolean {
    if (Object.keys(state.days).length > 0) return false

    const today = todayISO()
    const at = (back: number) => addDays(today, -back)
    const manual = state.checklist.filter((c) => !c.metric && c.id !== 'training').map((c) => c.id)
    const days: Record<string, DayEntry> = {}

    for (let i = 60; i >= 1; i--) {
      const date = at(i)
      const t = 60 - i
      // A ~21-day cycle around a slowly rising centre, plus a little noise.
      const q = Math.max(
        0.1,
        Math.min(1, (Math.sin(t / 3.3) * 0.5 + 0.5) * 0.72 + t / 170 + (Math.random() - 0.5) * 0.1),
      )
      const weak = q < 0.45
      const d = emptyDay(date)

      for (const id of manual) d.checks[id] = Math.random() < q
      for (const m of MORNING) d.checks[m.id] = Math.random() < q + 0.1

      d.metrics = {
        consultingHours: Number((10 * q).toFixed(1)),
        calories: Math.round(3000 * Math.min(1, q + 0.2)),
        protein: Math.round(185 * q),
        creatine: q > 0.5 ? 5 : 0,
        waterL: Number((3.5 * q).toFixed(2)),
        steps: Math.round(11000 * q),
        sleepHours: Number((5 + 3 * q).toFixed(2)),
        pagesRead: Math.round(22 * q),
        mobilityMin: q > 0.5 ? 10 : 0,
        journalMin: q > 0.55 ? 10 : 0,
        goalReviewMin: q > 0.6 ? 10 : 0,
        socialMin: Math.round(20 + 70 * (1 - q)),
      }
      d.trained = q > 0.45
      d.restDay = false
      d.planned = q > 0.4
      d.energy = Math.max(1, Math.round(q * 5))
      d.closed = true

      d.priorities = [
        {
          id: `${date}-p1`,
          text: q < 0.4 ? 'Rebuild the Consulting.ie sales page' : 'Close the Kavanagh retainer',
          done: Math.random() < q,
          tag: 'consulting',
        },
        { id: `${date}-p2`, text: '1Media content batch', done: Math.random() < q, tag: 'onemedia' },
        { id: `${date}-p3`, text: 'Gym and meal prep', done: Math.random() < q * 1.1, tag: 'life' },
      ]

      const loops: string[] = []
      if (weak) {
        loops.push('l_avoid')
        if (Math.random() < 0.6) loops.push('l_scroll')
        if (Math.random() < 0.5) loops.push('l_latenight')
      }
      if (q < 0.6 && Math.random() < 0.5) loops.push('l_busywork')
      if (q < 0.35) loops.push('l_numb')
      d.loops = loops

      days[date] = d
    }

    set({
      ...state,
      startDate: at(60),
      days,
      balances: [
        { id: 'sb1', date: at(1), account: 'consultingBank', amount: 184_000 },
        { id: 'sb2', date: at(1), account: 'onemediaStripe', amount: 4_200 },
        { id: 'sb2b', date: at(1), account: 'onemediaAib', amount: 9_800 },
        { id: 'sb2c', date: at(1), account: 'onemediaRev', amount: 2_000 },
        { id: 'sb3', date: at(1), account: 'personalAib', amount: 30_000 },
        { id: 'sb3b', date: at(1), account: 'personalRev', amount: 12_000 },
      ],
      clients: [
        { id: 'sc1', entity: 'consulting', name: 'Kavanagh Group', status: 'active', monthlyValue: 9500, since: at(300), renewal: addDays(today, 18), notes: '' },
        { id: 'sc2', entity: 'consulting', name: 'Nolan Retail', status: 'active', monthlyValue: 3200, since: at(120), renewal: '', notes: '' },
        { id: 'sc3', entity: 'onemedia', name: 'Aer Retail', status: 'prospect', monthlyValue: 0, since: at(20), renewal: '', notes: '' },
      ],
      deals: [
        { id: 'sd1', entity: 'consulting', name: 'Kavanagh expansion', clientId: 'sc1', stage: 'proposal', value: 48_000, probability: 60, expectedClose: addDays(today, 24), nextStep: 'Chase the signature', moved: at(3), notes: '' },
        { id: 'sd2', entity: 'consulting', name: 'Byrne Motors retainer', clientId: '', stage: 'qualified', value: 24_000, probability: 30, expectedClose: addDays(today, 45), nextStep: '', moved: at(31), notes: '' },
        { id: 'sd3', entity: 'onemedia', name: 'Aer sponsorship', clientId: 'sc3', stage: 'lead', value: 15_000, probability: 10, expectedClose: '', nextStep: 'Send the deck', moved: at(2), notes: '' },
        { id: 'sd4', entity: 'consulting', name: 'Doyle Group', clientId: '', stage: 'won', value: 36_000, probability: 100, expectedClose: at(14), nextStep: '', moved: at(14), notes: '' },
        { id: 'sd5', entity: 'consulting', name: 'Hartley', clientId: '', stage: 'lost', value: 12_000, probability: 0, expectedClose: at(30), nextStep: '', moved: at(30), notes: '' },
      ],
      projects: [
        { id: 'sp1', entity: 'consulting', name: 'Sales page rebuild', clientId: '', status: 'active', due: addDays(today, 10), notes: '' },
      ],
      tasks: [
        { id: 'st1', projectId: 'sp1', entity: 'consulting', title: 'Write the new headline', done: true, due: at(2), scheduled: at(3), estimateMin: 45, priority: 2, kindHint: '', created: at(6), doneDate: at(3), goalId: '' },
        { id: 'st2', projectId: 'sp1', entity: 'consulting', title: 'Rebuild the pricing table', done: false, due: at(1), scheduled: today, estimateMin: 120, priority: 1, kindHint: '', created: at(6), doneDate: '', goalId: '' },
        { id: 'st3', projectId: '', entity: 'onemedia', title: 'Batch four videos', done: false, due: today, scheduled: today, estimateMin: 180, priority: 2, kindHint: '', created: at(2), doneDate: '', goalId: '' },
        { id: 'st4', projectId: '', entity: 'life', title: 'Book the dentist', done: false, due: '', scheduled: '', estimateMin: 15, priority: 3, kindHint: '', created: at(9), doneDate: '', goalId: '' },
        { id: 'st5', projectId: '', entity: 'consulting', title: 'Call Kavanagh re: renewal', done: false, due: '', scheduled: today, estimateMin: 15, priority: 1, kindHint: 'calls', created: at(1), doneDate: '', goalId: '' },
      ],
      bills: [
        { id: 'sx1', label: 'Office rent', amount: 4200, cadence: 'monthly', nextDue: addDays(today, 3), purse: 'consulting', category: 'Premises' },
        { id: 'sx2', label: 'Payroll', amount: 31_000, cadence: 'monthly', nextDue: addDays(today, 9), purse: 'consulting', category: 'People' },
        { id: 'sx3', label: 'Software', amount: 1800, cadence: 'annual', nextDue: addDays(today, 120), purse: 'consulting', category: 'Tooling' },
        { id: 'sx4', label: 'Mortgage', amount: 2100, cadence: 'monthly', nextDue: addDays(today, 12), purse: 'personal', category: 'Property' },
      ],
      holdings: [
        { id: 'sh1', kind: 'asset', label: 'House', value: 640_000, category: 'Property', liquid: false, updated: at(30) },
        { id: 'sh2', kind: 'asset', label: 'Index funds', value: 88_000, category: 'Investments', liquid: true, updated: at(4) },
        { id: 'sh3', kind: 'asset', label: 'Cash', value: 42_000, category: 'Cash', liquid: true, updated: at(1) },
        { id: 'sh4', kind: 'liability', label: 'Mortgage', value: 310_000, category: 'Mortgage', liquid: false, updated: at(30) },
        { id: 'sh5', kind: 'liability', label: 'Tax owed', value: 54_000, category: 'Tax owed', liquid: false, updated: at(8) },
      ],
      invoices: [
        { id: 'si1', entity: 'consulting', clientId: 'sc1', reference: 'INV-041', amount: 9500, issued: at(52), due: at(22), status: 'sent', paidDate: '' },
        { id: 'si2', entity: 'consulting', clientId: 'sc2', reference: 'INV-042', amount: 3200, issued: at(20), due: addDays(today, 10), status: 'sent', paidDate: '' },
        { id: 'si3', entity: 'consulting', clientId: 'sc1', reference: 'INV-039', amount: 9500, issued: at(80), due: at(50), status: 'paid', paidDate: at(44) },
      ],
      connections: [
        { id: 'sn1', name: 'Caoimhe', role: 'Partner', why: 'The person it is all for', status: 'inner', lastContact: at(1), cadenceDays: 7, notes: '' },
        { id: 'sn2', name: 'Richard Doyle', role: 'MD, Doyle Group', why: 'Warm intro to three retainer-sized clients', status: 'reachedOut', lastContact: at(24), cadenceDays: 14, notes: '' },
        { id: 'sn3', name: 'Mam', role: '', why: '', status: 'inner', lastContact: at(11), cadenceDays: 7, notes: '' },
        { id: 'sn4', name: 'Sinead Walsh', role: 'Head of Brand, Aer Retail', why: '1Media sponsorship budget holder', status: 'target', lastContact: '', cadenceDays: 30, notes: '' },
      ],
      vision: {
        ...state.vision,
        year: new Date().getFullYear(),
        intro:
          'The year the business stopped depending on me being in the room, and the body stopped being the thing I put last.',
        columns: state.vision.columns.map((c) => {
          const filled: Record<string, { headline: string; body: string }> = {
            v_health: {
              headline: '95kg lean, sub-12% by December',
              body: 'Five sessions a week, 185g protein, eight hours. Progress photos every Sunday.',
            },
            v_wealth: {
              headline: '€1M cash collected in Consulting.ie',
              body: 'Three retainers over €10k a month. No client above 30% of MRR.',
            },
            v_love: {
              headline: 'Present, not just around',
              body: 'One phone-free evening a week with Caoimhe. Two trips out of the country.',
            },
            v_network: {
              headline: 'Twelve rooms I have no business being in',
              body: 'One warm introduction a fortnight. A dinner I host every quarter.',
            },
            v_happiness: {
              headline: 'A life I would not need a holiday from',
              body: 'An office I want to walk into. Saturdays that are actually off.',
            },
          }
          return { ...c, ...(filled[c.id] ?? {}) }
        }),
      },
      events: [
        { id: 'se1', title: "Caoimhe's birthday", date: addDays(today, 26), time: '', durationMin: 0, repeat: 'yearly', tag: 'life', notes: '', remindDays: 14 },
        { id: 'se2', title: 'Kavanagh renewal call', date: addDays(today, 11), time: '10:00', durationMin: 45, repeat: 'none', tag: 'consulting', notes: 'Start the expansion conversation before they do.', remindDays: 7 },
        { id: 'se3', title: 'Quarterly dinner I host', date: addDays(today, 40), time: '19:30', durationMin: 180, repeat: 'monthly', tag: 'life', notes: '', remindDays: 10 },
        { id: 'se4', title: 'Weekly review', date: addDays(today, 1), time: '17:00', durationMin: 60, repeat: 'weekly', tag: 'life', notes: '', remindDays: 1 },
      ],
      ledger: [
        { id: 'sl1', date: at(14), entity: 'consulting', kind: 'revenue', amount: 36_000, note: 'Doyle Group', account: '' },
        { id: 'sl2', date: at(12), entity: 'consulting', kind: 'cashCollected', amount: 18_000, note: 'Doyle deposit', account: 'consultingBank' },
        { id: 'sl3', date: at(44), entity: 'consulting', kind: 'cashCollected', amount: 9500, note: 'INV-039', account: 'consultingBank' },
        { id: 'sl4', date: at(30), entity: 'consulting', kind: 'payout', amount: 12_000, note: 'To personal', account: '' },
      ],
    })
    return true
  },

}

export function exportJSON(): string {
  return JSON.stringify(state, null, 2)
}
