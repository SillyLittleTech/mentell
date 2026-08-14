export const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export type GreetingAddresseeKind = 'name' | 'nickname' | 'anon'

export type GreetingTimeOfDay = 'morning' | 'afternoon' | 'evening'

export type GreetingTemplate = {
  id: string
  text: string
  timeOfDay?: GreetingTimeOfDay
}

/** Global / AI name wins. New or week-old journals use anon nicknames; established (or signed-in with history) use friendly nicknames. */
export function resolveGreetingAddresseeKind(input: {
  displayName: string
  isLoggedIn: boolean
  oldestContentAt: number | null
  now?: number
}): GreetingAddresseeKind {
  if (input.displayName.trim()) return 'name'

  const now = input.now ?? Date.now()
  const hasContent = input.oldestContentAt != null
  const isNewcomer =
    !hasContent || now - input.oldestContentAt! < WEEK_MS

  if (isNewcomer) return 'anon'
  if (input.isLoggedIn || hasContent) return 'nickname'
  return 'anon'
}

export function timeOfDayAt(date: Date): GreetingTimeOfDay {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  return 'evening'
}

export function eligibleGreetings(
  greetings: GreetingTemplate[],
  timeOfDay: GreetingTimeOfDay,
): GreetingTemplate[] {
  const matching = greetings.filter(
    (greeting) => !greeting.timeOfDay || greeting.timeOfDay === timeOfDay,
  )
  return matching.length > 0 ? matching : greetings
}

export function pickRandomItem<T>(items: readonly T[], random = Math.random): T {
  if (items.length === 0) {
    throw new Error('Cannot pick from an empty list')
  }
  const index = Math.min(items.length - 1, Math.floor(random() * items.length))
  return items[index] as T
}

export type GreetingSegment = {
  kind: 'text' | 'name'
  value: string
}

export function formatGreetingSegments(
  template: string,
  name: string,
): GreetingSegment[] {
  const parts = template.split('{name}')
  if (parts.length === 1) {
    return [{ kind: 'text', value: template }]
  }
  const segments: GreetingSegment[] = []
  parts.forEach((part, index) => {
    if (part) segments.push({ kind: 'text', value: part })
    if (index < parts.length - 1) {
      segments.push({ kind: 'name', value: name })
    }
  })
  return segments
}
