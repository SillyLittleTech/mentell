import type { ReactNode } from 'react'
import { CharacterCorner } from './CharacterCorner'

/** Wraps desk page content with a bottom-right character mascot. */
export function DeskCharacterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-visible">
      {children}
      <div className="pointer-events-none absolute bottom-0 right-0 z-[1] -translate-y-1 overflow-visible">
        <CharacterCorner />
      </div>
    </div>
  )
}
