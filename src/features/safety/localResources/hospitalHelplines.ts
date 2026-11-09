import type { LocalResource } from './types'

export function isHospitalHelpline(resource: LocalResource) {
  const name = resource.name.toLowerCase()
  const desc = (resource.description ?? '').toLowerCase()
  if (/safe2say|school safety|tip line/i.test(name)) return false
  if (/hospital|psychiatric|emergency department|\(upmc\)|crisis services/i.test(name)) return true
  return /hospital|emergency department|\ber\b/i.test(desc)
}

export function partitionHospitalHelplines(resources: LocalResource[]) {
  const hospital: LocalResource[] = []
  const other: LocalResource[] = []
  for (const resource of resources) {
    if (isHospitalHelpline(resource)) hospital.push(resource)
    else other.push(resource)
  }
  return { hospital, other }
}
