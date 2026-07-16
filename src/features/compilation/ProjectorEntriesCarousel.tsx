import { useRef } from 'react'
import type { EntryRow } from '../../db/schema'
import { ProjectorEntrySlide } from './ProjectorEntrySlide'
import type { ProjectorSearchEntry } from './projectorSearch'

export function ProjectorEntriesCarousel({
  entries,
  onSelect,
}: {
  entries: ProjectorSearchEntry[]
  onSelect: (entry: EntryRow) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  return (
    <div className="relative -mx-5">
      <div
        ref={containerRef}
        className="flex overflow-x-auto snap-x snap-mandatory gap-3 px-5 pb-1 pt-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
        style={{
          maskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)',
          WebkitMaskImage: 'linear-gradient(to right, transparent, black 5%, black 95%, transparent)'
        }}
      >
        {entries.map((entry) => (
          <div
            key={entry.id}
            ref={(node) => {
              if (node) {
                itemRefs.current.set(entry.id, node)
              } else {
                itemRefs.current.delete(entry.id)
              }
            }}
            className="snap-center shrink-0 w-[85%] max-w-[320px] flex flex-col"
          >
            <div className="flex-1 w-full flex flex-col [&>button]:flex-1 [&>button]:w-full">
              <ProjectorEntrySlide
                entry={entry as EntryRow}
                onClick={() => {
                  const el = itemRefs.current.get(entry.id)
                  const container = containerRef.current
                  if (el && container) {
                    const containerRect = container.getBoundingClientRect()
                    const elRect = el.getBoundingClientRect()
                    const isFullyVisible =
                      elRect.left >= containerRect.left - 5 && elRect.right <= containerRect.right + 5
                    if (!isFullyVisible) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
                      return
                    }
                  }
                  onSelect(entry as EntryRow)
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
