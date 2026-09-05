import { useMemo, useState } from 'react'
import { Card, CardHead, Empty, Field, Meter, SectionTitle, Stat } from '../components/ui'
import { SwingChart } from '../components/charts'
import { IconWarn } from '../components/icons'
import { PRIORITY_TAG_LABEL } from '../lib/config'
import { formatShort } from '../lib/date'
import { num } from '../lib/format'
import { useStore } from '../lib/store'
import {
  breakdownSignals,
  carriedPriorities,
  domainOrder,
  domainSubtree,
  loggedDays,
  loopStats,
  oscillation,
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
      <Oscillation />
      <Headline />
      <Branch />
      <Carried />
      <Breakdowns />
      <Weekdays />
    </div>
  )
}

// ------------------------------------------------------------- oscillation

/**
 * The two versions of you, read out of the score rather than out of a mood.
 * Above the long mean is the version that builds; below it is the one that
 * tears the progress down. The mean between them is the honest number — it is
 * the version that actually shows up on average, and moving *that* is the job.
 */
function Oscillation() {
  const state = useStore()
  const osc = useMemo(() => oscillation(state), [state])

  if (!osc.enough) {
    return (
      <>
        <SectionTitle title="Your two versions" />
        <Card>
          <Empty>
            Needs about two weeks of logged days before the swing between them is a cycle
            rather than a wobble.
          </Empty>
        </Card>
      </>
    )
  }

  const now = osc.current
  const building = now?.kind === 'build'

  return (
    <>
      <SectionTitle
        title="Your two versions"
        action={<span className="t-foot muted">last 90 days</span>}
      />
      <Card className="card-pad">
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <span className="t-head">
            {building ? 'Building' : 'Breaking'} — day {now?.days}
          </span>
          <span className="t-num muted">mean {Math.round(osc.mean)}</span>
        </div>
        <p className="t-foot muted" style={{ marginBottom: 14 }}>
          {building
            ? 'The version of you that does the work is the one currently running.'
            : 'The version that undoes the work is the one currently running. Naming it is most of catching it.'}
        </p>

        <SwingChart points={osc.points} mean={osc.mean} />

        <div className="legend" style={{ paddingBottom: 0 }}>
          <span className="legend-item">
            <span
              className="legend-key"
              style={{ background: 'var(--text-primary)', opacity: 0.17, height: 10 }}
            />
            Building
          </span>
          <span className="legend-item">
            <span
              className="legend-key"
              style={{
                height: 10,
                backgroundImage:
                  'repeating-linear-gradient(45deg, var(--text-primary) 0 1.5px, transparent 1.5px 5px)',
                opacity: 0.5,
              }}
            />
            Breaking
          </span>
          <span className="legend-item" style={{ marginLeft: 'auto' }}>
            dashed line = your mean
          </span>
        </div>
      </Card>

      <div className="grid-3" style={{ marginTop: 12 }}>
        <Stat
          label="Mean state"
          value={String(Math.round(osc.mean))}
          sub="what you average out at"
        />
        <Stat
          label="Longest build"
          value={osc.longestBuild ? `${osc.longestBuild.days}d` : '—'}
          sub={osc.longestBuild ? `peaked at ${Math.round(osc.longestBuild.extreme)}` : undefined}
        />
        <Stat
          label="Deepest break"
          value={osc.deepestBreak ? `${osc.deepestBreak.days}d` : '—'}
          sub={osc.deepestBreak ? `bottomed at ${Math.round(osc.deepestBreak.extreme)}` : undefined}
          accent={osc.deepestBreak ? 'var(--warning)' : undefined}
        />
      </div>

      {Math.abs(osc.drift) >= 3 && (
        <Card className="card-pad" style={{ marginTop: 12 }}>
          <div className="insight-title">
            {osc.drift > 0
              ? `The mean is rising — ${Math.round(osc.drift)} points across the window.`
              : `The mean is falling — ${Math.round(Math.abs(osc.drift))} points across the window.`}
          </div>
          <div className="insight-body" style={{ marginTop: 4 }}>
            {osc.drift > 0
              ? 'The cycle still swings, but it is swinging around a higher centre than it started at. That is the only progress that survives a bad week.'
              : 'The swings are landing lower than they used to. The peaks matter less than where the middle sits.'}
          </div>
        </Card>
      )}
    </>
  )
}

// --------------------------------------------------------------- map filter

/** Loops and standards, narrowed to one branch of the life map. */
function Branch() {
  const state = useStore()
  const [branch, setBranch] = useState('root')

  const options = useMemo(() => domainOrder(state.domains), [state.domains])
  const scope = useMemo(
    () => new Set(domainSubtree(state.domains, branch)),
    [state.domains, branch],
  )
  const nodes = state.domains.filter((d) => scope.has(d.id))
  const loopIds = new Set(nodes.flatMap((n) => n.loopIds))
  const checkIds = new Set(nodes.flatMap((n) => n.checkIds))
  const isRoot = branch === 'root'

  const loops = loopStats(state).filter(
    (s) => s.count > 0 && (isRoot || loopIds.has(s.loop.id)),
  )
  const weak = weakestStandards(state)
    .filter((w) => isRoot || checkIds.has(w.id))
    .slice(0, 6)

  return (
    <>
      <SectionTitle title="Loops and standards" />
      <Card className="card-pad" style={{ marginBottom: 12 }}>
        <Field label="Narrow to a branch of the map">
          <select className="input" value={branch} onChange={(e) => setBranch(e.target.value)}>
            {options.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {'— '.repeat(depth)}
                {node.label}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card>
        <CardHead title={`Loops · last 28 days`} />
        <div style={{ borderTop: '1px solid var(--hairline)' }}>
          {loops.length === 0 ? (
            <Empty>
              {isRoot
                ? "No loops tagged yet. They're set each night in Review — untagged means invisible, not absent."
                : 'No loops tagged on this branch. Bind some to it in the Map.'}
            </Empty>
          ) : (
            loops.map((s) => (
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
        </div>
      </Card>

      {weak.length > 0 && (
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
      )}
    </>
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
