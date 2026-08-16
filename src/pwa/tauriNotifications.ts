import { invoke } from '@tauri-apps/api/core'
import { isTauri } from '../shared/platform/runtime'
import { loadAppSettings } from '../shared/settings/appSettings'

export async function showTauriNotification(title: string, body: string) {
  await invoke('show_native_notification', { title, body })
}

export async function syncTauriDeliverySchedule() {
  if (!isTauri()) return
  const settings = loadAppSettings()
  if (settings.disableNotifications) {
    await invoke('cancel_weekly_notification')
    return
  }
  const [hourRaw, minuteRaw] = settings.deliveryTimeLocal.split(':')
  const hour = Number(hourRaw)
  const minute = Number(minuteRaw)
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return
  await invoke('schedule_weekly_notification', {
    weekday: settings.deliveryWeekday,
    hour,
    minute,
    title: 'Mentell',
    body: 'Your weekly package may be ready — open Mentell to check.',
  })
}
