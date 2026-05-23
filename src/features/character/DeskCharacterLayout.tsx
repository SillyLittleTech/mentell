import type { ReactNode } from 'react'

/** Desk page content only — mascot lives in the header overlay, not in document flow. */
export function DeskCharacterLayout({ children }: { children: ReactNode }) {
  return <div className="overflow-visible">{children}</div>
}
