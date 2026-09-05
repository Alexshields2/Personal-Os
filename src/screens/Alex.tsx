import { useMemo } from 'react'
import { Card, CardHead, Empty, Meter, Ring, SectionTitle, Stat } from '../components/ui'
import { Sparkline, SwingChart } from '../components/charts'
import { IconFlame, IconWarn } from '../components/icons'
import { PILLARS, PROTOCOL_DAYS } from '../lib/config'
import { addDays, formatLong, todayISO } from '../lib/date'
import { euroCompact, num } from '../lib/format'
import { briefing } from '../lib/advisor'
import { dayIntent } from '../lib/nav'
import type { DayView } from '../lib/nav'
import { emptyDay, useStore } from '../lib/store'
import {
  balanceSheet,
  billBook,
  clientBook,
  currentStreak,
  domainScores,
  goalBoard,
  isLogged,
  loggedDays,
  oscillation,
  pipeline,
  planStatus,
  priorityRun,
  runway,
  scoreDay,
  taskQueue,
} from '../lib/selectors'
import type { Finding } from '../lib/advisor'

/**
 * The whole thing on one screen, and the briefing that reads it.
 *
 * Alex is a rules engine, not a language model — it can only notice what it was
 * taught to look for, but it never invents a number, never needs the network,
 * and gives the same answer twice for the same inputs. The trade is deliberate
 * for a document this personal.
 */
