import { useSyncExternalStore } from 'react'
import { supabase, syncConfigured, TABLE } from './supabase'
import { applyRemote, getState, subscribeStore } from './store'
import type { AppState } from './types'

export type SyncPhase = 'off' | 'signedOut' | 'syncing' | 'synced' | 'offline' | 'error'

export interface SyncState {
  configured: boolean
  phase: SyncPhase
  email: string | null
  lastSyncedAt: string | null
  error: string | null
}

let syncState: SyncState = {
  configured: syncConfigured,
  phase: syncConfigured ? 'signedOut' : 'off',
  email: null,
  lastSyncedAt: null,
  error: null,
}

const listeners = new Set<() => void>()

function setSync(patch: Partial<SyncState>) {
  syncState = { ...syncState, ...patch }
  listeners.forEach((l) => l())
}

export function useSync(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => syncState,
    () => syncState,
  )
}

// ---------------------------------------------------------------------------
// Merge

/**
 * Whichever document was written last wins outright for the lists (ledger,
 * balances, goals, learning…), because merging those by id would resurrect
 * anything deleted on the other device.
 *
 * Days and weeks are merged by key instead: logging Tuesday on your phone and
 * Wednesday on the Mac has to keep both, and that's the case that actually
 * happens. When the same day was touched on both, the newer document wins.
 */
export function mergeStates(local: AppState, remote: AppState): AppState {
  const localNewer = local.updatedAt >= remote.updatedAt
  const base = localNewer ? local : remote
  const other = localNewer ? remote : local
  return {
    ...base,
    days: { ...other.days, ...base.days },
    weeks: { ...other.weeks, ...base.weeks },
    updatedAt: base.updatedAt,
  }
}

// ---------------------------------------------------------------------------
// Engine

let userId: string | null = null
let pushTimer: ReturnType<typeof setTimeout> | undefined
let lastPushedAt: string | null = null
let started = false

async function pull(): Promise<void> {
  if (!supabase || !userId) return
  setSync({ phase: 'syncing', error: null })

  const { data, error } = await supabase
    .from(TABLE)
    .select('doc, updated_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    setSync({ phase: 'error', error: error.message })
    return
  }

  if (!data) {
    // First device for this account — seed the row from what's here.
    await push()
    return
  }

  const remote = data.doc as AppState
  const merged = mergeStates(getState(), remote)
  applyRemote(merged)

  // Write back only when the merge left the server holding something stale:
  // either local edits were newer, or local had days the server never saw.
  const serverIsStale =
    merged.updatedAt !== remote.updatedAt || countKeys(merged) !== countKeys(remote)

  if (serverIsStale) await push()
  else setSync({ phase: 'synced', lastSyncedAt: new Date().toISOString() })
}

function countKeys(s: AppState): number {
  return Object.keys(s.days).length + Object.keys(s.weeks).length
}

async function push(): Promise<void> {
  if (!supabase || !userId) return
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setSync({ phase: 'offline' })
    return
  }

  const doc = getState()
  setSync({ phase: 'syncing', error: null })

  const { error } = await supabase
    .from(TABLE)
    .upsert({ user_id: userId, doc, updated_at: doc.updatedAt }, { onConflict: 'user_id' })

  if (error) {
    setSync({ phase: 'error', error: error.message })
    return
  }

  lastPushedAt = doc.updatedAt
  setSync({ phase: 'synced', lastSyncedAt: new Date().toISOString(), error: null })
}

function schedulePush() {
  if (!userId) return
  clearTimeout(pushTimer)
  pushTimer = setTimeout(() => void push(), 1200)
}

/** Call once at startup. Safe to call when no backend is configured. */
export function initSync(): void {
  if (!supabase || started) return
  started = true

  supabase.auth.getSession().then(({ data }) => {
    handleSession(data.session?.user?.id ?? null, data.session?.user?.email ?? null)
  })

  supabase.auth.onAuthStateChange((_event, session) => {
    handleSession(session?.user?.id ?? null, session?.user?.email ?? null)
  })

  subscribeStore(() => {
    if (userId) schedulePush()
  })

  window.addEventListener('online', () => {
    if (userId) void push()
  })

  // A tab left open all day should still catch up when you come back to it.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && userId) void pull()
  })
}

let channelUserId: string | null = null

function handleSession(id: string | null, email: string | null) {
  if (id === userId) return
  userId = id

  if (!id) {
    setSync({ phase: 'signedOut', email: null, lastSyncedAt: null })
    return
  }

  setSync({ email })
  void pull()
  watchRemote(id)
}

/** Pick up writes made on another device without needing a refresh. */
function watchRemote(id: string) {
  if (!supabase || channelUserId === id) return
  channelUserId = id
  supabase
    .channel('app_state_sync')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: TABLE, filter: `user_id=eq.${id}` },
      (payload) => {
        const row = payload.new as { doc?: AppState; updated_at?: string } | null
        if (!row?.doc) return
        // Ignore the echo of our own write.
        if (row.updated_at && row.updated_at === lastPushedAt) return
        const merged = mergeStates(getState(), row.doc)
        applyRemote(merged)
        setSync({ phase: 'synced', lastSyncedAt: new Date().toISOString() })
      },
    )
    .subscribe()
}

// ---------------------------------------------------------------------------
// Auth — the app never sees or stores the password; Supabase handles it.

export async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Sync is not configured on this build.'
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error?.message ?? null
}

export async function signUp(email: string, password: string): Promise<string | null> {
  if (!supabase) return 'Sync is not configured on this build.'
  const { error } = await supabase.auth.signUp({ email, password })
  return error?.message ?? null
}

export async function signOut(): Promise<void> {
  if (!supabase) return
  await supabase.auth.signOut()
}

export async function syncNow(): Promise<void> {
  await pull()
}
