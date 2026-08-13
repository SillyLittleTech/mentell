import { Link, useLocation } from 'react-router-dom'
import { MaterialIcon } from '../MaterialIcon'
import { CharacterCorner } from '../../features/character/CharacterCorner'
import { CharacterNavIcon } from '../../features/character/CharacterNavIcon'
import { publicUrl } from '../../shared/publicUrl'

type NavItem = {
  to: string
  label: string
  subtitle: string
  icon: { kind: 'material'; name: string } | { kind: 'character' }
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Envelope', subtitle: 'Write', icon: { kind: 'material', name: 'mail' } },
  { to: '/week', label: 'Projector', subtitle: 'Week', icon: { kind: 'material', name: 'auto_stories' } },
  { to: '/notes', label: 'Notepad', subtitle: 'Notes', icon: { kind: 'material', name: 'description' } },
  { to: '/shop', label: 'Shoppe', subtitle: 'Shop', icon: { kind: 'material', name: 'storefront' } },
  { to: '/settings', label: 'Settings', subtitle: 'Prefs', icon: { kind: 'material', name: 'settings' } },
  { to: '/character-lab', label: 'Character', subtitle: 'Lab', icon: { kind: 'character' } },
]

function NavIcon({ item, active }: { item: NavItem; active: boolean }) {
  if (item.icon.kind === 'character') {
    return <CharacterNavIcon className="h-9 w-9 -my-0.5 shrink-0 select-none" />
  }
  return (
    <MaterialIcon
      name={item.icon.name}
      size={24}
      className={active ? 'shrink-0' : 'shrink-0 opacity-90'}
      accent={active}
    />
  )
}

export function SidebarNav() {
  const { pathname } = useLocation()

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
              className={`focus-ring group rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left transition hover:-translate-y-[1px] hover:shadow-[0_12px_22px_rgba(0,0,0,0.12)] ${
                active ? 'bg-[var(--pill-surface)]' : 'bg-[var(--paper-bg)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <NavIcon item={item} active={active} />
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

