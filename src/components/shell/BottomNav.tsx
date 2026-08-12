import { Link, useLocation } from 'react-router-dom'
import { MaterialIcon } from '../MaterialIcon'
import { CharacterNavIcon } from '../../features/character/CharacterNavIcon'

type NavItem = {
  to: string
  label: string
  icon: { kind: 'material'; name: string } | { kind: 'character' }
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Envelope', icon: { kind: 'material', name: 'mail' } },
  { to: '/week', label: 'Projector', icon: { kind: 'material', name: 'auto_stories' } },
  { to: '/notes', label: 'Notepad', icon: { kind: 'material', name: 'description' } },
  { to: '/shop', label: 'Shoppe', icon: { kind: 'material', name: 'storefront' } },
  { to: '/settings', label: 'Settings', icon: { kind: 'material', name: 'settings' } },
  { to: '/character-lab', label: 'Character', icon: { kind: 'character' } },
]

function NavIcon({ item, active }: { item: NavItem; active: boolean }) {
  if (item.icon.kind === 'character') {
    return <CharacterNavIcon className={`h-8 w-8 -my-0.5 shrink-0 select-none ${active ? '' : 'opacity-90'}`} />
  }
  return (
    <MaterialIcon
      name={item.icon.name}
      size={22}
      accent={active}
      className={active ? '' : 'opacity-90'}
    />
  )
}

export function BottomNav() {
  const { pathname } = useLocation()

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0px,env(safe-area-inset-bottom))]"
      aria-label="Bottom navigation"
    >
      <div className="paper flex items-center justify-between rounded-3xl px-2 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.25)]">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-label={item.label}
              className={`focus-ring flex flex-1 items-center justify-center gap-2 rounded-2xl px-2 py-2 transition ${
                active ? 'bg-[var(--pill-surface)] border border-[var(--paper-border)]' : 'bg-transparent border border-transparent'
              }`}
            >
              <NavIcon item={item} active={active} />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

