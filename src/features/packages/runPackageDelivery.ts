import { areNotificationsEnabled, notifyPackageArrived } from '../../pwa/notifications'
import { generateDuePackages } from './packageGenerator'

export async function runPackageDeliveryAndNotify() {
  const { created } = await generateDuePackages()
  if (created.length > 0 && areNotificationsEnabled()) {
    const n = created.length
    notifyPackageArrived(
      'New package',
      n === 1 ? 'A weekly package is ready on your desk.' : `${n} weekly packages are ready on your desk.`,
    )
  }
  return created
}