export default function Alex({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const state = useStore()
  const today = todayISO()

  const brief = useMemo(() => briefing(state, today), [state, today])
  const osc = useMemo(() => oscillation(state, today), [state, today])
  const pipe = useMemo(() => pipeline(state, undefined, today), [state, today])
  const book = useMemo(() => clientBook(state, undefined, today), [state, today])
  const sheet = useMemo(() => balanceSheet(state), [state])
  const bills = useMemo(() => billBook(state, undefined, today), [state, today])
  const goals = useMemo(() => goalBoard(state, today), [state, today])
  const queue = useMemo(() => taskQueue(state, today), [state, today])
  const scores = useMemo(() => domainScores(state, today), [state, today])
  const run = priorityRun(state)

  const day = state.days[today] ?? emptyDay(today)
  const score = scoreDay(day, state.targets)
  const plan = planStatus(day)
  const streak = currentStreak(state, today)
  const logged = loggedDays(state)

  const recent = useMemo(() => {
    const out: number[] = []
    for (let i = 29; i >= 0; i--) {
      const d = state.days[addDays(today, -i)]
      out.push(isLogged(d) ? scoreDay(d, state.targets).score : 0)
    }
    return out
  }, [state.days, state.targets, today])

  const domains = state.domains.filter((d) => d.parentId === 'root')
  const consultingRunway = runway(state, 'consulting')

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            The overview
          </span>
          {streak > 0 && (
            <span className="pill pill-accent">
              <IconFlame style={{ width: 12, height: 12 }} />
              {streak} day{streak === 1 ? '' : 's'}
            </span>
          )}
        </div>
        <h1 className="t-large">Alex</h1>
        <p className="t-sub">
          {formatLong(today)} · everything at once, and what it adds up to. Read out of your
          own data — nothing here is typed in.
        </p>
      </header>

      <DayForms onNavigate={onNavigate} />

      {/* --------------------------------------------------- the briefing */}

      {brief.thin ? (
        <Card>
          <Empty>
            {brief.days === 0
              ? 'Nothing logged yet. The briefing needs days behind it before it can say anything worth reading.'
              : `${brief.days} day${brief.days === 1 ? '' : 's'} logged. A briefing off fewer than seven is a horoscope — keep going and this fills in.`}
          </Empty>
        </Card>
      ) : (
        brief.headline && (
          <Card className="card-pad brief-headline">
            <div className="t-cap" style={{ marginBottom: 6 }}>
              {brief.headline.severity === 'critical' ? 'Deal with this first' : 'Worth your attention'}
            </div>
            <div className="t-title" style={{ lineHeight: 1.25 }}>
              {brief.headline.title}
            </div>
            <p className="t-body muted" style={{ marginTop: 8 }}>
              {brief.headline.detail}
            </p>
            {brief.headline.action && (
              <p className="t-body" style={{ marginTop: 10 }}>
                {brief.headline.action}
              </p>
            )}
          </Card>
        )
      )}

      {!brief.thin && (
        <>
          <FindingList title="Critical" findings={brief.critical.slice(1)} warn />
          <FindingList
            title="Watch"
            findings={brief.watch.filter((f) => f.id !== brief.headline?.id)}
          />
          {brief.good.length > 0 && <FindingList title="Working" findings={brief.good} />}
          <p className="t-foot muted" style={{ padding: '10px 4px 0', textAlign: 'center' }}>
            Alex reads your data, not the internet. Same inputs, same answer, every time.
          </p>
        </>
      )}

      {/* ------------------------------------------------------- the day */}

      <SectionTitle title="Today" />
      <Card className="card-pad">
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Ring pct={score.score} size={96} stroke={9}>
            <div className="hero" style={{ fontSize: 28 }}>
              {score.score}
            </div>
          </Ring>
          <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 8 }}>
            {score.pillars.map((p) => (
              <div key={p.id}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: 12,
                    marginBottom: 3,
                  }}
                >
                  <span className="dim">{p.label}</span>
                  <span className="t-num muted">
                    {p.earned}/{p.possible}
                  </span>
                </div>
                <Meter pct={(p.earned / p.possible) * 100} />
              </div>
            ))}
          </div>
        </div>
        {recent.some((v) => v > 0) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginTop: 16,
              paddingTop: 14,
              borderTop: '1px solid var(--hairline)',
            }}
          >
            <span className="t-cap">Last 30 days</span>
            <Sparkline values={recent} />
          </div>
        )}
      </Card>

      {/* --------------------------------------------------- oscillation */}

      {osc.enough && (
        <>
          <SectionTitle
            title="Which version is running"
            action={
              <span className="t-foot muted">
                {osc.current?.kind === 'build' ? 'Building' : 'Breaking'} · day{' '}
                {osc.current?.days}
              </span>
            }
          />
          <Card className="card-pad">
            <SwingChart points={osc.points} mean={osc.mean} />
          </Card>
        </>
      )}

      {/* ------------------------------------------------------- numbers */}

      <SectionTitle title="The numbers" />
      <div className="grid-3">
        <Stat
          label="Mean state"
          value={osc.enough ? String(Math.round(osc.mean)) : '—'}
          sub={osc.enough ? (osc.drift >= 0 ? `up ${Math.round(osc.drift)}` : `down ${Math.round(Math.abs(osc.drift))}`) : 'needs 14 days'}
        />
        <Stat
          label="One thing"
          value={run.daysPlanned ? `${Math.round(run.oneThingRate)}%` : '—'}
          sub={`${run.oneThingHit}/${run.daysPlanned} planned days`}
        />
        <Stat label="Days logged" value={String(logged.length)} sub={`of ${PROTOCOL_DAYS}`} />
      </div>

      <div className="grid-3" style={{ marginTop: 12 }}>
        <Stat
          label="Net worth"
          value={euroCompact(sheet.net)}
          sub={sheet.itemised ? 'calculated' : 'manual figure'}
        />
        <Stat label="MRR" value={euroCompact(book.mrr)} sub={`${book.active.length} clients`} />
        <Stat
          label="Runway"
          value={consultingRunway.known ? `${num(consultingRunway.months, 1)}mo` : '—'}
          sub="Consulting.ie"
          accent={
            consultingRunway.known && consultingRunway.months < 3 ? 'var(--warning)' : undefined
          }
        />
      </div>

      <div className="grid-3" style={{ marginTop: 12 }}>
        <Stat label="Pipeline" value={euroCompact(pipe.weighted)} sub="weighted" />
        <Stat
          label="Monthly cost"
          value={euroCompact(bills.monthly)}
          sub={`${euroCompact(bills.annual)} a year`}
        />
        <Stat
          label="Open work"
          value={String(queue.openCount)}
          sub={queue.overdue.length ? `${queue.overdue.length} overdue` : 'none overdue'}
          accent={queue.overdue.length ? 'var(--warning)' : undefined}
        />
      </div>

      {/* --------------------------------------------------- the domains */}

      {domains.length > 0 && (
        <>
          <SectionTitle
            title="Across the map"
            action={<span className="t-foot muted">last 28 days</span>}
          />
          <Card>
            {domains.map((d) => {
              const s = scores.get(d.id)
              return (
                <div className="insight" key={d.id}>
                  <div className="insight-head">
                    <span className="insight-title">{d.label}</span>
                    <span className="t-num muted">
                      {s?.score === null || !s ? '—' : Math.round(s.score)}
                    </span>
                  </div>
                  <Meter pct={s?.score ?? 0} />
                  {s && s.loopHits > 0 && (
                    <div className="insight-body">{s.loopHits} loop hits under it</div>
                  )}
                </div>
              )
            })}
          </Card>
        </>
      )}

      {/* ----------------------------------------------------- the ladder */}

      {goals.total > 0 && (
        <>
          <SectionTitle
            title="Goals"
            action={
              goals.atRisk.length > 0 ? (
                <span className="pill" style={{ color: 'var(--warning)' }}>
                  <IconWarn style={{ width: 12, height: 12 }} />
                  {goals.atRisk.length} at risk
                </span>
              ) : undefined
            }
          />
          <Card>
            {goals.byHorizon
              .filter((b) => b.goals.length > 0)
              .map((band) => (
                <div className="insight" key={band.horizon}>
                  <div className="insight-head">
                    <span className="insight-title">{band.label}</span>
                    <span className="t-num muted">{band.goals.length}</span>
                  </div>
                  {band.goals.map((g) => (
                    <div key={g.goal.id} style={{ marginTop: 6 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 12.5,
                          marginBottom: 3,
                        }}
                      >
                        <span className="dim">{g.goal.title}</span>
                        <span className="t-num muted">{Math.round(g.pct)}%</span>
                      </div>
                      <Meter pct={g.pct} />
                    </div>
                  ))}
                </div>
              ))}
          </Card>
        </>
      )}

      {plan.set > 0 && (
        <>
          <SectionTitle title="Today's three" />
          <Card>
            <CardHead title={`${plan.done} of ${plan.set} kept`} />
            <div style={{ padding: '0 15px 14px' }}>
              <Meter pct={plan.pct} />
            </div>
          </Card>
        </>
      )}

      <p className="t-foot muted" style={{ textAlign: 'center', marginTop: 20 }}>
        {PILLARS.map((p) => p.label).join(' · ')}
      </p>
    </div>
  )
}

