import { useCallback, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CharacterCorner } from '../../features/character/CharacterCorner'
import { publicUrl } from '../../shared/publicUrl'
import { AnimatedNavIcon } from './AnimatedNavIcon'
import { bumpNavReplayTokens } from './navReplay'

type NavItem = {
  to: string
  label: string
  subtitle: string
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Envelope', subtitle: 'Write' },
  { to: '/week', label: 'Projector', subtitle: 'Week' },
  { to: '/notes', label: 'Notepad', subtitle: 'Notes' },
  { to: '/shop', label: 'Shoppe', subtitle: 'Shop' },
  { to: '/settings', label: 'Settings', subtitle: 'Prefs' },
  { to: '/character-lab', label: 'Character', subtitle: 'Lab' },
]

export function SidebarNav() {
  const { pathname } = useLocation()
  const [replayTokens, setReplayTokens] = useState<Record<string, number>>({})

  const bumpReplay = useCallback((to: string) => {
    setReplayTokens((prev) => bumpNavReplayTokens(prev, to))
  }, [])

  return (
    <aside className="hidden md:sticky md:top-4 md:flex md:h-[calc(100svh-2rem)] md:w-[16rem] md:flex-col md:gap-4">
      <div className="paper flex items-center gap-3 rounded-2xl px-4 py-3">
        <img
          alt=""
          src={publicUrl('/asset/mentell-icon.png')}
          className="h-10 w-10 shrink-0 select-none object-contain"
          draggable={false}
        />
        <div>
          <div className="font-paper text-2xl tracking-tight">Mentell</div>
          <div className="ink-muted text-sm">local-first stationery journal</div>
        </div>
      </div>

      <nav className="grid gap-2">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => bumpReplay(item.to)}
              className={`focus-ring group rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left transition hover:-translate-y-[1px] hover:shadow-[0_12px_22px_rgba(0,0,0,0.12)] ${
                active ? 'bg-[var(--pill-surface)]' : 'bg-[var(--paper-bg)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <AnimatedNavIcon
                  to={item.to}
                  variant="sidebar"
                  active={active}
                  size={24}
                  replayToken={replayTokens[item.to] ?? 0}
                  characterClassName="h-9 w-9 -my-0.5 shrink-0 select-none"
                />
                <div>
                  <div className="font-mono text-xs opacity-70">{item.label}</div>
                  <div className="text-sm font-medium">{item.subtitle}</div>
                </div>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Empty-space companion placement: sits below the nav stack */}
      <div className="flex flex-1 items-start justify-center pt-1">
        {pathname === '/character-lab' ? null : (
          <CharacterCorner className="h-64 w-auto translate-y-0" />
        )}
      </div>
    </aside>
  )
}
