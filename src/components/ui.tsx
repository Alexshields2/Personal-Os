import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'
import { IconCheck } from './icons'

// ---------------------------------------------------------------- containers

export function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode
  className?: string
  style?: CSSProperties
}) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  )
}

export function CardHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="card-head">
      <span className="t-cap">{title}</span>
      {action}
    </div>
  )
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="section-title">
      <h2 className="t-head">{title}</h2>
      {action}
    </div>
  )
}

// -------------------------------------------------------------------- inputs

export function Check({ on, locked }: { on: boolean; locked?: boolean }) {
  return (
    <span className="check" data-on={on} data-locked={locked}>
      <IconCheck />
    </span>
  )
}

export function CheckRow({
  label,
  sub,
  on,
  onToggle,
  value,
}: {
  label: string
  sub?: string
  on: boolean
  onToggle: () => void
  value?: ReactNode
}) {
  return (
    <button className="row" onClick={onToggle} role="checkbox" aria-checked={on}>
      <Check on={on} />
      <span className="row-main">
        <span className="row-title" style={{ opacity: on ? 0.6 : 1 }}>
          {label}
        </span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      {value && <span className="row-value">{value}</span>}
    </button>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/**
 * Number row with -/+ buttons. Keeps a local string while focused so typing
 * "3.5" isn't fought by a re-render that rounds the intermediate "3.".
 */
export function Stepper({
  value,
  step,
  dp,
  onChange,
  suffix,
}: {
  value: number
  step: number
  dp: number
  onChange: (v: number) => void
  suffix?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? (value ? round(value, dp).toString() : '')

  const bump = (dir: number) => {
    setDraft(null)
    onChange(Math.max(0, round(value + dir * step, dp)))
  }

  return (
    <span className="stepper">
      <button onClick={() => bump(-1)} aria-label="Decrease" type="button">
        −
      </button>
      <input
        inputMode="decimal"
        value={shown}
        placeholder="0"
        aria-label="Value"
        onChange={(e) => {
          setDraft(e.target.value)
          const n = Number.parseFloat(e.target.value.replace(',', '.'))
          onChange(Number.isFinite(n) ? Math.max(0, n) : 0)
        }}
        onBlur={() => setDraft(null)}
      />
      {suffix && <span className="t-foot muted">{suffix}</span>}
      <button onClick={() => bump(1)} aria-label="Increase" type="button">
        +
      </button>
    </span>
  )
}

function round(v: number, dp: number) {
  const f = 10 ** dp
  return Math.round(v * f) / f
}

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="field">
      <span className="field-label t-cap">{label}</span>
      {children}
    </label>
  )
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  multiline?: boolean
}) {
  return (
    <Field label={label}>
      {multiline ? (
        <textarea
          className="input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
        <input
          className="input"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  placeholder?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Field label={label}>
      <input
        className="input t-num"
        inputMode="decimal"
        placeholder={placeholder}
        value={draft ?? (value ? String(value) : '')}
        onChange={(e) => {
          setDraft(e.target.value)
          const n = Number.parseFloat(e.target.value.replace(/[^\d.-]/g, ''))
          onChange(Number.isFinite(n) ? n : 0)
        }}
        onBlur={() => setDraft(null)}
      />
    </Field>
  )
}

// --------------------------------------------------------------------- sheet

/**
 * Hold the page still while something is open over it.
 *
 * `body { overflow: hidden }` does nothing here: the page scrolls inside a
 * div, not the document, so the background slid around under every sheet and
 * you came back somewhere else. This freezes the real scroller and puts it
 * back exactly where it was. Counted, so two things open at once don't
 * unfreeze it early.
 */
let locks = 0
let lockedAt = 0

export function lockScroll(): () => void {
  const scroller = document.querySelector<HTMLElement>('.scroll')
  if (!scroller) return () => {}
  if (locks === 0) {
    lockedAt = scroller.scrollTop
    scroller.style.overflowY = 'hidden'
  }
  locks += 1
  let released = false
  return () => {
    if (released) return
    released = true
    locks = Math.max(0, locks - 1)
    if (locks === 0) {
      scroller.style.overflowY = ''
      scroller.scrollTop = lockedAt
    }
  }
}

export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const unlock = lockScroll()
    return () => {
      document.removeEventListener('keydown', onKey)
      unlock()
    }
  }, [onClose])

  // Rendered at the end of the document, not where it was written. A sheet
  // is opened from inside a screen, and any transformed ancestor — a screen
  // mid-animation, a card with a backdrop filter — becomes the containing
  // block for `position: fixed`, which put the whole thing below the fold
  // where it could not be seen at all.
  return createPortal(
    <div
      className="scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="sheet" ref={ref} role="dialog" aria-modal="true" aria-label={title}>
        <div className="sheet-grip" />
        <div className="card-head" style={{ padding: '0 0 14px' }}>
          <h2 className="t-title" style={{ fontSize: 21 }}>
            {title}
          </h2>
          <button className="btn btn-quiet" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="stack">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

// ------------------------------------------------------------------ readouts

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div className="stat">
      <div className="t-cap">{label}</div>
      <div className="stat-value" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

export function Meter({ pct, color }: { pct: number; color?: string }) {
  return (
    <div
      className="meter"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="meter-fill"
        style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }}
      />
    </div>
  )
}

/** Progress ring. `sub` sits under the big figure inside the ring. */
export function Ring({
  pct,
  size = 132,
  stroke = 10,
  color = 'var(--accent)',
  children,
}: {
  pct: number
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(100, pct))
  return (
    <div style={{ position: 'relative', width: size, height: size, flex: 'none' }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--seq-track)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(clamped / 100) * c} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dasharray 0.9s var(--ease)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeContent: 'center',
          textAlign: 'center',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}

/**
 * An editable label that wraps instead of hiding its end. A single-line input
 * cuts "Alarm off — phone stayed in the kitchen" in half on a phone, and the
 * half you lose is the half that says what to do. Enter is swallowed: these
 * are labels, not paragraphs.
 */
export function GrowText({
  value,
  onChange,
  className = '',
  style,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  className?: string
  style?: CSSProperties
  ariaLabel?: string
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  // Measured after layout, before paint, so the field never flashes at the
  // wrong height on first render or after an edit.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    // scrollHeight covers content and padding; the border is on top of that,
    // and the box is border-box — without it the last line loses its tails.
    const border = el.offsetHeight - el.clientHeight
    el.style.height = `${el.scrollHeight + border}px`
  }, [value])

  return (
    <textarea
      ref={ref}
      rows={1}
      className={`input input-plain grow-text ${className}`}
      style={style}
      value={value}
      aria-label={ariaLabel}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault()
      }}
    />
  )
}
