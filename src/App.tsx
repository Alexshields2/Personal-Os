import { useEffect, useState } from 'react'
import type { ComponentType, ReactElement, SVGProps } from 'react'
import Today from './screens/Today'
import Money from './screens/Money'
import Review from './screens/Review'
import Goals from './screens/Goals'
import Work from './screens/Work'
import Calendar from './screens/Calendar'
import Settings from './screens/Settings'
import {
  IconChevron,
  IconCalendar,
  IconLife,
  IconMoney,
  IconReview,
  IconSettings,
  IconToday,
  IconWork,
} from './components/icons'
import ErrorBoundary from './components/ErrorBoundary'
import { lockScroll } from './components/ui'
import { scrollToTop } from './lib/scroll'
import Palette from './components/Palette'
import QuickAdd from './components/QuickAdd'
import { SECTIONS } from './lib/config'
import { useStore } from './lib/store'
import { formatLong, todayISO } from './lib/date'

type TabId =
  | 'today'
  | 'work'
  | 'calendar'
  | 'money'
  | 'goals'
  | 'review'
  | 'settings'

/**
 * Grouped so the sidebar reads as a handful of clusters, not fifteen flat
 * items — "Today" for daily use, "Business" for the two companies' running
 * numbers, "Life" for everything personal, "Review" for looking back, and
 * "System" for the one settings screen. Order here is the order shown.
 */
const TABS: {
  id: TabId
  label: string
  group: string
  primary?: boolean
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}[] = [
  // The four screens that get opened every day, and everything else behind
  // "More". Sixteen items in a row is a menu you have to read; four is a
  // menu you aim at. Nothing is deleted — it is one tap further away.
  { id: 'today', label: 'Today', group: 'Daily', primary: true, Icon: IconToday },
  { id: 'work', label: 'Work', group: 'Daily', primary: true, Icon: IconWork },
  { id: 'money', label: 'Money', group: 'Daily', primary: true, Icon: IconMoney },

  { id: 'calendar', label: 'Calendar', group: 'More', Icon: IconCalendar },
  { id: 'goals', label: 'Goals', group: 'More', Icon: IconLife },
  { id: 'review', label: 'Review', group: 'More', Icon: IconReview },
  { id: 'settings', label: 'Settings', group: 'More', Icon: IconSettings },
]

const PRIMARY = TABS.filter((t) => t.primary)
const SECONDARY = TABS.filter((t) => !t.primary)

// Search and the shell must cover the same screens. Order is deliberately not
// compared any more — the nav is ordered by how often something is opened,
// while SECTIONS stays in its own order for search results.
if (import.meta.env.DEV) {
  const navIds = new Set(TABS.map((t) => t.id))
  const missing = SECTIONS.filter((s) => !navIds.has(s.id as TabId)).map((s) => s.id)
  const extra = TABS.filter((t) => !SECTIONS.some((s) => s.id === t.id)).map((t) => t.id)
  if (missing.length || extra.length) {
    console.warn('Nav and SECTIONS have drifted:', { missing, extra })
  }
}

type ScreenProps = { onNavigate?: (tab: string) => void }

const SCREENS: Record<TabId, (props: ScreenProps) => ReactElement> = {
  today: Today,
  work: Work,
  calendar: Calendar,
  money: Money,
  goals: Goals,
  review: Review,
  settings: Settings,
}

/**
 * Navigation arrives as a plain string from search, quick add and the screens
 * themselves. A screen that has since been removed must not be reachable by
 * an old id — rendering an undefined screen is what used to blank the app.
 */
function isTab(id: string): id is TabId {
  return Object.prototype.hasOwnProperty.call(SCREENS, id)
}

