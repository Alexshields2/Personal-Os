import { useMemo, useState } from 'react'
import { formatShort, fromISO } from '../lib/date'
import { euroCompact, euro } from '../lib/format'

// ---------------------------------------------------------------------------
// 126-day grid — sequential encoding of the daily score in one hue.

const RAMP = ['var(--seq-1)', 'var(--seq-2)', 'var(--seq-3)', 'var(--seq-4)', 'var(--seq-5)']

/** Score -> ramp step. Below 40 stays at the darkest visible step. */
export function rampFor(score: number): string {
  if (score >= 95) return RAMP[4]
  if (score >= 85) return RAMP[3]
  if (score >= 70) return RAMP[2]
  if (score >= 50) return RAMP[1]
  return RAMP[0]
}

export interface GridCell {
  date: string
  day: number
  score: number
  logged: boolean
  future: boolean
}

export function DayGrid({ cells, todayNum }: { cells: GridCell[]; todayNum: number }) {
  const [hover, setHover] = useState<GridCell | null>(null)

  return (
    <div>
      <div className="daygrid" onMouseLeave={() => setHover(null)}>
        {cells.map((c) => (
          <div
            key={c.date}
            className="daycell"
            data-today={c.day === todayNum}
            style={c.logged ? { background: rampFor(c.score) } : undefined}
            onMouseEnter={() => setHover(c)}
            aria-hidden="true"
          />
        ))}
      </div>

      <div
        className="t-foot"
        style={{ marginTop: 11, minHeight: 20 }}
        aria-live="polite"
      >
        {hover ? (
          <>
            <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
              Day {hover.day}
            </strong>
            <span className="muted"> · {formatShort(hover.date)} · </span>
            {hover.logged ? `${hover.score}/100` : hover.future ? 'Ahead' : 'Not logged'}
          </>
        ) : (
          <span className="muted">Hover a day for its score</span>
        )}
      </div>

      <div className="legend">
        <span className="t-cap">Score</span>
        {[
          { c: RAMP[0], l: '<50' },
          { c: RAMP[1], l: '50' },
          { c: RAMP[2], l: '70' },
          { c: RAMP[3], l: '85' },
          { c: RAMP[4], l: '95+' },
        ].map((s) => (
          <span className="legend-item" key={s.l}>
            <span
              className="legend-key"
              style={{ background: s.c, height: 9, width: 9, borderRadius: 2 }}
            />
            {s.l}
          </span>
        ))}
        <span className="legend-item">
          <span
            className="legend-key"
            style={{
              background: 'var(--seq-track)',
              height: 9,
              width: 9,
              borderRadius: 2,
            }}
          />
          Not logged
        </span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Balance line chart — one y-axis, 2px lines, hairline grid, direct end labels.

export interface Series {
  id: string
  label: string
  color: string
  points: { date: string; amount: number }[]
}

// The SVG scales to fit its container, so a font size in viewBox units shrinks
// with it. At ~340px wide on a phone the scale factor is ~0.53, so 19 units
// lands near 10px on screen — anything smaller is unreadable there.
const W = 640
const H = 250
const TICK_FS = 19
const PAD = { top: 16, right: 104, bottom: 40, left: 8 }

export function BalanceChart({ series }: { series: Series[] }) {
  const [showTable, setShowTable] = useState(false)
  const [hoverX, setHoverX] = useState<number | null>(null)

  const model = useMemo(() => {
    const all = series.flatMap((s) => s.points)
    if (all.length === 0) return null

    const times = all.map((p) => fromISO(p.date).getTime())
    const t0 = Math.min(...times)
    const t1 = Math.max(...times)
    const maxY = Math.max(...all.map((p) => p.amount), 1)
    const top = niceCeil(maxY)

    const plotW = W - PAD.left - PAD.right
    const plotH = H - PAD.top - PAD.bottom
    const x = (iso: string) =>
      PAD.left + (t1 === t0 ? plotW : ((fromISO(iso).getTime() - t0) / (t1 - t0)) * plotW)
    const y = (v: number) => PAD.top + plotH - (v / top) * plotH

    const dates = Array.from(new Set(all.map((p) => p.date))).sort()
    return { x, y, top, t0, t1, dates, plotH }
  }, [series])

  if (!model) {
    return (
      <div className="empty">
        No balances recorded yet. Add a bank reading to start the curve.
      </div>
    )
  }

  const ticks = [0, model.top / 2, model.top]

  // Nearest recorded date to the pointer, for the crosshair readout.
  const active =
    hoverX == null
      ? null
      : model.dates.reduce((best, d) =>
          Math.abs(model.x(d) - hoverX) < Math.abs(model.x(best) - hoverX) ? d : best,
        )

  return (
    <div>
      {/* One series needs no legend — the card title already names it. */}
      <div className="legend" style={{ paddingTop: 0, paddingBottom: 10 }}>
        {series.length > 1 &&
          series.map((s) => (
            <span className="legend-item" key={s.id}>
              <span className="legend-key" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        <button
          className="btn btn-quiet btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => setShowTable((v) => !v)}
        >
          {showTable ? 'Chart' : 'Table'}
        </button>
      </div>

      {showTable ? (
        <BalanceTable series={series} dates={model.dates} />
      ) : (
        <div className="chart-scroll">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            width="100%"
            style={{ minWidth: 320, display: 'block' }}
            role="img"
            aria-label={`Bank balances over time for ${series
              .map((s) => s.label)
              .join(', ')}. Use the table view for exact figures.`}
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect()
              setHoverX(((e.clientX - r.left) / r.width) * W)
            }}
            onMouseLeave={() => setHoverX(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={model.y(t)}
                  y2={model.y(t)}
                  stroke="var(--grid)"
                  strokeWidth="1.8"
                />
                <text
                  x={W - PAD.right + 8}
                  y={model.y(t) + TICK_FS / 3}
                  fill="var(--text-muted)"
                  fontSize={TICK_FS}
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {euroCompact(t)}
                </text>
              </g>
            ))}

            {active && (
              <line
                x1={model.x(active)}
                x2={model.x(active)}
                y1={PAD.top}
                y2={H - PAD.bottom}
                stroke="var(--hairline-strong)"
                strokeWidth="1.8"
              />
            )}

            {series.map((s) => {
              if (s.points.length === 0) return null
              const d = s.points
                .map((p, i) => `${i ? 'L' : 'M'}${model.x(p.date)},${model.y(p.amount)}`)
                .join(' ')
              const last = s.points[s.points.length - 1]
              return (
                <g key={s.id}>
                  <path
                    d={d}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle
                    cx={model.x(last.date)}
                    cy={model.y(last.amount)}
                    r="8"
                    fill={s.color}
                    stroke="var(--surface-1)"
                    strokeWidth="3.6"
                  />
                </g>
              )
            })}

            {/* Crosshair markers sit above the lines so they never get buried. */}
            {active &&
              series.map((s) => {
                const p = s.points.find((q) => q.date === active)
                if (!p) return null
                return (
                  <circle
                    key={s.id}
                    cx={model.x(active)}
                    cy={model.y(p.amount)}
                    r="8"
                    fill={s.color}
                    stroke="var(--surface-1)"
                    strokeWidth="3.6"
                  />
                )
              })}

            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={H - PAD.bottom}
              y2={H - PAD.bottom}
              stroke="var(--axis)"
              strokeWidth="1.8"
            />
            <text x={PAD.left} y={H - 10} fill="var(--text-muted)" fontSize={TICK_FS}>
              {formatShort(model.dates[0])}
            </text>
            <text
              x={W - PAD.right}
              y={H - 10}
              fill="var(--text-muted)"
              fontSize={TICK_FS}
              textAnchor="end"
            >
              {formatShort(model.dates[model.dates.length - 1])}
            </text>
          </svg>

          <div className="t-foot" style={{ minHeight: 22, marginTop: 6 }} aria-live="polite">
            {active ? (
              <>
                <span className="muted">{formatShort(active)} · </span>
                {series.map((s, i) => {
                  const p = s.points.find((q) => q.date === active)
                  return p ? (
                    <span key={s.id}>
                      {i > 0 && <span className="muted"> · </span>}
                      <span
                        className="dot"
                        style={{
                          background: s.color,
                          display: 'inline-block',
                          width: 7,
                          height: 7,
                          marginRight: 5,
                        }}
                      />
                      {s.label} {euro(p.amount)}
                    </span>
                  ) : null
                })}
              </>
            ) : (
              <span className="muted">Hover for balances on a date</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function BalanceTable({ series, dates }: { series: Series[]; dates: string[] }) {
  return (
    <div className="chart-scroll">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr>
            <th style={th}>Date</th>
            {series.map((s) => (
              <th key={s.id} style={{ ...th, textAlign: 'right' }}>
                <span
                  className="dot"
                  style={{
                    background: s.color,
                    display: 'inline-block',
                    width: 7,
                    height: 7,
                    marginRight: 6,
                  }}
                />
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dates.map((d) => (
            <tr key={d}>
              <td style={td}>{formatShort(d)}</td>
              {series.map((s) => {
                const p = s.points.find((q) => q.date === d)
                return (
                  <td key={s.id} style={{ ...td, textAlign: 'right' }}>
                    {p ? euro(p.amount) : '—'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  color: 'var(--text-muted)',
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  borderBottom: '1px solid var(--hairline)',
  whiteSpace: 'nowrap',
}

const td: React.CSSProperties = {
  padding: '9px 10px',
  borderBottom: '1px solid var(--hairline)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

function niceCeil(v: number): number {
  const mag = 10 ** Math.floor(Math.log10(v))
  return Math.ceil(v / mag) * mag
}

// ---------------------------------------------------------------------------
// Sparkline for daily scores.

export function Sparkline({
  values,
  color = 'var(--accent)',
}: {
  values: number[]
  color?: string
}) {
  if (values.length < 2) return null
  const w = 120
  const h = 30
  const max = 100
  const d = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w
      const y = h - (Math.min(max, v) / max) * h
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ overflow: 'visible' }}>
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
