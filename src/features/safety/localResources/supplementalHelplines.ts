import { countyStem, effectiveCity } from './rankHelplines'
import type { GeoPlace, LocalResource } from './types'
import type { HelplineRow } from './rankHelplines'

function isBlairCountyArea(place: GeoPlace) {
  const city = effectiveCity(place)
  const county = countyStem(place.county)?.toLowerCase()
  return city === 'altoona' || county === 'blair'
}

/** Lines documented in Global Helplines notes but not always returned as their own record. */
export function supplementalHelplinesForPlace(place: GeoPlace): LocalResource[] {
  if (place.countryCode?.toUpperCase() !== 'US') return []
  if (!isBlairCountyArea(place)) return []

  return [
    {
      id: 'static-upmc-altoona-crisis',
      kind: 'helpline',
      name: 'UPMC Altoona Crisis Services',
      description: '24/7 crisis services for Blair County residents.',
      phone: '814-889-2141',
      hours: '24/7',
      sourceLabel: 'UPMC Altoona (Blair County)',
    },
  ]
}

const UPMC_CRISIS_IN_NOTES =
  /upmc\s+altoona\s+also\s+offers[^0-9]*(\+?1[-.\s]?)?(\d{3})[-.\s]?(\d{3})[-.\s]?(\d{4})/i

export function helplinesFromApiNotes(rows: HelplineRow[]): LocalResource[] {
  const out: LocalResource[] = []
  for (const row of rows) {
    const notes = (row as HelplineRow & { notes?: string }).notes
    if (!notes?.trim()) continue
    const match = notes.match(UPMC_CRISIS_IN_NOTES)
    if (!match) continue
    const phone = `${match[2]}-${match[3]}-${match[4]}`
    out.push({
      id: `notes-upmc-${row.id}`,
      kind: 'helpline',
      name: 'UPMC Altoona Crisis Services',
      description: '24/7 crisis services for Blair County residents.',
      phone,
      hours: '24/7',
      sourceLabel: 'Global Helplines (program notes)',
    })
  }
  return out
}
