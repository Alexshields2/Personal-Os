import { useEffect, useState } from 'react'
import type { ComponentType, ReactElement, SVGProps } from 'react'
import Today from './screens/Today'
import Money from './screens/Money'
import Progress from './screens/Progress'
import Review from './screens/Review'
import Life from './screens/Life'
import Learn from './screens/Learn'
import Network from './screens/Network'
import Patterns from './screens/Patterns'
import LifeMap from './screens/Map'
import Work from './screens/Work'
import Settings from './screens/Settings'
import {
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
import { PROTOCOL_DAYS } from './lib/config'
import { useStore } from './lib/store'
import { timeline } from './lib/selectors'

type TabId =
  | 'today'
  | 'work'
  | 'patterns'
  | 'map'
  | 'money'
  | 'learn'
  | 'network'
  | 'life'
  | 'progress'
  | 'review'
  | 'settings'

const TABS: { id: TabId; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: 'today', label: 'Today', Icon: IconToday },
  { id: 'work', label: 'Work', Icon: IconWork },
  { id: 'patterns', label: 'Patterns', Icon: IconPatterns },
  { id: 'map', label: 'Map', Icon: IconMap },
  { id: 'money', label: 'Money', Icon: IconMoney },
  { id: 'learn', label: 'Learn', Icon: IconLearn },
  { id: 'network', label: 'Network', Icon: IconNetwork },
  { id: 'life', label: 'Life', Icon: IconLife },
  { id: 'progress', label: 'Progress', Icon: IconProgress },
  { id: 'review', label: 'Review', Icon: IconReview },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
]

const SCREENS: Record<TabId, () => ReactElement> = {
  today: Today,
  work: Work,
  patterns: Patterns,
  map: LifeMap,
  money: Money,
  learn: Learn,
  network: Network,
  life: Life,
  progress: Progress,
  review: Review,
  settings: Settings,
}

export default function App() {
  const [tab, setTab] = useState<TabId>('today')
  const state = useStore()
  const t = timeline(state)
  const Screen = SCREENS[tab]

  // Jumping tabs should land at the top, the way a native push does.
  useEffect(() => {
    document.querySelector('.scroll')?.scrollTo({ top: 0 })
  }, [tab])

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
