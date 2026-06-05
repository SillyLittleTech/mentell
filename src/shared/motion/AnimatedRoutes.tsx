import { AnimatePresence, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { useLocation, Routes } from 'react-router-dom'
import { pageTransitionProps } from './pageTransition'

export function AnimatedRoutes({ children }: { children: ReactNode }) {
  const location = useLocation()
  const transition = pageTransitionProps()

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        className="w-full"
        initial={transition.initial}
        animate={transition.animate}
        exit={transition.exit}
        transition={transition.transition}
      >
        <Routes location={location}>{children}</Routes>
      </motion.div>
    </AnimatePresence>
  )
}
