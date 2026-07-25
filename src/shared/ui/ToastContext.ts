import { createContext } from 'react'

export type Toast = {
  id: string
  message: string
  duration?: number
  type?: 'default' | 'error' | 'success'
  isSticky?: boolean
}

export type ToastContextValue = {
  toasts: Toast[]
  showToast: (toast: Omit<Toast, 'id'>) => string
  removeToast: (id: string) => void
  updateToast: (id: string, update: Partial<Omit<Toast, 'id'>>) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)