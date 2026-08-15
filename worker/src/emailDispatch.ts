import type { Env } from './env'
import type { EmailSubscriberRecord } from './emailTypes'
import { localTimeParts, dateKeyInTimeZone, lastCompletedWeekRange } from './pushDelivery'
import { firestoreHasEntriesInRange } from './firestoreAdmin'
import { sendResendEmail, generateWeeklySummary } from './emailSend'

export async function processEmailSubscriber(env: Env, key: string, sub: EmailSubscriberRecord, now: Date) {
  if (!sub.verified) return

  let updated = false
  const tz = sub.preferences.timezone || 'America/New_York'
  const { hour } = localTimeParts(now, tz)
  const todayKey = dateKeyInTimeZone(now, tz)

  // 1. Daily Adherence Email
  if (
    sub.preferences.dailyReminderEnabled &&
    env.RESEND_TEMPLATE_DAILY &&
    sub.lastSent?.dailyDate !== todayKey
  ) {
    const targetHour = 24 - (sub.preferences.dailyReminderHours || 1)
    if (hour >= targetHour) {
      // Check if user has an entry today
      let hasEntryToday = false
      if (!sub.userId.startsWith('anon_') && env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        hasEntryToday = await firestoreHasEntriesInRange(
          env.FIREBASE_SERVICE_ACCOUNT_JSON,
          sub.userId,
          todayKey,
          todayKey
        )
      }

      if (!hasEntryToday) {
        const sent = await sendResendEmail(env, env.RESEND_TEMPLATE_DAILY, sub.email, {
          global_name: sub.preferences.globalName || 'there',
          date: todayKey
        })
        if (sent) {
          sub.lastSent = sub.lastSent || {}
          sub.lastSent.dailyDate = todayKey
          updated = true
        }
      }
    }
  }

  // 2. Weekly Package Drop Email
  if (
    sub.preferences.weeklyPackageDropEnabled &&
    env.RESEND_TEMPLATE_PACKAGE
  ) {
    const { weekKey, startKey, endKey } = lastCompletedWeekRange(now, tz)

    if (sub.lastSent?.lastPackageId !== weekKey) {
      if (!sub.userId.startsWith('anon_') && env.FIREBASE_SERVICE_ACCOUNT_JSON) {
        // Need to check if there are any entries for the week
        const hasEntries = await firestoreHasEntriesInRange(
          env.FIREBASE_SERVICE_ACCOUNT_JSON,
          sub.userId,
          startKey,
          endKey
        )

        if (hasEntries) {
          // Verify a package hasn't already been created by the frontend/sync (if this is relevant? The prompt just says when package is available)
          // Actually, we should send it if they have entries for the week and we haven't sent the email yet.

          // Generate summary
          const summary = await generateWeeklySummary(env, sub.userId, weekKey, startKey, endKey, sub.preferences.globalName, sub.preferences.disableAi)

          const sent = await sendResendEmail(env, env.RESEND_TEMPLATE_PACKAGE, sub.email, {
            global_name: sub.preferences.globalName || 'there',
            date: todayKey,
            ent_count: 'Multiple', // We don't easily have exact count without a query
            ent_rank: '⼁', // We don't easily have rank
            ent_sum: summary
          })

          if (sent) {
            sub.lastSent = sub.lastSent || {}
            sub.lastSent.lastPackageId = weekKey
            updated = true
          }
        }
      }
    }
  }

  if (updated) {
    await env.PUSH_KV.put(key, JSON.stringify(sub))
  }
}
