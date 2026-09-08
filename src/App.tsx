import { useEffect, useState } from 'react'
import type { ComponentType, ReactElement, SVGProps } from 'react'
import Alex from './screens/Alex'
import VisionBoard from './screens/VisionBoard'
import Home from './screens/Home'
import Today from './screens/Today'
import Money from './screens/Money'
import Marketing from './screens/Marketing'
import Progress from './screens/Progress'
import Review from './screens/Review'
import Learn from './screens/Learn'
import Network from './screens/Network'
import Patterns from './screens/Patterns'
import LifeMap from './screens/Map'
import Goals from './screens/Goals'
import Work from './screens/Work'
import Calendar from './screens/Calendar'
import Settings from './screens/Settings'
import {
  IconAlex,
  IconCalendar,
  IconHome,
  IconLearn,
  IconLife,
  IconMap,
  IconMoney,
  IconNetwork,
  IconPatterns,
  IconProgress,
  IconReview,
  IconSettings,
  IconToday,
  IconVision,
  IconWork,
} from './components/icons'
import Palette from './components/Palette'
import QuickAdd from './components/QuickAdd'
import { SECTIONS } from './lib/config'
import { useStore } from './lib/store'
import { formatLong, todayISO } from './lib/date'

type TabId =
  | 'alex'
  | 'vision'
  | 'home'
  | 'today'
  | 'work'
  | 'calendar'
  | 'patterns'
  | 'map'
  | 'money'
  | 'marketing'
  | 'learn'
  | 'network'
  | 'goals'
  | 'progress'
  | 'review'
  | 'settings'

/**
 * Grouped so the sidebar reads as a handful of clusters, not fifteen flat
 * items — "Today" for daily use, "Business" for the two companies' running
 * numbers, "Life" for everything personal, "Review" for looking back, and
 * "System" for the one settings screen. Order here is the order shown.
 */
const TABS: { id: TabId; label: string; group: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: 'alex', label: 'Alex', group: 'Today', Icon: IconAlex },
  { id: 'today', label: 'Today', group: 'Today', Icon: IconToday },
  { id: 'home', label: 'Home', group: 'Today', Icon: IconHome },
  { id: 'work', label: 'Work', group: 'Business', Icon: IconWork },
  { id: 'money', label: 'Money', group: 'Business', Icon: IconMoney },
  { id: 'marketing', label: 'Marketing', group: 'Business', Icon: IconProgress },
  { id: 'calendar', label: 'Calendar', group: 'Business', Icon: IconCalendar },
  { id: 'map', label: 'Map', group: 'Life', Icon: IconMap },
  { id: 'goals', label: 'Goals', group: 'Life', Icon: IconLife },
  { id: 'learn', label: 'Learn', group: 'Life', Icon: IconLearn },
  { id: 'network', label: 'Network', group: 'Life', Icon: IconNetwork },
  { id: 'vision', label: 'Vision', group: 'Life', Icon: IconVision },
  { id: 'patterns', label: 'Patterns', group: 'Review', Icon: IconPatterns },
  { id: 'progress', label: 'Progress', group: 'Review', Icon: IconProgress },
  { id: 'review', label: 'Review', group: 'Review', Icon: IconReview },
  { id: 'settings', label: 'Settings', group: 'System', Icon: IconSettings },
]

// The nav order lives in SECTIONS so search and the shell cannot disagree.
if (import.meta.env.DEV) {
  const navIds = TABS.map((t) => t.id).join()
  const sectionIds = SECTIONS.map((s) => s.id).join()
  if (navIds !== sectionIds) {
    console.warn('Nav order and SECTIONS have drifted:', navIds, sectionIds)
  }
}

// Alex takes a navigate callback so its two day-form buttons can hand off.
type ScreenProps = { onNavigate?: (tab: string) => void }

const SCREENS: Record<TabId, (props: ScreenProps) => ReactElement> = {
  alex: Alex,
  vision: VisionBoard,
  home: Home,
  today: Today,
  work: Work,
  calendar: Calendar,
  patterns: Patterns,
  map: LifeMap,
  money: Money,
  marketing: Marketing,
  learn: Learn,
  network: Network,
  goals: Goals,
  progress: Progress,
  review: Review,
  settings: Settings,
}

export default function App() {
  const [tab, setTab] = useState<TabId>('alex')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const state = useStore()
  const Screen = SCREENS[tab]

  // Jumping tabs should land at the top, the way a native push does.
  useEffect(() => {
    document.querySelector('.scroll')?.scrollTo({ top: 0 })
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
        {TABS.map(({ id, label, group, Icon }, i) => (
          <div key={id}>
            {group !== TABS[i - 1]?.group && <div className="side-group t-cap">{group}</div>}
            <button
              className="side-item"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
            >
              <Icon />
              {label}
            </button>
          </div>
        ))}
      </nav>

      <main className="scroll">
        <Screen key={tab} onNavigate={(next: string) => setTab(next as TabId)} />
      </main>

      <QuickAdd onNavigate={(next) => setTab(next as TabId)} />

      {paletteOpen && (
        <Palette
          onNavigate={(next) => setTab(next as TabId)}
          onClose={() => setPaletteOpen(false)}
        />
      )}

      <nav className="tabbar" aria-label="Sections">
        {TABS.map(({ id, label, Icon }) => (
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
      </nav>
    </div>
  )
}
