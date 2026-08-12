import { areNotificationsEnabled, notifyPackageArrived } from '../../pwa/notifications'
import { generateDuePackages } from './packageGenerator'
import { iconLevelForPackages } from './packageService'

export async function runPackageDeliveryAndNotify() {
  const { created } = await generateDuePackages()
  if (created.length > 0 && areNotificationsEnabled()) {
    const n = created.length
    const level = iconLevelForPackages(created)
    let typeName = 'weekly'
    if (level === 3) typeName = 'yearly'
    else if (level === 2) typeName = 'monthly'

    notifyPackageArrived(
      'New package',
      n === 1 ? `A ${typeName} package is ready on your desk.` : `${n} packages are ready on your desk.`,
    )
  }
  return created
}