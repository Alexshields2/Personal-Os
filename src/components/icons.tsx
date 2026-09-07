import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export const IconToday = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.2 2" />
  </svg>
)

export const IconMoney = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3 7.5h18v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z" />
    <path d="M3 7.5 12 3l9 4.5" />
    <path d="M15.5 11.4a3.4 3.4 0 1 0 0 5.2M9.6 12.6h4.2M9.6 15h4.2" />
  </svg>
)

export const IconProgress = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 19V9M10 19V4M16 19v-7M22 19H2" />
  </svg>
)

export const IconReview = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
    <path d="M3.5 9.5h17M8 3v3M16 3v3M8.5 14.2l2.2 2.2 4.3-4.4" />
  </svg>
)

export const IconSettings = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h10M18 7h2M4 12h2M10 12h10M4 17h7M15 17h5" />
    <circle cx="16" cy="7" r="2" />
    <circle cx="8" cy="12" r="2" />
    <circle cx="13" cy="17" r="2" />
  </svg>
)

export const IconCheck = (p: P) => (
  <svg {...base} strokeWidth={3} {...p}>
    <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />
  </svg>
)

export const IconPlus = (p: P) => (
  <svg {...base} strokeWidth={2} {...p}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconChevron = (p: P) => (
  <svg {...base} {...p}>
    <path d="M9 5l7 7-7 7" />
  </svg>
)

export const IconLock = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
  </svg>
)

export const IconUnlock = (p: P) => (
  <svg {...base} {...p}>
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.5" />
  </svg>
)

export const IconWarn = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 4.5 21 19.5H3z" />
    <path d="M12 10v4M12 17h.01" />
  </svg>
)

export const IconTrash = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 7h16M9.5 7V5h5v2M6.5 7l1 13h9l1-13" />
  </svg>
)

export const IconLife = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3v3.3M12 17.7V21M3 12h3.3M17.7 12H21" />
    <path d="M5.6 5.6l2.4 2.4M16 16l2.4 2.4M18.4 5.6L16 8M8 16l-2.4 2.4" />
  </svg>
)

export const IconFlame = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3s5 4.2 5 9a5 5 0 0 1-10 0c0-1.6.7-3 1.5-4 .2 1.4 1 2.3 1.8 2.3 1.3 0 1.6-2.6.7-4.3-.3-.6-.7-1.4-1-2z" />
  </svg>
)

export const IconLearn = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 5.2A1.7 1.7 0 0 1 5.7 3.5H11v16H5.7A1.7 1.7 0 0 0 4 21.2z" />
    <path d="M20 5.2a1.7 1.7 0 0 0-1.7-1.7H13v16h5.3a1.7 1.7 0 0 1 1.7 1.7z" />
  </svg>
)

export const IconPatterns = (p: P) => (
  <svg {...base} {...p}>
    <path d="M4 8.5h11.5a4 4 0 0 1 0 8H8" />
    <path d="M6.6 5.9 4 8.5l2.6 2.6" />
    <path d="M10.4 13.9 7.8 16.5l2.6 2.6" />
  </svg>
)

export const IconNetwork = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.4 19.5a5.9 5.9 0 0 1 11.2 0" />
    <circle cx="17.6" cy="6.4" r="2.4" />
    <path d="M16.4 12.2a4.9 4.9 0 0 1 4.2 4.4" />
  </svg>
)

export const IconMap = (p: P) => (
  <svg {...base} {...p}>
    <path d="M12 3.4v4.4" />
    <path d="M6.4 20.6v-2.4a2 2 0 0 1 2-2h7.2a2 2 0 0 1 2 2v2.4" />
    <path d="M12 16.2v-8.4" />
    <rect x="9.2" y="3.4" width="5.6" height="4.4" rx="1.2" />
    <rect x="3.6" y="16.2" width="5.6" height="4.4" rx="1.2" />
    <rect x="14.8" y="16.2" width="5.6" height="4.4" rx="1.2" />
  </svg>
)

export const IconWork = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="7.2" width="18" height="13" rx="2" />
    <path d="M8.6 7.2V5.6a2 2 0 0 1 2-2h2.8a2 2 0 0 1 2 2v1.6" />
    <path d="M3 12.4h18" />
  </svg>
)

export const IconHome = (p: P) => (
  <svg {...base} {...p}>
    <path d="M3.6 10.4 12 3.8l8.4 6.6" />
    <path d="M5.6 12v7.2a1.2 1.2 0 0 0 1.2 1.2h10.4a1.2 1.2 0 0 0 1.2-1.2V12" />
    <path d="M9.8 20.4v-5.2h4.4v5.2" />
  </svg>
)

export const IconAlex = (p: P) => (
  <svg {...base} {...p}>
    <circle cx="12" cy="12" r="3.1" />
    <path d="M12 3.2v3.4M12 17.4v3.4M3.2 12h3.4M17.4 12h3.4" />
    <path d="M5.8 5.8l2.4 2.4M15.8 15.8l2.4 2.4M18.2 5.8l-2.4 2.4M8.2 15.8l-2.4 2.4" />
  </svg>
)

export const IconVision = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3" y="4.6" width="18" height="14.8" rx="2" />
    <path d="M3 15.6l4.8-4.2 3.6 3.1 3.4-3.9L21 15" />
    <circle cx="8.6" cy="8.8" r="1.4" />
  </svg>
)

export const IconCalendar = (p: P) => (
  <svg {...base} {...p}>
    <rect x="3.2" y="5" width="17.6" height="15.8" rx="2" />
    <path d="M3.2 9.6h17.6M8.2 3.2v3.6M15.8 3.2v3.6" />
  </svg>
)
