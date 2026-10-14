import type { ReactNode } from 'react'

export function Tooltip({
  x,
  top = 0,
  flip,
  children,
}: {
  x: number
  top?: number
  flip: boolean
  children: ReactNode
}) {
  return (
    <div
      className="tooltip"
      style={{ left: x, top, transform: flip ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)' }}
      role="status"
    >
      {children}
    </div>
  )
}
