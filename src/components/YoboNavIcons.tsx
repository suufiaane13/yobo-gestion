import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement> & { size?: number }

function ic(size: number | undefined, rest: SVGProps<SVGSVGElement>) {
  const s = size ?? 16
  return { width: s, height: s, viewBox: '0 0 24 24', fill: 'none', ...rest }
}

export function NavIconDashboard(p: IconProps) {
  return (
    <svg {...ic(p.size, p)} aria-hidden>
      <path
        d="M4 13h7V4H4v9Zm0 7h7v-5H4v5Zm9 0h7V11h-7v9Zm0-18v7h7V4h-7Z"
        fill="currentColor"
        opacity={0.92}
      />
    </svg>
  )
}

export function NavIconCaisse(p: IconProps) {
  return (
    <svg {...ic(p.size, p)} aria-hidden>
      <path
        d="M6 4h12a2 2 0 0 1 2 2v2H4V6a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M4 10h16v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M9 14h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function NavIconHistorique(p: IconProps) {
  return (
    <svg {...ic(p.size, p)} aria-hidden>
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 7v5l3 2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function NavIconProfil(p: IconProps) {
  return (
    <svg {...ic(p.size, p)} aria-hidden>
      <circle cx="12" cy="8.5" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M6.5 19.5c.8-3.2 3.4-4.75 5.5-4.75s4.7 1.55 5.5 4.75"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function NavIconMenu(p: IconProps) {
  return (
    <svg {...ic(p.size, p)} aria-hidden>
      <path
        d="M6 7h12M6 12h12M6 17h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function NavIconLogs(p: IconProps) {
  return (
    <svg {...ic(p.size, p)} aria-hidden>
      <path
        d="M8 6h11M8 11h11M8 16h7"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <path
        d="M5.5 6h.01M5.5 11h.01M5.5 16h.01"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function NavIconUsers(p: IconProps) {
  return (
    <svg {...ic(p.size, p)} aria-hidden>
      <circle cx="9" cy="8" r="2.75" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M4 18c.7-2.4 2.8-3.5 5-3.5s4.3 1.1 5 3.5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="17" cy="9.5" r="2.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="M14 17.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function NavIconQr(p: IconProps) {
  return (
    <svg {...ic(p.size, p)} aria-hidden>
      <path
        d="M4 4h7v7H4V4Zm2 2v3h3V6H6Zm7-2h7v7h-7V4Zm2 2v3h3V6h-3ZM4 13h7v7H4v-7Zm2 2v3h3v-3H6Z"
        fill="currentColor"
        opacity={0.92}
      />
      <path
        d="M13 13h3v3h-3v-3Zm3 3h4v4h-2v-2h-2v-2Zm0-3h4v2h-2v1h-2v-3Z"
        fill="currentColor"
        opacity={0.92}
      />
    </svg>
  )
}

export function NavIconChevronDown(p: IconProps) {
  return (
    <svg {...ic(p.size ?? 14, p)} aria-hidden>
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
