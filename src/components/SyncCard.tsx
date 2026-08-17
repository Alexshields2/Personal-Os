import { useState } from 'react'
import { Card, Field, SectionTitle } from './ui'
import { signIn, signOut, signUp, syncNow, useSync } from '../lib/sync'

const PHASE_LABEL: Record<string, string> = {
  off: 'Local only',
  signedOut: 'Not signed in',
  syncing: 'Syncing…',
  synced: 'Synced',
  offline: 'Offline — will sync when you reconnect',
  error: 'Sync problem',
}

export default function SyncCard() {
  const sync = useSync()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  if (!sync.configured) {
    return (
      <>
        <SectionTitle title="Sync" />
        <Card className="card-pad">
          <p className="t-foot">
            This build has no backend configured, so everything stays on this device. To turn
            sync on, set <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_ANON_KEY</code> and rebuild — see the README.
          </p>
        </Card>
      </>
    )
  }

  const submit = async () => {
    setBusy(true)
    setMessage('')
    const err =
      mode === 'in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password)
    setBusy(false)
    if (err) {
      setMessage(err)
      return
    }
    setPassword('')
    setMessage(
      mode === 'up'
        ? 'Account created. If your project requires email confirmation, click the link then sign in.'
        : '',
    )
  }

  return (
    <>
      <SectionTitle title="Sync" />
      <Card className="card-pad">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 12,
          }}
        >
          <span className="t-cap">Status</span>
          <span
            className="pill"
            style={
              sync.phase === 'synced'
                ? { color: 'var(--good)' }
                : sync.phase === 'error'
                  ? { color: 'var(--critical)' }
                  : undefined
            }
          >
            {PHASE_LABEL[sync.phase] ?? sync.phase}
          </span>
        </div>

        {sync.email ? (
          <>
            <p className="t-foot" style={{ marginBottom: 4 }}>
              Signed in as <strong style={{ color: 'var(--text-primary)' }}>{sync.email}</strong>.
            </p>
            <p className="t-foot muted" style={{ marginBottom: 14 }}>
              {sync.lastSyncedAt
                ? `Last synced ${new Date(sync.lastSyncedAt).toLocaleTimeString()}.`
                : 'Waiting for the first sync.'}{' '}
              Sign in with the same account on your other device and both stay in step.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <button className="btn btn-block" onClick={() => void syncNow()} disabled={busy}>
                Sync now
              </button>
              <button className="btn btn-block" onClick={() => void signOut()}>
                Sign out
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="t-foot" style={{ marginBottom: 14 }}>
              Sign in to keep this device in step with your others. Your data is still saved
              here either way.
            </p>
            <div style={{ display: 'grid', gap: 12 }}>
              <Field label="Email">
                <input
                  className="input"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="Password">
                <input
                  className="input"
                  type="password"
                  autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  onKeyDown={(e) => e.key === 'Enter' && void submit()}
                />
              </Field>
              <button
                className="btn btn-primary btn-block"
                onClick={() => void submit()}
                disabled={busy || !email.trim() || password.length < 6}
              >
                {busy ? 'Working…' : mode === 'in' ? 'Sign in' : 'Create account'}
              </button>
              <button
                className="btn btn-quiet"
                onClick={() => {
                  setMode(mode === 'in' ? 'up' : 'in')
                  setMessage('')
                }}
              >
                {mode === 'in' ? 'Create an account instead' : 'I already have an account'}
              </button>
            </div>
          </>
        )}

        {(message || sync.error) && (
          <p
            className="t-foot"
            style={{ marginTop: 12, color: sync.error ? 'var(--critical)' : 'var(--accent)' }}
            role="status"
          >
            {message || sync.error}
          </p>
        )}
      </Card>
    </>
  )
}
