import type { ReactNode } from 'react'
import { CharacterCorner } from './CharacterCorner'

/** Wraps desk page content and places mascot in spare page space on larger screens. */
export function DeskCharacterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-visible">
      {children}
      <div className="pointer-events-none mt-4 hidden justify-end pr-1 md:flex">
        <CharacterCorner />
      </div>
    </div>
  )
}
