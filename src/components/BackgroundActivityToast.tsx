import { useEffect, useState } from 'react'
import { listenToBackgroundActivity } from '../shared/backgroundActivity'

export function BackgroundActivityToast() {
  const [activities, setActivities] = useState<Record<string, string>>({})

  useEffect(() => {
    const unsub = listenToBackgroundActivity((event) => {
      setActivities((prev) => {
        const next = { ...prev }
        if (event.type === 'start') {
          next[event.id] = event.message
        } else {
          delete next[event.id]
        }
        return next
      })
    })
    return () => {
      unsub()
    }
  }, [])

  const activeMessages = Object.values(activities)
  if (activeMessages.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {activeMessages.map((msg, i) => (
        <div
          key={i}
          className="paper flex items-center gap-2 rounded-xl px-3 py-2 text-sm shadow-md animate-in fade-in slide-in-from-bottom-2"
        >
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          {msg}
        </div>
      ))}
    </div>
  )
}
