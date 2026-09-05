import { useEffect, useState } from 'react'
import type { ComponentType, ReactElement, SVGProps } from 'react'
import Home from './screens/Home'
import Today from './screens/Today'
import Money from './screens/Money'
import Progress from './screens/Progress'
import Review from './screens/Review'
import Learn from './screens/Learn'
import Network from './screens/Network'
import Patterns from './screens/Patterns'
import LifeMap from './screens/Map'
import Goals from './screens/Goals'
import Work from './screens/Work'
import Settings from './screens/Settings'
import {
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
  IconWork,
} from './components/icons'
import Palette from './components/Palette'
import { PROTOCOL_DAYS, SECTIONS } from './lib/config'
import { useStore } from './lib/store'
import { timeline } from './lib/selectors'

type TabId =
  | 'home'
  | 'today'
  | 'work'
  | 'patterns'
  | 'map'
  | 'money'
  | 'learn'
  | 'network'
  | 'goals'
  | 'progress'
  | 'review'
  | 'settings'

const TABS: { id: TabId; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: 'home', label: 'Home', Icon: IconHome },
  { id: 'today', label: 'Today', Icon: IconToday },
  { id: 'work', label: 'Work', Icon: IconWork },
  { id: 'patterns', label: 'Patterns', Icon: IconPatterns },
  { id: 'map', label: 'Map', Icon: IconMap },
  { id: 'money', label: 'Money', Icon: IconMoney },
  { id: 'learn', label: 'Learn', Icon: IconLearn },
  { id: 'network', label: 'Network', Icon: IconNetwork },
  { id: 'goals', label: 'Goals', Icon: IconLife },
  { id: 'progress', label: 'Progress', Icon: IconProgress },
  { id: 'review', label: 'Review', Icon: IconReview },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
]

// The nav order lives in SECTIONS so search and the shell cannot disagree.
if (import.meta.env.DEV) {
  const navIds = TABS.map((t) => t.id).join()
  const sectionIds = SECTIONS.map((s) => s.id).join()
  if (navIds !== sectionIds) {
    console.warn('Nav order and SECTIONS have drifted:', navIds, sectionIds)
  }
}

const SCREENS: Record<TabId, () => ReactElement> = {
  home: Home,
  today: Today,
  work: Work,
  patterns: Patterns,
  map: LifeMap,
  money: Money,
  learn: Learn,
  network: Network,
  goals: Goals,
  progress: Progress,
  review: Review,
  settings: Settings,
}

export default function App() {
  const [tab, setTab] = useState<TabId>('home')
  const [paletteOpen, setPaletteOpen] = useState(false)
  const state = useStore()
  const t = timeline(state)
  const Screen = SCREENS[tab]

  // Jumping tabs should land at the top, the way a native push does.
  useEffect(() => {
    document.querySelector('.scroll')?.scrollTo({ top: 0 })
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
            Day {t.day}
            <span className="muted" style={{ fontWeight: 400 }}>
              /{PROTOCOL_DAYS}
            </span>
          </div>
        </div>
        <button className="palette-hint" onClick={() => setPaletteOpen(true)}>
          Search everything
          <kbd>⌘K</kbd>
        </button>
        {TABS.map(({ id, label, Icon }) => (
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
      </nav>

      <main className="scroll">
        <Screen key={tab} />
      </main>

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
