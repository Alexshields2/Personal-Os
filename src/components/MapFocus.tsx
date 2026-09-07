import { useMemo } from 'react'
import { Card, Empty, Meter, SectionTitle } from './ui'
import { IconChevron, IconWarn } from './icons'
import { LINK_WEIGHT_LABEL } from '../lib/config'
import { useStore } from '../lib/store'
import { domainEdges, domainPath, domainScores, domainSeries } from '../lib/selectors'

/**
 * The map, one branch at a time.
 *
 * The board is the right shape on a desk and the wrong one on a phone: a
 * top-down tree of twenty-odd nodes is about 2,500px wide, which fits a 375px
 * screen at 15% — far below the point where a label is readable. Shrinking it
 * further isn't a smaller map, it's no map.
 *
 * So on a narrow screen you stand on one node instead: where you are, what it
 * scores, what sits under it, and what drives it. Every part of the tree is
 * still reachable — you walk it rather than survey it.
 */
export default function MapFocus({
  focus,
  onFocus,
  onOpen,
}: {
  focus: string
  onFocus: (id: string) => void
  onOpen: (id: string) => void
}) {
  const state = useStore()
  const scores = useMemo(() => domainScores(state), [state])
  const series = useMemo(() => domainSeries(state), [state])

  const node = state.domains.find((d) => d.id === focus) ?? state.domains.find((d) => d.parentId === '')
  if (!node) {
    return (
      <Card>
        <Empty>The map is empty.</Empty>
      </Card>
    )
  }

  const path = domainPath(state.domains, node.id)
  const kids = state.domains.filter((d) => d.parentId === node.id)
  const { causes, effects } = domainEdges(state, node.id)
  const s = scores.get(node.id)
  const line = series.get(node.id)

  return (
    <>
      {/* Where you are. Tapping a crumb walks back up. */}
      <nav className="focus-crumbs" aria-label="Path">
        {path.map((p) => (
          <button key={p.id} onClick={() => onFocus(p.id)}>
            {p.label}
          </button>
        ))}
        <span aria-current="page">{node.label}</span>
      </nav>

      <Card className="card-pad">
        <div className="focus-head">
          <div>
            <div className="t-cap">{path.length === 0 ? 'The root' : path[path.length - 1].label}</div>
            <h2 className="t-large" style={{ fontSize: 30, marginTop: 2 }}>
              {node.label}
            </h2>
          </div>
          <div className="focus-score">
            {s?.score === null || !s ? '—' : Math.round(s.score)}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <Meter pct={s?.score ?? 0} />
        </div>

        {line && line.length >= 3 && (
          <svg className="focus-spark" viewBox="0 0 100 22" preserveAspectRatio="none">
            <path
              d={sparkPath(line)}
              fill="none"
              stroke="var(--text-primary)"
              strokeWidth="1.6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        )}

        <div className="t-foot muted" style={{ marginTop: 10 }}>
          {s?.score === null
            ? 'Nothing is bound to this branch yet, so it has no score of its own.'
            : `Over ${s?.days ?? 0} logged days`}
          {s && s.loopHits > 0 && ` · ${s.loopHits} loop hits underneath`}
        </div>

        {node.note && (
          <p className="t-body muted" style={{ marginTop: 10 }}>
            {node.note}
          </p>
        )}

        <button className="btn btn-block" style={{ marginTop: 14 }} onClick={() => onOpen(node.id)}>
          Open and edit
        </button>
      </Card>

      {kids.length > 0 && (
        <>
          <SectionTitle title={`${kids.length} under it`} />
          <Card>
            <div className="rows">
              {kids.map((k) => {
                const ks = scores.get(k.id)
                const grandkids = state.domains.filter((d) => d.parentId === k.id).length
                return (
                  <button className="row" key={k.id} onClick={() => onFocus(k.id)}>
                    <span className="row-main">
                      <span className="row-title">{k.label}</span>
                      <span className="row-sub">
                        {grandkids > 0 ? `${grandkids} under it` : 'a leaf'}
                        {ks && ks.loopHits > 0 && ` · ${ks.loopHits} loop hits`}
                      </span>
                    </span>
                    <span style={{ width: 54 }}>
                      <Meter pct={ks?.score ?? 0} />
                    </span>
                    <span className="row-value muted">
                      {ks?.score === null || !ks ? '—' : Math.round(ks.score)}
                    </span>
                    <IconChevron style={{ width: 15, height: 15, opacity: 0.5 }} />
                  </button>
                )
              })}
            </div>
          </Card>
        </>
      )}

      {(causes.length > 0 || effects.length > 0) && (
        <>
          <SectionTitle title="Cause and effect" />
          <Card>
            {causes.map((e) => (
              <button className="edge" key={e.link.id} onClick={() => onFocus(e.from.id)}>
                <div className="edge-line">
                  <strong style={{ fontWeight: 550 }}>{e.from.label}</strong>
                  <span className="edge-arrow">drives this</span>
                  <span className="pill chip-sm" style={{ marginLeft: 'auto' }}>
                    {LINK_WEIGHT_LABEL[e.link.weight]}
                  </span>
                </div>
                {e.link.note && <div className="t-foot muted">{e.link.note}</div>}
              </button>
            ))}
            {effects.map((e) => (
              <button className="edge" key={e.link.id} onClick={() => onFocus(e.to.id)}>
                <div className="edge-line">
                  <span className="edge-arrow">this drives</span>
                  <strong style={{ fontWeight: 550 }}>{e.to.label}</strong>
                  <span className="pill chip-sm" style={{ marginLeft: 'auto' }}>
                    {LINK_WEIGHT_LABEL[e.link.weight]}
                  </span>
                </div>
                {e.link.note && <div className="t-foot muted">{e.link.note}</div>}
              </button>
            ))}
          </Card>
        </>
      )}

      {kids.length === 0 && causes.length === 0 && effects.length === 0 && (
        <Card>
          <Empty>
            <IconWarn style={{ width: 14, height: 14, marginRight: 5 }} />
            Nothing sits under this branch and nothing is linked to it. Open it to break it
            down or say what drives it.
          </Empty>
        </Card>
      )}
    </>
  )
}

function sparkPath(values: number[]): string {
  const max = Math.max(100, ...values)
  return values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100
      const y = 22 - (v / max) * 22
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}
