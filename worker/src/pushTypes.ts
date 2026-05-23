export type PushKeys = {
  p256dh: string
  auth: string
}

export type PushSubscriptionJson = {
  endpoint: string
  keys?: PushKeys
  expirationTime?: number | null
}

export type PushSubscriber = {
  endpoint: string
  keys: PushKeys
  uid?: string
  clientId?: string
  disableNotifications: boolean
  deliveryWeekday: number
  deliveryTimeLocal: string
  timezone: string
  updatedAt: number
}

export type SubscribeBody = {
  subscription?: PushSubscriptionJson
  clientId?: string
  disableNotifications?: boolean
  deliveryWeekday?: number
  deliveryTimeLocal?: string
  timezone?: string
}

export type UnsubscribeBody = {
  endpoint?: string
  clientId?: string
}
