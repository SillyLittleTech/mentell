import { useEffect, useState } from 'react'
import { pickRandomItem, timeOfDayAt } from '../../home/greetingAddress'
import compInsightRaw from '../../../../dynamics/compInsight.json?raw'
import { scopedStorageKey } from '../../../shared/storage/storageScope'

type CompInsightData = {
  timeCues: {
    morning: string[]
    afternoon: string[]
    evening: string[]
    night: string[]
  }
  letterNicknames: string[]
}

const parseInsightData = (): CompInsightData => {
  try {
    return JSON.parse(compInsightRaw) as CompInsightData
  } catch {
    return {
      timeCues: {
        morning: ["Morning"],
        afternoon: ["Afternoon"],
        evening: ["Evening"],
        night: ["Night"]
      },
      letterNicknames: ["letter"]
    }
  }
}

const compInsightData = parseInsightData()

type StoredComposePick = {
  timeOfDay: string
  timeCue: string
  nickname: string
}

function getStoredPick(): StoredComposePick | null {
  try {
    const raw = sessionStorage.getItem(scopedStorageKey('mentell.compose-insight'))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredComposePick>
    if (
      typeof parsed.timeOfDay !== 'string' ||
      typeof parsed.timeCue !== 'string' ||
      typeof parsed.nickname !== 'string'
    ) {
      return null
    }
    return parsed as StoredComposePick
  } catch {
    return null
  }
}

function writeStoredPick(pick: StoredComposePick) {
  try {
    sessionStorage.setItem(scopedStorageKey('mentell.compose-insight'), JSON.stringify(pick))
  } catch {
    // Ignore quota/private-mode failures
  }
}

export function useComposeInsight(): string {
  const [insight, setInsight] = useState<string>("Draft a letter")

  useEffect(() => {
    const now = new Date()
    const currentTimeOfDay = timeOfDayAt(now)
    let stored = getStoredPick()

    if (!stored || stored.timeOfDay !== currentTimeOfDay) {
      const timeCuesForPeriod = compInsightData.timeCues[currentTimeOfDay] || ["Note"]
      stored = {
        timeOfDay: currentTimeOfDay,
        timeCue: pickRandomItem(timeCuesForPeriod),
        nickname: pickRandomItem(compInsightData.letterNicknames),
      }
      writeStoredPick(stored)
    }

    setInsight(`${stored.timeCue} ${stored.nickname}`)
  }, [])

  return insight
}
