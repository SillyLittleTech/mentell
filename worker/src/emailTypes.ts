export interface EmailSubscriberRecord {
  userId: string
  email: string
  verified: boolean
  verifyToken?: string
  createdAt: number
  preferences: {
    dailyReminderEnabled: boolean
    dailyReminderHours: number // 1-4 hours before midnight
    weeklyPackageDropEnabled: boolean
    timezone: string
    globalName?: string
    disableAi?: boolean
  }
  lastSent?: {
    dailyDate?: string // YYYY-MM-DD
    lastPackageId?: string // e.g. 2024-W01
  }
}

export interface VerifyTokenRecord {
  userId: string
  email: string
  expiresAt: number
}

export type SubscribeEmailBody = {
  email: string
  clientId?: string
  dailyReminderEnabled?: boolean
  dailyReminderHours?: number
  weeklyPackageDropEnabled?: boolean
  timezone?: string
  globalName?: string
  disableAi?: boolean
  autoVerify?: boolean
}
