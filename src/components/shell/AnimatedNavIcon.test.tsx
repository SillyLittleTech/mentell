import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AnimatedNavIcon } from './AnimatedNavIcon'
import { NAV_ICONS } from './navIconMotion'

vi.mock('framer-motion', () => ({
  motion: {
    span: ({
      children,
      'data-testid': testId,
      ...rest
    }: {
      children?: React.ReactNode
      'data-testid'?: string
      animate?: unknown
      initial?: unknown
    }) => (
      <span data-testid={testId ?? 'motion-span'} data-animate={JSON.stringify(rest.animate ?? null)}>
        {children}
      </span>
    ),
  },
}))

vi.mock('../../features/character/CharacterNavIcon', () => ({
  CharacterNavIcon: () => <img alt="" data-testid="character-nav-icon" />,
}))

describe('AnimatedNavIcon', () => {
  it('renders a static material icon before any tab click', () => {
    render(
      <AnimatedNavIcon to="/settings" variant="sidebar" active={false} size={24} replayToken={0} />,
    )
    expect(screen.getByText(NAV_ICONS.settings)).toBeTruthy()
    expect(screen.queryByTestId('motion-span')).toBeNull()
  })

  it('uses motion wrapper after replay token bumps', () => {
    render(
      <AnimatedNavIcon to="/shop" variant="sidebar" active={true} size={24} replayToken={1} />,
    )
    const motion = screen.getByTestId('motion-span')
    expect(motion).toBeTruthy()
    const animate = JSON.parse(motion.getAttribute('data-animate') ?? 'null') as {
      skewX?: number
    }
    expect(animate.skewX).toBe(0)
  })

  it('uses desktop mail icon for envelope on sidebar', () => {
    render(<AnimatedNavIcon to="/" variant="sidebar" active={false} size={24} replayToken={0} />)
    expect(screen.getByText(NAV_ICONS.envelopeDesktop)).toBeTruthy()
  })

  it('uses mobile write icon for envelope on bottom nav', () => {
    render(<AnimatedNavIcon to="/" variant="bottom" active={false} size={22} replayToken={0} />)
    expect(screen.getByText(NAV_ICONS.envelopeMobile)).toBeTruthy()
  })

  it('renders character badge for character lab', () => {
    render(
      <AnimatedNavIcon
        to="/character-lab"
        variant="sidebar"
        active={false}
        size={24}
        replayToken={0}
        characterClassName="h-9 w-9"
      />,
    )
    expect(screen.getByTestId('character-nav-icon')).toBeTruthy()
  })
})
