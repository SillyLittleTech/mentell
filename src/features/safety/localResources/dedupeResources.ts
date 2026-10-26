import type { LocalResource, LocalResourceFetchResult } from './types'

function phoneKey(phone: string | undefined) {
  if (!phone) return ''
  return phone.replace(/[^\d+]/g, '')
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
