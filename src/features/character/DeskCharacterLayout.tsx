import type { ReactNode } from 'react'
import { CharacterCorner } from './CharacterCorner'

/** Wraps desk page content and places mascot in spare page space on larger screens. */
export function DeskCharacterLayout({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-visible lg:grid lg:grid-cols-[minmax(0,1fr)_8rem] lg:gap-4">
      <div className="min-w-0">{children}</div>
      <div className="pointer-events-none hidden lg:block">
        <div className="sticky top-4">
          <CharacterCorner className="mx-auto h-36 w-[7.5rem]" />
        </div>
      </div>
    </div>
  )
}
