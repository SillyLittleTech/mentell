import { useCallback, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatedNavIcon } from './AnimatedNavIcon'
import { bumpNavReplayTokens } from './navReplay'

type NavItem = {
  to: string
  label: string
  prominent?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/week', label: 'Projector' },
  { to: '/notes', label: 'Notepad' },
  { to: '/', label: 'Write', prominent: true },
  { to: '/shop', label: 'Shoppe' },
  { to: '/settings', label: 'Settings' },
  { to: '/character-lab', label: 'Character' },
]

export function BottomNav() {
  const { pathname } = useLocation()
  const [replayTokens, setReplayTokens] = useState<Record<string, number>>({})

  const bumpReplay = useCallback((to: string) => {
    setReplayTokens((prev) => bumpNavReplayTokens(prev, to))
  }, [])

  const leftItems = NAV_ITEMS.filter((item) => !item.prominent).slice(0, 2)
  const centerItem = NAV_ITEMS.find((item) => item.prominent)
  const rightItems = NAV_ITEMS.filter((item) => !item.prominent).slice(2)

  const renderLink = (item: NavItem, iconSize: number, characterClass: string) => {
    const active = pathname === item.to
    return (
      <Link
        key={item.to}
        to={item.to}
        aria-label={item.label}
        onClick={() => bumpReplay(item.to)}
        className={`focus-ring flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-2 py-2 transition ${
          active
            ? 'bg-[var(--pill-surface)]/95 border border-[var(--paper-border)]'
            : 'bg-transparent border border-transparent'
        }`}
      >
        <AnimatedNavIcon
          to={item.to}
          variant="bottom"
          active={active}
          size={iconSize}
          replayToken={replayTokens[item.to] ?? 0}
          characterClassName={characterClass}
        />
      </Link>
    )
  }

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0px,env(safe-area-inset-bottom))]"
      aria-label="Bottom navigation"
    >
      <div className="flex items-end gap-2 rounded-[1.75rem] border border-white/15 bg-white/10 px-3 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        <div className="flex flex-1 items-center justify-around gap-1">
          {leftItems.map((item) => renderLink(item, 22, 'h-8 w-8 -my-0.5 shrink-0 select-none'))}
        </div>
        {centerItem ? (
          <Link
            to={centerItem.to}
            aria-label={centerItem.label}
            onClick={() => bumpReplay(centerItem.to)}
            className={`focus-ring -mt-5 flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] border border-[var(--paper-border)] shadow-[0_16px_40px_rgba(0,0,0,0.22)] transition ${
              pathname === centerItem.to ? 'bg-[var(--primary-action)] text-black' : 'paper'
            }`}
          >
            <AnimatedNavIcon
              to={centerItem.to}
              variant="bottom"
              active={pathname === centerItem.to}
              size={22}
              replayToken={replayTokens[centerItem.to] ?? 0}
            />
          </Link>
        ) : null}
        <div className="flex flex-1 items-center justify-around gap-1">
          {rightItems.map((item) => renderLink(item, 22, 'h-8 w-8 -my-0.5 shrink-0 select-none'))}
        </div>
      </div>
    </nav>
  )
}