export default function App() {
  // Opens on the day, which is what it is for.
  const [tab, setTab] = useState<TabId>('today')
  const [paletteOpen, setPaletteOpen] = useState(false)
  // Two separate switches: the sidebar's "More" is an inline disclosure, the
  // phone's is a sheet over the screen. Sharing one flag opened the phone
  // sheet — and its full-screen scrim — every time the sidebar expanded.
  const [moreOpen, setMoreOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const state = useStore()
  const Screen = SCREENS[tab] ?? Today
  const go = (next: string) => setTab(isTab(next) ? next : 'today')
  // A secondary screen reached from search still shows where you are.
  const showMore = moreOpen || SECONDARY.some((t) => t.id === tab)

  // Jumping tabs should land at the top, the way a native push does.
  useEffect(() => {
    scrollToTop()
    // Fifteen sections don't fit a phone's tab bar, so keep the current one in
    // view — otherwise the selected tab sits off-screen with no way to tell.
    // Deferred a frame: on the tab that is being selected, aria-selected is
    // written in the same commit, and scrolling before paint measures the old
    // position.
    const raf = requestAnimationFrame(() => {
      const active = document.querySelector<HTMLElement>('.tabbar [aria-selected="true"]')
      const bar = document.querySelector<HTMLElement>('.tabbar')
      if (!active || !bar) return
      bar.scrollTo({
        left: active.offsetLeft - (bar.clientWidth - active.offsetWidth) / 2,
        behavior: 'smooth',
      })
    })
    return () => cancelAnimationFrame(raf)
  }, [tab])

  // Anything covering the page holds it still while it is open.
  useEffect(() => {
    if (!sheetOpen && !paletteOpen) return
    return lockScroll()
  }, [sheetOpen, paletteOpen])

  // Cmd/Ctrl-K anywhere. Ignored while typing so it can't hijack a keystroke
  // meant for a field, except in the palette's own input, which handles it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== 'k' || !(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      setPaletteOpen((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // The stamp drives every token, so it has to land before the first paint of
  // any screen that reads them.
  useEffect(() => {
    document.documentElement.dataset.theme = state.theme
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', state.theme === 'light' ? '#ffffff' : '#000000')
  }, [state.theme])

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Sections">
        <div className="brand">
          <div className="t-cap" style={{ color: 'var(--accent)' }}>
            Personal OS
          </div>
          <div className="t-title" style={{ marginTop: 4 }}>
            {formatLong(todayISO())}
          </div>
        </div>
        <button className="palette-hint" onClick={() => setPaletteOpen(true)}>
          Search everything
          <kbd>⌘K</kbd>
        </button>
        {PRIMARY.map(({ id, label, Icon }) => (
          <button
            key={id}
            className="side-item"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            <Icon />
            {label}
          </button>
        ))}

        <button
          className="side-item side-more"
          aria-expanded={showMore}
          onClick={() => setMoreOpen(!showMore)}
        >
          <IconChevron style={{ transform: showMore ? 'rotate(-90deg)' : 'rotate(90deg)' }} />
          More
        </button>
        {showMore &&
          SECONDARY.map(({ id, label, Icon }) => (
            <button
              key={id}
              className="side-item side-item-sub"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              <Icon />
              {label}
            </button>
          ))}
      </nav>

      <main className="scroll">
        <ErrorBoundary key={tab} onReset={() => setTab('today')}>
          <Screen onNavigate={go} />
        </ErrorBoundary>
      </main>

      <QuickAdd onNavigate={go} />

      {sheetOpen && (
        <div className="scrim more-scrim" onClick={() => setSheetOpen(false)} role="presentation">
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="sheet-grip" />
            <div className="card-pad">
              <div className="t-cap" style={{ marginBottom: 10 }}>Everything else</div>
              <div className="more-grid">
                {SECONDARY.map(({ id, label, Icon }) => (
                  <button
                    key={id}
                    className="more-item"
                    aria-selected={tab === id}
                    onClick={() => {
                      setTab(id)
                      setSheetOpen(false)
                    }}
                  >
                    <Icon />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {paletteOpen && (
        <Palette onNavigate={go} onClose={() => setPaletteOpen(false)} />
      )}

      <nav className="tabbar" aria-label="Sections">
        {PRIMARY.map(({ id, label, Icon }) => (
          <button
            key={id}
            className="tab"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            <Icon />
            {label}
          </button>
        ))}
        <button
          className="tab"
          aria-selected={SECONDARY.some((t) => t.id === tab)}
          onClick={() => setSheetOpen(true)}
        >
          <IconChevron style={{ transform: 'rotate(90deg)' }} />
          More
        </button>
      </nav>
    </div>
  )
}
