import { Card, CardHead, Empty, Meter, SectionTitle, Stat } from '../components/ui'
import { IconWarn } from '../components/icons'
import { PRIORITY_TAG_LABEL } from '../lib/config'
import { formatShort, todayISO } from '../lib/date'
import { num } from '../lib/format'
import { useStore } from '../lib/store'
import {
  breakdownSignals,
  carriedPriorities,
  loggedDays,
  loopStats,
  planEffect,
  priorityRun,
  weakestStandards,
  weekdayScores,
} from '../lib/selectors'
import type { PriorityTag } from '../lib/types'

/**
 * The accountability screen. Nothing here is entered by hand — it is all read
 * back out of what was logged, which is the only reason it carries any weight.
 * Every section stays silent until it has enough days to be saying something
 * rather than guessing.
 */
export default function Patterns() {
  const state = useStore()
  const days = loggedDays(state)

  if (days.length < 5) {
    return (
      <div className="screen wrap">
        <Head />
        <Card>
          <Empty>
            {days.length === 0
              ? 'Nothing logged yet. Patterns need days behind them.'
              : `${days.length} day${days.length === 1 ? '' : 's'} logged. Patterns appear at five — anything sooner would be a guess dressed up as a finding.`}
          </Empty>
        </Card>
      </div>
    )
  }

  return (
    <div className="screen wrap">
      <Head />
      <Headline />
      <Loops />
      <Carried />
      <Breakdowns />
      <WeakStandards />
      <Weekdays />
    </div>
  )
}

function Head() {
  return (
    <header className="page-head">
      <div className="eyebrow">
        <span className="t-cap" style={{ color: 'var(--accent)' }}>
          What keeps happening
        </span>
      </div>
      <h1 className="t-large">Patterns</h1>
      <p className="t-sub">
        Your loops, the days that break down, and the standards that slip. Read back from
        what you logged — none of it is typed in here.
      </p>
    </header>
  )
}

// ----------------------------------------------------------------- headline

/** The three numbers that say whether the system is working at all. */
function Headline() {
  const state = useStore()
  const run = priorityRun(state)
  const effect = planEffect(state)

  return (
    <>
      <SectionTitle title="Plan versus reality" />
      <div className="grid-3">
        <Stat
          label="One thing hit"
          value={`${Math.round(run.oneThingRate)}%`}
          sub={`${run.oneThingHit} of ${run.daysPlanned} planned days`}
        />
        <Stat
          label="All priorities"
          value={`${Math.round(run.pct)}%`}
          sub={`${run.done} of ${run.set} kept`}
        />
        <Stat
          label="Days unplanned"
          value={String(effect.unplannedDays)}
          sub={`of ${effect.plannedDays + effect.unplannedDays} logged`}
        />
      </div>
      {effect.meaningful && (
        <Card className="card-pad" style={{ marginTop: 12 }}>
          <div className="insight-title">
            {effect.delta > 0
              ? `Planned days score ${Math.round(effect.delta)} points higher.`
              : `Planning is not showing up in the score yet.`}
          </div>
          <div className="insight-body" style={{ marginTop: 4 }}>
            {Math.round(effect.plannedAvg)} average on the {effect.plannedDays} days you wrote
            the three down, against {Math.round(effect.unplannedAvg)} on the{' '}
            {effect.unplannedDays} you didn't.
          </div>
        </Card>
      )}
    </>
  )
}

// -------------------------------------------------------------------- loops

function Loops() {
  const state = useStore()
  const stats = loopStats(state, todayISO()).filter((s) => s.count > 0)

  return (
    <>
      <SectionTitle title="Your loops" action={<span className="t-foot muted">last 28 days</span>} />
      <Card>
        {stats.length === 0 ? (
          <Empty>
            No loops tagged yet. They're set each night in Review — untagged means invisible,
            not absent.
          </Empty>
        ) : (
          stats.map((s) => (
            <div className="insight" key={s.loop.id}>
              <div className="insight-head">
                <span className="insight-title">{s.loop.label}</span>
                <span className="t-num muted" style={{ whiteSpace: 'nowrap' }}>
                  {s.count} day{s.count === 1 ? '' : 's'}
                </span>
              </div>
              <Meter pct={s.rate} />
              <div className="insight-body">
                {Math.round(s.rate)}% of logged days
                {s.streak >= 2 && ` · running ${s.streak} days straight`}
                {s.trend === 'rising' && ' · getting worse'}
                {s.trend === 'falling' && ' · easing off'}
                {s.lastFired && ` · last ${formatShort(s.lastFired)}`}
              </div>
            </div>
          ))
        )}
      </Card>
    </>
  )
}

