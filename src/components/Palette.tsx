import { useEffect, useMemo, useRef, useState } from 'react'
import { SECTIONS } from '../lib/config'
import { actions, newTask, useStore } from '../lib/store'
import { search, searchKindLabel } from '../lib/selectors'
import type { SearchResult } from '../lib/selectors'

/**
 * One box for the whole app. Twelve sections is more than anyone navigates by
 * tapping, and anything already written down is faster to find by name than by
 * remembering which screen it lives on. Empty, it lists the sections; typing
 * searches everything; with no match it offers to capture what you typed,
 * because the worst outcome is losing the thought while looking for a home.
 */
export default function Palette({
  onNavigate,
  onClose,
}: {
  onNavigate: (tab: string) => void
  onClose: () => void
}) {
  const state = useStore()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (query.trim() === '') {
      return SECTIONS.map(
        (s): SearchResult => ({
          id: `section-${s.id}`,
          kind: 'section',
          label: s.label,
          sub: s.blurb,
          tab: s.id,
          score: 0,
        }),
      )
    }
    return search(state, query)
  }, [state, query])

  const canCapture = query.trim().length > 1
  const rows = results.length
  // The capture row sits after the results and is reachable by arrow key.
  const total = rows + (canCapture ? 1 : 0)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setCursor(0)
  }, [query])

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  }, [cursor])

  const capture = () => {
    actions.addTask(newTask(query.trim()))
    onNavigate('work')
    onClose()
  }

  const choose = (index: number) => {
    if (index >= rows) {
      if (canCapture) capture()
      return
    }
    const hit = results[index]
    if (!hit) return
    onNavigate(hit.tab)
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setCursor((c) => (total ? (c + 1) % total : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (total ? (c - 1 + total) % total : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(cursor)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="scrim palette-scrim" onClick={onClose} role="presentation">
      <div
        className="palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Search and jump"
      >
        <input
          ref={inputRef}
          className="palette-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search everything, or type to capture"
          aria-label="Search"
          autoComplete="off"
        />

        <div className="palette-list" ref={listRef}>
          {results.map((r, i) => (
            <button
              key={r.id}
              className="palette-row"
              data-active={cursor === i}
              onMouseEnter={() => setCursor(i)}
              onClick={() => choose(i)}
            >
              <span className="palette-main">
                <span className="palette-label">{r.label}</span>
                {r.sub && <span className="palette-sub">{r.sub}</span>}
              </span>
              <span className="palette-kind">{searchKindLabel(r.kind)}</span>
            </button>
          ))}

          {results.length === 0 && !canCapture && (
            <div className="palette-empty">Nothing matches that.</div>
          )}

          {canCapture && (
            <button
              className="palette-row"
              data-active={cursor === rows}
              onMouseEnter={() => setCursor(rows)}
              onClick={capture}
            >
              <span className="palette-main">
                <span className="palette-label">Capture “{query.trim()}”</span>
                <span className="palette-sub">Lands in Work as an undated task</span>
              </span>
              <span className="palette-kind">New</span>
            </button>
          )}
        </div>

        <div className="palette-foot">
          <span>↑↓ move</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}
