import { useEffect, useState } from 'react'
import type { ComponentType, ReactElement, SVGProps } from 'react'
import Today from './screens/Today'
import Money from './screens/Money'
import Progress from './screens/Progress'
import Review from './screens/Review'
import Settings from './screens/Settings'
import {
  IconMoney,
  IconProgress,
  IconReview,
  IconSettings,
  IconToday,
} from './components/icons'
import { PROTOCOL_DAYS } from './lib/config'
import { useStore } from './lib/store'
import { timeline } from './lib/selectors'

type TabId = 'today' | 'money' | 'progress' | 'review' | 'settings'

const TABS: { id: TabId; label: string; Icon: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { id: 'today', label: 'Today', Icon: IconToday },
  { id: 'money', label: 'Money', Icon: IconMoney },
  { id: 'progress', label: 'Progress', Icon: IconProgress },
  { id: 'review', label: 'Review', Icon: IconReview },
  { id: 'settings', label: 'Settings', Icon: IconSettings },
]

const SCREENS: Record<TabId, () => ReactElement> = {
  today: Today,
  money: Money,
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

  return (
    <div className="app">
      <nav className="sidebar" aria-label="Sections">
        <div className="brand">
          <div className="t-cap" style={{ color: 'var(--accent)' }}>
            Comeback protocol
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
