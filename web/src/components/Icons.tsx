import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: P) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const Logo = (p: P) => (
  <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true" focusable="false" {...p}>
    <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--accent)" />
    {[0, 1, 2].flatMap((r) =>
      [0, 1, 2].map((c) => (
        <rect
          key={`${r}${c}`}
          x={7 + c * 6.5}
          y={7 + r * 6.5}
          width="5"
          height="5"
          rx="1.2"
          fill="var(--on-accent)"
          opacity={r === 1 && c === 1 ? 1 : 0.45 + 0.1 * ((r + c) % 3)}
        />
      )),
    )}
  </svg>
)

/** Chevron pointing to the inline start; mirrored in right-to-left layouts by CSS (.flip-rtl). */
export const Back = (p: P) => (
  <Icon className="flip-rtl" {...p}>
    <path d="m15 18-6-6 6-6" />
  </Icon>
)
export const Undo = (p: P) => (
  <Icon {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
)
export const Redo = (p: P) => (
  <Icon {...p}>
    <path d="m15 14 5-5-5-5" />
    <path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />
  </Icon>
)
export const Trash = (p: P) => (
  <Icon {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </Icon>
)
export const Link = (p: P) => (
  <Icon {...p}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Icon>
)
export const Download = (p: P) => (
  <Icon {...p}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </Icon>
)
export const FileCode = (p: P) => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5M10 13l-2 2 2 2M14 13l2 2-2 2" />
  </Icon>
)
export const Up = (p: P) => (
  <Icon {...p}>
    <path d="m6 15 6-6 6 6" />
  </Icon>
)
export const Down = (p: P) => (
  <Icon {...p}>
    <path d="m6 9 6 6 6-6" />
  </Icon>
)
export const Close = (p: P) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icon>
)
export const Eye = (p: P) => (
  <Icon {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </Icon>
)
export const EyeOff = (p: P) => (
  <Icon {...p}>
    <path d="M3 3l18 18M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-3.2 4.1M6.6 6.6A17.4 17.4 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Icon>
)
export const Plus = (p: P) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
)
export const Minus = (p: P) => (
  <Icon {...p}>
    <path d="M5 12h14" />
  </Icon>
)
export const Search = (p: P) => (
  <Icon {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Icon>
)
export const Sun = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Icon>
)
export const Moon = (p: P) => (
  <Icon {...p}>
    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
  </Icon>
)
export const Github = (p: P) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...p}>
    <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.42-2.7 5.4-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
  </svg>
)
export const Image = (p: P) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="10" r="2" />
    <path d="m21 16-5-5-9 9" />
  </Icon>
)
export const Reset = (p: P) => (
  <Icon {...p}>
    <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" />
    <path d="M4 4v4.6h4.6" />
  </Icon>
)
export const Split = (p: P) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M12 2v20" />
  </Icon>
)
export const Fit = (p: P) => (
  <Icon {...p}>
    <path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4" />
  </Icon>
)
export const Play = (p: P) => (
  <Icon {...p}>
    <path d="M7 5v14l11-7z" />
  </Icon>
)
export const Terminal = (p: P) => (
  <Icon {...p}>
    <path d="m5 8 4 4-4 4M12 17h7" />
  </Icon>
)
