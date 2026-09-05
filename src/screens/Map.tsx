import { useMemo, useState } from 'react'
import {
  Card,
  Empty,
  Field,
  Meter,
  SectionTitle,
  Segmented,
  Sheet,
  Stat,
  TextField,
} from '../components/ui'
import { IconChevron, IconPlus, IconTrash, IconWarn } from '../components/icons'
import { CHECKLIST, LINK_WEIGHT_LABEL, METRIC_BY_KEY } from '../lib/config'
import { actions, useStore } from '../lib/store'
import { domainEdges, domainOrder, domainPath, domainScores, loopStats } from '../lib/selectors'

type View = 'tree' | 'links'

/**
 * The life map. Alex at the root, domains under him, sub-domains under those —
 * and every node scores off the standards and metrics tied to it, so a branch
 * can be shown to be weak rather than felt to be weak. That is the whole
 * difference between this and a mind-map.
 */
export default function LifeMap() {
  const state = useStore()
  const [view, setView] = useState<View>('tree')
  const [open, setOpen] = useState<Set<string>>(() => new Set(['root', 'health', 'wealth']))
  const [selected, setSelected] = useState<string | null>(null)

  const scores = useMemo(() => domainScores(state), [state])
  const order = useMemo(() => domainOrder(state.domains), [state.domains])

  // A node shows when every ancestor above it is expanded.
  const visible = order.filter(({ node }) =>
    domainPath(state.domains, node.id).every((a) => open.has(a.id)),
  )

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const root = scores.get('root')

  return (
    <div className="screen wrap">
      <header className="page-head">
        <div className="eyebrow">
          <span className="t-cap" style={{ color: 'var(--accent)' }}>
            Causes and effects
          </span>
        </div>
        <h1 className="t-large">Map</h1>
        <p className="t-sub">
          Everything you're running, broken down until it's actionable. Each branch scores off
          the standards and numbers tied to it, over the last 28 days.
        </p>
      </header>

      <div className="grid-3">
        <Stat
          label="Overall"
          value={root?.score === null || root === undefined ? '—' : String(Math.round(root.score))}
          sub={root ? `${root.days} logged days` : undefined}
        />
        <Stat label="Branches" value={String(state.domains.length)} />
        <Stat label="Cause links" value={String(state.links.length)} />
      </div>

      <div style={{ margin: '18px 0 12px' }}>
        <Segmented
          value={view}
          onChange={setView}
          options={[
            { value: 'tree', label: 'Tree' },
            { value: 'links', label: `Cause → effect · ${state.links.length}` },
          ]}
        />
      </div>

      {view === 'tree' ? (
        <>
          <Card>
            <div className="tree">
              {visible.map(({ node, depth }) => {
                const s = scores.get(node.id)
                const kids = state.domains.filter((d) => d.parentId === node.id)
                const isOpen = open.has(node.id)
                return (
                  <button
                    className="node"
                    key={node.id}
                    data-selected={selected === node.id}
                    style={{ paddingLeft: 14 + depth * 17 }}
                    onClick={() => (kids.length ? toggle(node.id) : setSelected(node.id))}
                    onDoubleClick={() => setSelected(node.id)}
                  >
                    <span className="node-twist" data-open={isOpen}>
                      {kids.length > 0 ? (
                        <IconChevron style={{ width: 14, height: 14 }} />
                      ) : (
                        <span
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: 2,
                            background: 'var(--text-muted)',
                          }}
                        />
                      )}
                    </span>
                    <span className="node-label">
                      {node.label}
                      <span className="node-sub">
                        {kids.length > 0
                          ? `${kids.length} under it`
                          : s?.score === null
                            ? 'nothing bound yet'
                            : `${node.checkIds.length + node.metricKeys.length} bound`}
                        {s && s.loopHits > 0 && ` · ${s.loopHits} loop hits`}
                      </span>
                    </span>
                    <span className="node-score">
                      <span className="node-bar">
                        <Meter pct={s?.score ?? 0} />
                      </span>
                      <span className="node-num">
                        {s?.score === null || s === undefined ? '—' : Math.round(s.score)}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </Card>
          <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
            Tap a branch to open or close it; tap a leaf, or double-tap any branch, to see what
            feeds it and what it feeds. An em dash means nothing is bound to it yet.
          </p>
        </>
      ) : (
        <LinkList onOpen={setSelected} />
      )}

      {selected && <NodeSheet id={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}

// ------------------------------------------------------------------ the links

function LinkList({ onOpen }: { onOpen: (id: string) => void }) {
  const state = useStore()
  const [adding, setAdding] = useState(false)
  const byId = new Map(state.domains.map((d) => [d.id, d]))

  return (
    <>
      <SectionTitle
        title="What drives what"
        action={
          <button className="btn btn-quiet btn-sm" onClick={() => setAdding(true)}>
            Add
          </button>
        }
      />
      <Card>
        {state.links.length === 0 ? (
          <Empty>No causes mapped yet.</Empty>
        ) : (
          state.links.map((l) => {
            const from = byId.get(l.fromId)
            const to = byId.get(l.toId)
            if (!from || !to) return null
            return (
              <div className="edge" key={l.id}>
                <div className="edge-line">
                  <button onClick={() => onOpen(from.id)} style={{ fontWeight: 550 }}>
                    {from.label}
                  </button>
                  <span className="edge-arrow">drives</span>
                  <button onClick={() => onOpen(to.id)} style={{ fontWeight: 550 }}>
                    {to.label}
                  </button>
                  <span className="pill chip-sm" style={{ marginLeft: 'auto' }}>
                    {LINK_WEIGHT_LABEL[l.weight]}
                  </span>
                </div>
                {l.note && <div className="t-foot muted">{l.note}</div>}
                <div>
                  <button
                    className="btn btn-quiet btn-danger btn-sm"
                    style={{ padding: '2px 0' }}
                    onClick={() => actions.setLinks(state.links.filter((x) => x.id !== l.id))}
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })
        )}
      </Card>
      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        These are beliefs, not findings — the app doesn't infer them. Writing one down is how
        you check it against what Patterns actually shows.
      </p>
      {adding && <LinkSheet onClose={() => setAdding(false)} />}
    </>
  )
}

function LinkSheet({ onClose }: { onClose: () => void }) {
  const state = useStore()
  const [fromId, setFromId] = useState('')
  const [toId, setToId] = useState('')
  const [note, setNote] = useState('')
  const [weight, setWeight] = useState(2)

  const options = domainOrder(state.domains).filter(({ node }) => node.parentId !== '')

  const save = () => {
    if (!fromId || !toId || fromId === toId) return
    actions.setLinks([
      ...state.links,
      { id: `${fromId}-${toId}-${state.links.length}`, fromId, toId, note: note.trim(), weight },
    ])
    onClose()
  }

  return (
    <Sheet title="Add a cause" onClose={onClose}>
      <div style={{ display: 'grid', gap: 14 }}>
        <Field label="This branch">
          <select className="input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
            <option value="">Choose…</option>
            {options.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {'— '.repeat(Math.max(0, depth - 1))}
                {node.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Drives this one">
          <select className="input" value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">Choose…</option>
            {options.map(({ node, depth }) => (
              <option key={node.id} value={node.id}>
                {'— '.repeat(Math.max(0, depth - 1))}
                {node.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="How sure are you">
          <Segmented
            value={String(weight)}
            onChange={(v: string) => setWeight(Number(v))}
            options={[
              { value: '1', label: 'Suspected' },
              { value: '2', label: 'Likely' },
              { value: '3', label: 'Certain' },
            ]}
          />
        </Field>
        <TextField
          label="Why you think so"
          value={note}
          onChange={setNote}
          placeholder="The mechanism, in one line"
          multiline
        />
        <button
          className="btn btn-primary btn-block"
          onClick={save}
          disabled={!fromId || !toId || fromId === toId}
        >
          Add
        </button>
      </div>
    </Sheet>
  )
}

// ------------------------------------------------------------------- a node

function NodeSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const state = useStore()
  const node = state.domains.find((d) => d.id === id)
  const scores = domainScores(state)
  const [child, setChild] = useState('')

  if (!node) return null

  const s = scores.get(id)
  const path = domainPath(state.domains, id)
  const { causes, effects } = domainEdges(state, id)
  const kids = state.domains.filter((d) => d.parentId === id)
  const loops = loopStats(state).filter((l) => node.loopIds.includes(l.loop.id))

  const toggleCheck = (checkId: string) =>
    actions.updateDomain(id, {
      checkIds: node.checkIds.includes(checkId)
        ? node.checkIds.filter((c) => c !== checkId)
        : [...node.checkIds, checkId],
    })

  return (
    <Sheet title={node.label} onClose={onClose}>
      <div style={{ display: 'grid', gap: 16 }}>
        {path.length > 0 && (
          <div className="t-foot muted">{path.map((p) => p.label).join(' › ')} › {node.label}</div>
        )}

        <Card className="card-pad">
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span className="hero" style={{ fontSize: 34 }}>
              {s?.score === null || s === undefined ? '—' : Math.round(s.score)}
            </span>
            <span className="t-foot muted">
              {s?.score === null
                ? 'nothing bound to this branch yet'
                : `over ${s?.days ?? 0} logged days`}
            </span>
          </div>
          <div style={{ marginTop: 10 }}>
            <Meter pct={s?.score ?? 0} />
          </div>
          {s && s.loopHits > 0 && (
            <p className="t-foot muted" style={{ marginTop: 10 }}>
              <IconWarn style={{ width: 13, height: 13, marginRight: 5 }} />
              {s.loopHits} loop hits under this branch in the last 28 days.
            </p>
          )}
        </Card>

        <TextField
          label="Note"
          value={node.note}
          onChange={(note) => actions.updateDomain(id, { note })}
          placeholder="What this branch actually means"
          multiline
        />

        {(causes.length > 0 || effects.length > 0) && (
          <div>
            <SectionTitle title="Cause and effect" />
            <Card>
              {causes.map((e) => (
                <div className="edge" key={e.link.id}>
                  <div className="edge-line">
                    <strong style={{ fontWeight: 550 }}>{e.from.label}</strong>
                    <span className="edge-arrow">drives this</span>
                    <span className="pill chip-sm" style={{ marginLeft: 'auto' }}>
                      {LINK_WEIGHT_LABEL[e.link.weight]}
                    </span>
                  </div>
                  {e.link.note && <div className="t-foot muted">{e.link.note}</div>}
                </div>
              ))}
              {effects.map((e) => (
                <div className="edge" key={e.link.id}>
                  <div className="edge-line">
                    <span className="edge-arrow">this drives</span>
                    <strong style={{ fontWeight: 550 }}>{e.to.label}</strong>
                    <span className="pill chip-sm" style={{ marginLeft: 'auto' }}>
                      {LINK_WEIGHT_LABEL[e.link.weight]}
                    </span>
                  </div>
                  {e.link.note && <div className="t-foot muted">{e.link.note}</div>}
                </div>
              ))}
            </Card>
          </div>
        )}

        {loops.length > 0 && (
          <div>
            <SectionTitle title="Loops on this branch" />
            <Card>
              {loops.map((l) => (
                <div className="insight" key={l.loop.id}>
                  <div className="insight-head">
                    <span className="insight-title">{l.loop.label}</span>
                    <span className="t-num muted">{l.count} days</span>
                  </div>
                  <Meter pct={l.rate} />
                </div>
              ))}
            </Card>
          </div>
        )}

        <div>
          <SectionTitle title="What feeds this score" />
          <Card className="card-pad">
            <div className="t-cap" style={{ marginBottom: 8 }}>
              Standards
            </div>
            <div className="chips">
              {CHECKLIST.map((c) => (
                <button
                  key={c.id}
                  className="chip chip-sm"
                  aria-pressed={node.checkIds.includes(c.id)}
                  onClick={() => toggleCheck(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <div className="t-cap" style={{ margin: '16px 0 8px' }}>
              Metrics
            </div>
            <div className="chips">
              {Object.values(METRIC_BY_KEY).map((m) => (
                <button
                  key={m.key}
                  className="chip chip-sm"
                  aria-pressed={node.metricKeys.includes(m.key)}
                  onClick={() =>
                    actions.updateDomain(id, {
                      metricKeys: node.metricKeys.includes(m.key)
                        ? node.metricKeys.filter((k) => k !== m.key)
                        : [...node.metricKeys, m.key],
                    })
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="t-cap" style={{ margin: '16px 0 8px' }}>
              Loops
            </div>
            <div className="chips">
              {state.loops
                .filter((l) => !l.archived)
                .map((l) => (
                  <button
                    key={l.id}
                    className="chip chip-sm"
                    aria-pressed={node.loopIds.includes(l.id)}
                    onClick={() =>
                      actions.updateDomain(id, {
                        loopIds: node.loopIds.includes(l.id)
                          ? node.loopIds.filter((x) => x !== l.id)
                          : [...node.loopIds, l.id],
                      })
                    }
                  >
                    {l.label}
                  </button>
                ))}
            </div>
          </Card>
          <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
            A branch with its own bindings scores off them. One without takes the average of
            what sits underneath it.
          </p>
        </div>

        <div>
          <SectionTitle title={kids.length ? `${kids.length} under it` : 'Break it down'} />
          <Card>
            {kids.length > 0 && (
              <div className="rows">
                {kids.map((k) => (
                  <div className="row" key={k.id}>
                    <span className="row-main">
                      <span className="row-title">{k.label}</span>
                    </span>
                    <span className="row-value muted">
                      {(() => {
                        const ks = scores.get(k.id)
                        return ks?.score === null || ks === undefined ? '—' : Math.round(ks.score)
                      })()}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                gap: 8,
                padding: 13,
                borderTop: kids.length ? '1px solid var(--hairline)' : 'none',
              }}
            >
              <input
                className="input"
                placeholder="Add a sub-branch"
                value={child}
                onChange={(e) => setChild(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && child.trim()) {
                    actions.addDomain(id, child.trim())
                    setChild('')
                  }
                }}
              />
              <button
                className="btn"
                disabled={!child.trim()}
                onClick={() => {
                  actions.addDomain(id, child.trim())
                  setChild('')
                }}
                aria-label="Add sub-branch"
              >
                <IconPlus style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </Card>
        </div>

        {node.parentId !== '' && (
          <button
            className="btn btn-danger btn-block"
            onClick={() => {
              if (
                confirm(
                  kids.length
                    ? `Delete "${node.label}" and everything under it?`
                    : `Delete "${node.label}"?`,
                )
              ) {
                actions.removeDomain(id)
                onClose()
              }
            }}
          >
            <IconTrash style={{ width: 16, height: 16 }} />
            Delete this branch
          </button>
        )}
      </div>
    </Sheet>
  )
}