/**
 * The two forms that make everything else work. They were a segmented control
 * inside Today, which is fine once you know it is there and invisible until
 * then — the whole system depends on these two being opened twice a day.
 */
function DayForms({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const state = useStore()
  const today = todayISO()
  const day = state.days[today] ?? emptyDay(today)
  const plan = planStatus(day)
  const morning = new Date().getHours() < 12

  const go = (view: DayView) => {
    dayIntent.set(view)
    onNavigate?.('today')
  }

  return (
    <div className="grid-2 dayforms">
      <button
        className={`dayform ${morning && plan.set === 0 ? 'dayform-lead' : ''}`}
        onClick={() => go('plan')}
      >
        <span className="dayform-cap">Morning</span>
        <span className="dayform-title">Plan the day</span>
        <span className="dayform-sub">
          {plan.set === 0 ? 'Nothing committed to yet' : `${plan.set} written down`}
        </span>
      </button>
      <button
        className={`dayform ${!morning && !day.closed ? 'dayform-lead' : ''}`}
        onClick={() => go('review')}
      >
        <span className="dayform-cap">End of day</span>
        <span className="dayform-title">Close it out</span>
        <span className="dayform-sub">
          {day.closed ? 'Closed' : 'Grade the three, tag the loops, set tomorrow'}
        </span>
      </button>
    </div>
  )
}

function FindingList({
  title,
  findings,
  warn,
}: {
  title: string
  findings: Finding[]
  warn?: boolean
}) {
  if (findings.length === 0) return null
  return (
    <>
      <SectionTitle
        title={title}
        action={
          <span className="pill" style={warn ? { color: 'var(--warning)' } : undefined}>
            {warn && <IconWarn style={{ width: 12, height: 12 }} />}
            {findings.length}
          </span>
        }
      />
      <Card>
        {findings.map((f) => (
          <div className="insight" key={f.id}>
            <div className="insight-head">
              <span className="insight-title">{f.title}</span>
            </div>
            <div className="insight-body">{f.detail}</div>
            {f.action && (
              <div className="insight-body" style={{ color: 'var(--text-primary)' }}>
                {f.action}
              </div>
            )}
          </div>
        ))}
      </Card>
    </>
  )
}
