import { useState } from 'react'
import type { ReactNode } from 'react'
import { Field } from './ui'
import { signIn, signUp, useSync } from '../lib/sync'

/**
 * The real login wall. When a backend is configured, nothing behind this
 * renders until Supabase confirms who's signed in — there's no "preview
 * without signing in" bypass, because the whole point is that a stranger
 * with the URL sees this screen and nothing else.
 *
 * With no backend configured, this gets out of the way entirely: there's
 * nothing to gate against, and the app has to stay usable local-only.
 */
export default function AuthGate({ children }: { children: ReactNode }) {
  const sync = useSync()

  if (!sync.configured) return <>{children}</>
  if (!sync.sessionChecked) return <Splash />
  if (!sync.email) return <SignInScreen />
  return <>{children}</>
}

function Splash() {
  return (
    <div className="authgate">
      <div className="authgate-card">
        <p className="t-foot muted">Checking who's signed in…</p>
      </div>
    </div>
  )
}

function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [isError, setIsError] = useState(false)

  const submit = async () => {
    setBusy(true)
    setMessage('')
    const err =
      mode === 'in' ? await signIn(email.trim(), password) : await signUp(email.trim(), password)
    setBusy(false)
    if (err) {
      setIsError(true)
      setMessage(err)
      return
    }
    setPassword('')
    setIsError(false)
    setMessage(
      mode === 'up'
        ? 'Account created. If email confirmation is required, click the link then sign in.'
        : '',
    )
  }

  return (
    <div className="authgate">
      <div className="authgate-card">
        <div className="t-cap" style={{ color: 'var(--accent)', marginBottom: 6 }}>
          Personal OS
        </div>
        <h1 className="t-large" style={{ marginBottom: 6 }}>
          Sign in
        </h1>
        <p className="t-foot muted" style={{ marginBottom: 24 }}>
          This device only shows what's behind your account. There's no way past this screen
          without it.
        </p>

        <div style={{ display: 'grid', gap: 14 }}>
          <Field label="Email">
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              onKeyDown={(e) => e.key === 'Enter' && void submit()}
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

        {message && (
          <p
            className="t-foot"
            style={{ marginTop: 16, color: isError ? 'var(--critical)' : 'var(--accent)' }}
            role="status"
          >
            {message}
          </p>
        )}
      </div>
    </div>
  )
}
