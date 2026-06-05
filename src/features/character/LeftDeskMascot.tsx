import { CharacterCorner } from './CharacterCorner'

/**
 * Desktop mascot in the viewport gutter left of the centered max-w-4xl column.
 * Does not affect document flow or header layout.
 */
export function LeftDeskMascot() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed z-10 hidden md:block"
      style={{
        left: 'max(0.5rem, calc(50% - 37rem))',
        top: '10.5rem',
        width: '8.5rem',
        height: '10.5rem',
      }}
    >
      <CharacterCorner className="h-full w-full" />
    </div>
  )
}
