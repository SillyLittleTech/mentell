import { useState, useCallback, useMemo } from 'react'
import { ToastContext, type Toast } from './ToastContext'

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (toastInput: Omit<Toast, 'id'>) => {
      const id = crypto.randomUUID()
      const toast: Toast = { ...toastInput, id }

      setToasts((prev) => [...prev, toast])

      return id
    },
    []
  )

  const updateToast = useCallback((id: string, update: Partial<Omit<Toast, 'id'>>) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, ...update } : t)))
  }, [])

  const value = useMemo(
    () => ({ toasts, showToast, removeToast, updateToast }),
    [toasts, showToast, removeToast, updateToast]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
    </ToastContext.Provider>
  )
}