// ------------------------------------------------------------------ carried

/** Intentions rewritten day after day and never closed. */
function Carried() {
  const state = useStore()
  const carried = carriedPriorities(state)
  if (carried.length === 0) return null

  return (
    <>
      <SectionTitle
        title="Carried, not done"
        action={
          <span className="pill" style={{ color: 'var(--warning)' }}>
            <IconWarn style={{ width: 12, height: 12 }} />
            {carried.length}
          </span>
        }
      />
      <Card>
        {carried.slice(0, 8).map((c) => (
          <div className="insight" key={c.text}>
            <div className="insight-head">
              <span className="insight-title">{c.text}</span>
              <span
                className="t-num"
                style={{ whiteSpace: 'nowrap', color: c.ongoing ? 'var(--warning)' : undefined }}
              >
                {c.maxRun} in a row
              </span>
            </div>
            <div className="insight-body">
              {PRIORITY_TAG_LABEL[c.tag as PriorityTag] ?? c.tag} · {c.times} miss
              {c.times === 1 ? '' : 'es'} between {formatShort(c.firstDate)} and{' '}
              {formatShort(c.lastDate)}
              {c.ongoing ? ' · still open' : c.everDone ? ' · eventually done' : ''}
            </div>
          </div>
        ))}
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Ranked by the longest unbroken run of writing it down and not doing it. A standing
        item you sometimes miss is not the same as a wall — this list is the walls.
      </p>
    </>
  )
}

// -------------------------------------------------------------- breakdowns

/** What is measurably different about the days that fall apart. */
function Breakdowns() {
  const state = useStore()
  const signals = breakdownSignals(state).slice(0, 5)

  return (
    <>
      <SectionTitle title="What breaks a day" />
      <Card>
        {signals.length === 0 ? (
          <Empty>
            Needs at least three winning days and three under 50 before the comparison means
            anything.
          </Empty>
        ) : (
          signals.map((s) => (
            <div className="insight" key={s.key}>
              <div className="insight-head">
                <span className="insight-title">{s.label}</span>
                <span className="t-num muted" style={{ whiteSpace: 'nowrap' }}>
                  {s.gap > 0 ? '+' : ''}
                  {num(s.gap, s.dp)}
                  {s.unit && ` ${s.unit}`}
                </span>
              </div>
              <div className="insight-body">
                {num(s.winning, s.dp)}
                {s.unit && ` ${s.unit}`} on winning days against {num(s.losing, s.dp)}
                {s.unit && ` ${s.unit}`} on days under 50.
              </div>
            </div>
          ))
        )}
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Correlation, not cause — but it is where to look first.
      </p>
    </>
  )
}

// --------------------------------------------------------- weak standards

function WeakStandards() {
  const state = useStore()
  const weak = weakestStandards(state).slice(0, 6)
  if (weak.length === 0) return null

  return (
    <>
      <SectionTitle title="Standards you drop" />
      <Card>
        {weak.map((w) => (
          <div className="insight" key={w.id}>
            <div className="insight-head">
              <span className="insight-title">{w.label}</span>
              <span className="t-num muted" style={{ whiteSpace: 'nowrap' }}>
                {Math.round(w.rate)}%
              </span>
            </div>
            <Meter pct={w.rate} />
            <div className="insight-body">
              {w.pillar} · missed {w.missed} of {w.logged} days · {w.points} point
              {w.points === 1 ? '' : 's'} a day
            </div>
          </div>
        ))}
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Ranked by what they actually cost you, not by how often they slip.
      </p>
    </>
  )
}

// ----------------------------------------------------------------- weekdays

function Weekdays() {
  const state = useStore()
  const rows = weekdayScores(state).filter((w) => w.days > 0)
  if (rows.length < 4) return null

  const worst = [...rows].sort((a, b) => a.avg - b.avg)[0]

  return (
    <>
      <SectionTitle title="By day of the week" />
      <Card>
        <CardHead title={`${worst.label} is your weakest day`} />
        <div style={{ borderTop: '1px solid var(--hairline)' }}>
          {rows.map((w) => (
            <div className="insight" key={w.dow}>
              <div className="insight-head">
                <span className="insight-title">{w.label}</span>
                <span className="t-num muted">{Math.round(w.avg)}</span>
              </div>
              <Meter pct={w.avg} />
              <div className="insight-body">
                {w.days} day{w.days === 1 ? '' : 's'} logged
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}
