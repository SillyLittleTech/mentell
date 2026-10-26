export type ResourceTopic = 'suicide' | 'mental_health' | 'food' | 'shelter'

export type ContactMethodPreference = 'any' | 'phone' | 'sms' | 'chat'

export type GeoPlace = {
  latitude: number
  longitude: number
  countryCode: string
  regionCode?: string
  city?: string
  county?: string
  zip?: string
  displayName?: string
}

export type LocalResourceKind = 'helpline' | 'food' | 'housing' | 'static' | 'pooled'

export type LocalResource = {
  id: string
  kind: LocalResourceKind
  name: string
  description?: string
  phone?: string
  sms?: string
  chatUrl?: string
  website?: string
  address?: string
  hours?: string
  sourceLabel: string
}

export type LocalResourceFetchResult = {
  topic: ResourceTopic
  resources: LocalResource[]
  error?: string
}
