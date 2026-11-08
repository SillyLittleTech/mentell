import type { LocalResource, LocalResourceFetchResult } from './types'

const POOLED_SOURCE_SUFFIX = ' (Pooled Scrape, check important details)'

function phoneKey(phone: string | undefined) {
  if (!phone) return ''
  const digits = phone.replace(/[^\d+]/g, '')
  if (digits === '988' || digits === '211') return digits
  return digits.replace(/\D/g, '')
}

function normalizeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
}

function namesLikelyDuplicate(a: string, b: string) {
  const left = normalizeName(a)
  const right = normalizeName(b)
  if (!left || !right) return false
  if (left === right) return true
  if (left.length >= 8 && right.length >= 8 && (left.includes(right) || right.includes(left))) {
    return true
  }
  const leftTokens = new Set(left.split(' ').filter((token) => token.length > 2))
  const rightTokens = new Set(right.split(' ').filter((token) => token.length > 2))
  let overlap = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1
  }
  return overlap >= 2 && overlap >= Math.min(leftTokens.size, rightTokens.size) - 1
}

export function formatPooledSourceLabel(source: string) {
  const base = source.trim() || 'Public reference'
  if (base.includes('Pooled Scrape')) return base
  return `${base}${POOLED_SOURCE_SUFFIX}`
}

export function dedupePooledAgainstExisting(
  pooled: LocalResource[],
  existing: LocalResource[],
): LocalResource[] {
  const seenPhones = new Set<string>()
  const seenNames: string[] = []
  for (const resource of existing) {
    const phone = phoneKey(resource.phone)
    if (phone) seenPhones.add(phone)
    seenNames.push(resource.name)
  }

  const kept: LocalResource[] = []
  for (const resource of pooled) {
    const phone = phoneKey(resource.phone)
    if (phone && seenPhones.has(phone)) continue
    if (seenNames.some((name) => namesLikelyDuplicate(name, resource.name))) continue
    if (kept.some((row) => namesLikelyDuplicate(row.name, resource.name))) continue
    if (phone) seenPhones.add(phone)
    seenNames.push(resource.name)
    kept.push(resource)
  }
  return kept.slice(0, 5)
}

export function filterStaticNotInResults(
  staticResources: LocalResource[],
  results: LocalResourceFetchResult[],
) {
  const seenPhones = new Set<string>()
  const seenNames = new Set<string>()
  for (const result of results) {
    for (const resource of result.resources) {
      const phone = phoneKey(resource.phone)
      if (phone) seenPhones.add(phone)
      seenNames.add(resource.name.trim().toLowerCase())
    }
  }

  return staticResources.filter((resource) => {
    const phone = phoneKey(resource.phone)
    if (phone && seenPhones.has(phone)) return false
    if (seenNames.has(resource.name.trim().toLowerCase())) return false
    return true
  })
}
