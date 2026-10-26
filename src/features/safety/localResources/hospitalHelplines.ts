import type { LocalResource } from './types'

export function isHospitalHelpline(resource: LocalResource) {
  const blob = `${resource.name} ${resource.description ?? ''}`.toLowerCase()
  return /hospital|emergency department|\ber\b|psychiatric|crisis center|crisis services/i.test(blob)
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
