import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { IconPlus } from './icons'
import { actions, useStore } from '../lib/store'
import { NODE_H, NODE_W, boardBounds, domainScores, layoutDomains } from '../lib/selectors'
import type { Placed } from '../lib/selectors'

const MIN_ZOOM = 0.3
const MAX_ZOOM = 2.2

/**
 * The life map as a board rather than an outline. Parent-to-child edges are
 * solid and quiet; the cause links you asserted are dashed and arrowed, because
 * they are a different kind of claim and should never be mistaken for structure.
 *
 * Dragging a node stamps its position, which opts it out of the tidy layout for
 * good — so a map you have arranged by hand stays arranged, while anything you
 * add later still places itself sensibly.
 */
export default function Board({
  selected,
  onSelect,
}: {
  selected: string | null
  onSelect: (id: string) => void
}) {
  const state = useStore()
  const wrapRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [zoom, setZoom] = useState(0.85)

  // One ref for the whole gesture: which node (or the canvas) is moving, and
  // where the pointer grabbed it, in board coordinates.
  const drag = useRef<{ id: string | null; dx: number; dy: number; moved: boolean } | null>(null)

  const scores = useMemo(() => domainScores(state), [state])
  const placed = useMemo(() => layoutDomains(state.domains), [state.domains])

  const fit = useCallback(() => {
    const el = wrapRef.current
    if (!el) return
    const b = boardBounds(placed)
    const w = b.maxX - b.minX
    const h = b.maxY - b.minY
    if (w <= 0 || h <= 0) return
    const next = Math.max(
      MIN_ZOOM,
      Math.min(1.1, Math.min((el.clientWidth - 48) / w, (el.clientHeight - 48) / h)),
    )
    setZoom(next)
    setPan({
      x: (el.clientWidth - w * next) / 2 - b.minX * next,
      y: (el.clientHeight - h * next) / 2 - b.minY * next,
    })
  }, [placed])

  // Fit once on mount, when the board first has a size to fit into.
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current) return
    fitted.current = true
    fit()
  }, [fit])

  const toBoard = (clientX: number, clientY: number) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    return {
      x: ((clientX - (rect?.left ?? 0)) - pan.x) / zoom,
      y: ((clientY - (rect?.top ?? 0)) - pan.y) / zoom,
    }
  }

  const onPointerDown = (e: React.PointerEvent, id: string | null) => {
    // Right-click and secondary buttons pan rather than drag a node.
    const p = toBoard(e.clientX, e.clientY)
    const at = id ? placed.get(id) : null
    drag.current = {
      id,
      dx: at ? p.x - at.x : e.clientX - pan.x,
      dy: at ? p.y - at.y : e.clientY - pan.y,
      moved: false,
    }
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      /* No active pointer with that id — the drag still tracks via the handlers. */
    }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    d.moved = true
    if (d.id) {
      const p = toBoard(e.clientX, e.clientY)
      actions.moveDomain(d.id, Math.round(p.x - d.dx), Math.round(p.y - d.dy))
    } else {
      setPan({ x: e.clientX - d.dx, y: e.clientY - d.dy })
    }
  }

  const onPointerUp = (e: React.PointerEvent, id: string | null) => {
    const d = drag.current
    drag.current = null
    // A press that never moved is a click, which selects.
    if (id && d && !d.moved) onSelect(id)
    try {
      ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
    } catch {
      /* the capture is already gone — nothing to release */
    }
  }

  const onWheel = (e: React.WheelEvent) => {
    if (!wrapRef.current) return
    const rect = wrapRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (e.deltaY > 0 ? 0.92 : 1.08)))
    // Keep the point under the cursor fixed while the scale changes.
    setPan({
      x: mx - ((mx - pan.x) / zoom) * next,
      y: my - ((my - pan.y) / zoom) * next,
    })
    setZoom(next)
  }

  const step = (factor: number) => {
    const el = wrapRef.current
    if (!el) return
    const cx = el.clientWidth / 2
    const cy = el.clientHeight / 2
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * factor))
    setPan({ x: cx - ((cx - pan.x) / zoom) * next, y: cy - ((cy - pan.y) / zoom) * next })
    setZoom(next)
  }

  const edges = state.domains
    .filter((d) => d.parentId && placed.has(d.parentId))
    .map((d) => ({ from: placed.get(d.parentId)!, to: placed.get(d.id)!, id: d.id }))

  const causes = state.links
    .filter((l) => placed.has(l.fromId) && placed.has(l.toId))
    .map((l) => ({ link: l, from: placed.get(l.fromId)!, to: placed.get(l.toId)! }))

  return (
    <div className="board-shell">
      <div className="board-bar">
        <button className="btn btn-sm" onClick={() => step(1 / 1.2)} aria-label="Zoom out">
          −
        </button>
        <span className="board-zoom">{Math.round(zoom * 100)}%</span>
        <button className="btn btn-sm" onClick={() => step(1.2)} aria-label="Zoom in">
          +
        </button>
        <button className="btn btn-sm" onClick={fit}>
          Fit
        </button>
        <button
          className="btn btn-sm"
          onClick={() => {
            if (confirm('Put every branch back where the automatic layout wants it?')) {
              actions.resetDomainLayout()
              setTimeout(fit, 0)
            }
          }}
        >
          Tidy
        </button>
        <button
          className="btn btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={() => {
            const label = prompt('Name the branch')?.trim()
            if (label) actions.addDomain(selected ?? 'root', label)
          }}
        >
          <IconPlus style={{ width: 14, height: 14 }} />
          Branch
        </button>
      </div>

      <div
        className="board"
        ref={wrapRef}
        onPointerDown={(e) => onPointerDown(e, null)}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => onPointerUp(e, null)}
        onPointerCancel={() => (drag.current = null)}
        onWheel={onWheel}
        role="application"
        aria-label="Life map board"
      >
        <div
          className="board-canvas"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {/* The radial layout puts the root at 0,0, so half the board is in
              negative space — the layer is offset to cover it. */}
          <svg
            className="board-edges"
            width="6000"
            height="6000"
            viewBox="-3000 -3000 6000 6000"
            style={{ left: -3000, top: -3000 }}
            aria-hidden="true"
          >
            <defs>
              <marker
                id="board-arrow"
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0 0 L10 5 L0 10 z" fill="var(--text-primary)" />
              </marker>
            </defs>

            {edges.map((e) => (
              <path
                key={`edge-${e.id}`}
                d={curve(e.from, e.to)}
                fill="none"
                stroke="var(--hairline-strong)"
                strokeWidth="1.5"
              />
            ))}

            {causes.map((c) => (
              <path
                key={`cause-${c.link.id}`}
                d={curve(c.from, c.to)}
                fill="none"
                stroke="var(--text-primary)"
                strokeWidth="1.5"
                strokeDasharray="6 5"
                opacity="0.55"
                markerEnd="url(#board-arrow)"
              />
            ))}
          </svg>

          {state.domains.map((node) => {
            const at = placed.get(node.id)
            if (!at) return null
            const s = scores.get(node.id)
            const kids = state.domains.filter((d) => d.parentId === node.id).length
            return (
              <div
                key={node.id}
                className="board-node"
                data-selected={selected === node.id}
                data-root={node.parentId === ''}
                style={{ left: at.x, top: at.y, width: NODE_W, height: NODE_H }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  onPointerDown(e, node.id)
                }}
                onPointerMove={onPointerMove}
                onPointerUp={(e) => {
                  e.stopPropagation()
                  onPointerUp(e, node.id)
                }}
              >
                <div className="board-node-label">{node.label}</div>
                <div className="board-node-meta">
                  <span>{s?.score === null || !s ? '—' : Math.round(s.score)}</span>
                  {kids > 0 && <span>{kids} under</span>}
                  {s && s.loopHits > 0 && <span>{s.loopHits} loops</span>}
                </div>
                <div className="board-node-bar">
                  <i style={{ width: `${s?.score ?? 0}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="t-foot muted" style={{ padding: '10px 4px 0' }}>
        Drag a branch to place it, drag the background to pan, scroll to zoom. Solid lines are
        structure; dashed arrows are the causes you asserted. Tap a branch to open it.
      </p>
    </div>
  )
}

/**
 * Centre to centre. The node cards are opaque and painted over the top, so the
 * line reads as meeting each box's edge without any of the geometry that
 * clipping to a rotated rectangle would need.
 */
function curve(from: Placed, to: Placed): string {
  const x1 = from.x + NODE_W / 2
  const y1 = from.y + NODE_H / 2
  const x2 = to.x + NODE_W / 2
  const y2 = to.y + NODE_H / 2
  // A slight bow keeps two links between the same pair from overlapping.
  const cx = (x1 + x2) / 2 + (y2 - y1) * 0.08
  const cy = (y1 + y2) / 2 - (x2 - x1) * 0.08
  return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`
}
