import { Card, Meter, Ring, SectionTitle, Stat } from '../components/ui'
import { DayGrid } from '../components/charts'
import { IconCheck, IconWarn } from '../components/icons'
import { MILESTONES, PROTOCOL_DAYS } from '../lib/config'
import { formatWithYear, todayISO } from '../lib/date'
import { compact, num } from '../lib/format'
import { useStore } from '../lib/store'
import {
  averageScore,
  compounding,
  dayCells,
  loggedDays,
  timeline,
} from '../lib/selectors'

/**
 * Grouped digits stay readable up to six figures — only the step counts are
 * big enough that "1M" beats "1,000,000". `scale` is the row's target, so the
 * value and its target always render in the same notation.
 */
function fmt(v: number, scale: number): string {
  if (scale >= 100_000) return compact(v)
  if (scale < 100) return num(v, 2)
  return num(Math.round(v))
}

export default function Progress() {
  const state = useStore()
  const t = timeline(state)
  const cells = dayCells(state)
  const totals = compounding(state)
  const logged = loggedDays(state)
  const avg = averageScore(state)

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            The compounding
          </span>
        </div>
        <h1 className="t-large">Progress</h1>
        <p className="t-sub">Let the totals do the talking.</p>
      </header>

      <Card className="card-pad">
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Ring pct={t.elapsedPct} size={124} stroke={11}>
            <div className="hero" style={{ fontSize: 38 }}>
              {t.day}
            </div>
            <div className="t-cap" style={{ marginTop: 2 }}>
              of {PROTOCOL_DAYS}
            </div>
          </Ring>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="t-head">{t.remaining} days remaining</div>
            <div className="t-foot" style={{ marginTop: 3 }}>
              Finishes {formatWithYear(t.endDate)}
            </div>
            <div
              style={{
                display: 'grid',
                gap: 10,
                marginTop: 14,
                gridTemplateColumns: '1fr 1fr',
              }}
            >
              <div>
                <div className="t-cap">Logged</div>
                <div className="t-head t-num">
                  {logged.length}
                  <span className="muted" style={{ fontWeight: 400 }}>
                    /{t.day}
                  </span>
                </div>
              </div>
              <div>
                <div className="t-cap">Avg score</div>
                <div className="t-head t-num">{avg.toFixed(0)}</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <SectionTitle title="126 days" />
      <Card className="card-pad">
        <DayGrid cells={cells} todayNum={t.day} />
      </Card>

      <SectionTitle title="Compounding totals" />
      <div className="stack">
        {totals.map((c) => {
          const ahead = c.invert ? c.value <= c.pace : c.value >= c.pace
          return (
            <Card key={c.id} className="card-pad">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="t-head">{c.label}</div>
                  {c.note && <div className="row-sub">{c.note}</div>}
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <div className="t-head t-num">
                    {fmt(c.value, c.target)}
                    <span className="muted" style={{ fontWeight: 400 }}>
                      {' '}
                      / {fmt(c.target, c.target)}
                      {c.unit && ` ${c.unit}`}
                    </span>
                  </div>
                </div>
              </div>
              <Meter
                pct={c.pct}
                color={
                  c.invert
                    ? c.value > c.target
                      ? 'var(--critical)'
                      : 'var(--series-personal)'
                    : undefined
                }
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: 8,
                  fontSize: 12,
                  color: ahead ? 'var(--good)' : 'var(--warning)',
                }}
              >
                {ahead ? (
                  <IconCheck style={{ width: 12, height: 12 }} />
                ) : (
                  <IconWarn style={{ width: 13, height: 13 }} />
                )}
                <span>
                  {ahead ? 'On or ahead of pace' : 'Behind pace'}
                  <span className="muted"> · pace {fmt(c.pace, c.target)}</span>
                </span>
              </div>
            </Card>
          )
        })}
      </div>

      <SectionTitle title="The comeback" />
      <Card>
        <div className="rows">
          {MILESTONES.map((m) => {
            const reached = t.day >= m.day
            return (
              <div className="row" key={m.day}>
                <span
                  className="dot"
                  style={{
                    background: reached ? 'var(--accent)' : 'var(--seq-track)',
                    width: 10,
                    height: 10,
                  }}
                />
                <span className="row-main">
                  <span className="row-title" style={{ opacity: reached ? 1 : 0.5 }}>
                    Day {m.day} — {m.label}
                  </span>
                </span>
                {reached && <span className="pill pill-accent">Passed</span>}
              </div>
            )
          })}
        </div>
      </Card>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <Stat
          label="Reclaimed vs 3h/day scrolling"
          value={`${Math.round(
            (3 * 60 * Math.min(t.day, PROTOCOL_DAYS) -
              logged.reduce((s, d) => s + d.metrics.socialMin, 0)) /
              60,
          )}h`}
          sub="Nearly eight working weeks over 126 days"
        />
        <Stat
          label="Days without broadcasting"
          value={`${logged.filter((d) => d.checks['no_posting']).length}`}
          sub={`of ${PROTOCOL_DAYS}`}
        />
      </div>

      <p className="t-foot muted" style={{ textAlign: 'center', marginTop: 22 }}>
        {t.day < PROTOCOL_DAYS
          ? `${PROTOCOL_DAYS - t.day} days until it's undeniable.`
          : 'Where the fuck has he been.'}
      </p>
      <p className="t-foot muted" style={{ textAlign: 'center', marginTop: 4 }}>
        Today is {formatWithYear(todayISO())}
      </p>
    </div>
  )
}
