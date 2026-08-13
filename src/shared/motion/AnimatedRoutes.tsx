import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useLocation, Routes } from 'react-router-dom'
import { pageTransitionProps } from './pageTransition'

export function AnimatedRoutes({ children }: { children: ReactNode }) {
  const location = useLocation()
  const transition = pageTransitionProps()
  const enteringLab = location.pathname === '/character-lab'

  return (
    <AnimatePresence mode="popLayout">
      <motion.div
        key={location.pathname}
        className="relative w-full overflow-visible"
        initial={enteringLab ? false : transition.initial}
        animate={transition.animate}
        exit={transition.exit}
        transition={transition.transition}
      >
        <Routes location={location}>{children}</Routes>
      </motion.div>
    </AnimatePresence>
  )
}
