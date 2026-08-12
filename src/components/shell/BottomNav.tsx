import { Link, useLocation } from 'react-router-dom'
import { MaterialIcon } from '../MaterialIcon'
import { CharacterNavIcon } from '../../features/character/CharacterNavIcon'

type NavItem = {
  to: string
  label: string
  icon: { kind: 'material'; name: string } | { kind: 'character' }
  prominent?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { to: '/week', label: 'Projector', icon: { kind: 'material', name: 'auto_stories' } },
  { to: '/notes', label: 'Notepad', icon: { kind: 'material', name: 'description' } },
  { to: '/', label: 'Write', icon: { kind: 'material', name: 'edit_square' }, prominent: true },
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
  const leftItems = NAV_ITEMS.filter((item) => !item.prominent).slice(0, 2)
  const centerItem = NAV_ITEMS.find((item) => item.prominent)
  const rightItems = NAV_ITEMS.filter((item) => !item.prominent).slice(2)

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0px,env(safe-area-inset-bottom))]"
      aria-label="Bottom navigation"
    >
      <div className="flex items-end gap-2 rounded-[1.75rem] border border-white/15 bg-white/10 px-3 py-2 shadow-[0_20px_60px_rgba(0,0,0,0.25)] backdrop-blur-xl">
        <div className="flex flex-1 items-center justify-around gap-1">
          {leftItems.map((item) => {
            const active = pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className={`focus-ring flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-2 py-2 transition ${
                  active
                    ? 'bg-[var(--pill-surface)]/95 border border-[var(--paper-border)]'
                    : 'bg-transparent border border-transparent'
                }`}
              >
                <NavIcon item={item} active={active} />
              </Link>
            )
          })}
        </div>
        {centerItem ? (
          <Link
            to={centerItem.to}
            aria-label={centerItem.label}
            className={`focus-ring -mt-5 flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.4rem] border border-[var(--paper-border)] shadow-[0_16px_40px_rgba(0,0,0,0.22)] transition ${
              pathname === centerItem.to ? 'bg-[var(--primary-action)] text-black' : 'paper'
            }`}
          >
            <NavIcon item={centerItem} active={pathname === centerItem.to} />
          </Link>
        ) : null}
        <div className="flex flex-1 items-center justify-around gap-1">
          {rightItems.map((item) => {
            const active = pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                aria-label={item.label}
                className={`focus-ring flex min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl px-2 py-2 transition ${
                  active
                    ? 'bg-[var(--pill-surface)]/95 border border-[var(--paper-border)]'
                    : 'bg-transparent border border-transparent'
                }`}
              >
                <NavIcon item={item} active={active} />
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}

