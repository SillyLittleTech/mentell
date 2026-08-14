import { useEffect, useState } from 'react'
import { listenToBackgroundActivity } from './backgroundActivity'

export function useBackgroundActivities() {
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

  return activities
}
