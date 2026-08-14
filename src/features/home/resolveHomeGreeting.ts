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

const STORAGE_KEY = scopedStorageKey('mentell.home-greeting')

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

let memoryPick: StoredGreetingPick | null = null

function readStoredPick(): StoredGreetingPick | null {
  if (memoryPick) return memoryPick
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
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
    memoryPick = parsed as StoredGreetingPick
    return memoryPick
  } catch {
    return null
  }
}

function writeStoredPick(pick: StoredGreetingPick) {
  memoryPick = pick
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pick))
  } catch {
    // Ignore quota / private-mode failures; in-memory pick still keeps both mounts in sync.
  }
}

function templateById(id: string, pool: GreetingTemplate[]) {
  return pool.find((row) => row.id === id) ?? null
}

export function resolveHomeGreeting(input: {
  displayName: string
  isLoggedIn: boolean
  oldestContentAt: number | null
  now?: Date
}): ResolvedHomeGreeting {
  const now = input.now ?? new Date()
  const dateKey = dateKeyForLocalDay(now)
  const timeOfDay = timeOfDayAt(now)
  const pool = eligibleGreetings(greetingsCatalog.greetings, timeOfDay)
  const kind = resolveGreetingAddresseeKind({
    displayName: input.displayName,
    isLoggedIn: input.isLoggedIn,
    oldestContentAt: input.oldestContentAt,
    now: now.getTime(),
  })

  let stored = readStoredPick()
  if (!stored || stored.dateKey !== dateKey) {
    stored = {
      dateKey,
      greetingId: pickRandomItem(pool).id,
      nickname: pickRandomItem(greetingsCatalog.nicknames),
      anonNickname: pickRandomItem(greetingsCatalog.anonNicknames),
    }
    writeStoredPick(stored)
  } else if (!templateById(stored.greetingId, pool)) {
    stored = { ...stored, greetingId: pickRandomItem(pool).id }
    writeStoredPick(stored)
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
  memoryPick = null
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
