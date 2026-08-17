import { dateKeyForLocalDay } from '../../shared/dates'
import { scopedStorageKey } from '../../shared/storage/storageScope'
import {
  eligibleGreetings,
  pickRandomItem,
  resolveGreetingAddresseeKind,
  timeOfDayAt,
  type GreetingAddresseeKind,
  type GreetingTemplate,
} from './greetingAddress'
import { greetingsCatalog } from './greetingsCatalog'



type StoredGreetingPick = {
  dateKey: string
  greetingId: string
  nickname: string
  anonNickname: string
}

export type ResolvedHomeGreeting = {
  template: GreetingTemplate
  kind: GreetingAddresseeKind
  name: string
  phrase: string
}

let memoryPicks: Record<string, StoredGreetingPick> = {}

function readStoredPick(context?: string, isMobile?: boolean): StoredGreetingPick | null {
  const key = (context ?? 'default') + (isMobile ? '-mobile' : '');
  if (memoryPicks[key]) return memoryPicks[key];
  try {
    const raw = sessionStorage.getItem(scopedStorageKey(`mentell.home-greeting.${key}`))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredGreetingPick>
    if (
      typeof parsed.dateKey !== 'string' ||
      typeof parsed.greetingId !== 'string' ||
      typeof parsed.nickname !== 'string' ||
      typeof parsed.anonNickname !== 'string'
    ) {
      return null
    }
    memoryPicks[key] = parsed as StoredGreetingPick
    return memoryPicks[key]
  } catch {
    return null
  }
}

function writeStoredPick(pick: StoredGreetingPick, context?: string, isMobile?: boolean) {
  const key = (context ?? 'default') + (isMobile ? '-mobile' : '')
  memoryPicks[key] = pick
  try {
    sessionStorage.setItem(scopedStorageKey(`mentell.home-greeting.${key}`), JSON.stringify(pick))
  } catch {
    // Ignore quota / private-mode failures; in-memory pick still keeps both mounts in sync.
  }
}

function templateById(id: string, pool: GreetingTemplate[]) {
  return pool.find((row) => row.id === id) ?? null
}

export function resolveHomeGreeting(input: {
  context?: string
  displayName: string
  isLoggedIn: boolean
  oldestContentAt: number | null
  now?: Date
  isMobile?: boolean
}): ResolvedHomeGreeting {
  const now = input.now ?? new Date()
  const dateKey = dateKeyForLocalDay(now)
  const timeOfDay = timeOfDayAt(now)
  const pool = eligibleGreetings(greetingsCatalog.greetings, timeOfDay, input.context, input.isMobile)
  const kind = resolveGreetingAddresseeKind({
    displayName: input.displayName,
    isLoggedIn: input.isLoggedIn,
    oldestContentAt: input.oldestContentAt,
    now: now.getTime(),
  })

  let stored = readStoredPick(input.context, input.isMobile)
  if (!stored || stored.dateKey !== dateKey) {
    stored = {
      dateKey,
      greetingId: pickRandomItem(pool).id,
      nickname: pickRandomItem(greetingsCatalog.nicknames),
      anonNickname: pickRandomItem(greetingsCatalog.anonNicknames),
    }
    writeStoredPick(stored, input.context, input.isMobile)
  } else if (!templateById(stored.greetingId, pool)) {
    stored = { ...stored, greetingId: pickRandomItem(pool).id }
    writeStoredPick(stored, input.context, input.isMobile)
  }

  const template = templateById(stored.greetingId, pool) ?? pool[0]!
  const name =
    kind === 'name'
      ? input.displayName.trim()
      : kind === 'nickname'
        ? stored.nickname
        : stored.anonNickname

  return {
    template,
    kind,
    name,
    phrase: template.text.replaceAll('{name}', name),
  }
}

export function resetHomeGreetingSessionForTests() {
  memoryPicks = {}
  try {
    sessionStorage.clear() // Or clear all matching keys, but for tests this is fine.
  } catch {
    // ignore
  }
}
