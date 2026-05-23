import { getDb, type PackageKind, type PackageRow } from '../../db/schema'
import { makeId } from '../../shared/id'
import { awardForPackageOpen } from '../score/scoreService'
import { notifyLocalDataChanged } from '../../shared/sync/localDataEvents'

export async function ensurePackage(kind: PackageKind, periodKey: string) {
  return (await ensurePackageWithStatus(kind, periodKey)).row
}

export async function ensurePackageWithStatus(kind: PackageKind, periodKey: string) {
  const existing = await getDb().packages.where({ kind, periodKey }).first()
  if (existing) return { row: existing, created: false as const }
  const now = Date.now()
  const row: PackageRow = {
    id: makeId('pkg'),
    kind,
    periodKey,
    createdAt: now,
    updatedAt: now,
  }
  await getDb().packages.put(row)
  notifyLocalDataChanged()
  return { row, created: true as const }
}

export async function markPackageOpened(id: string) {
  const pkg = await getDb().packages.get(id)
  if (!pkg) return { awarded: false as const, delta: 0, hint: null as string | null }
  if (pkg.openedAt) return { awarded: false as const, delta: 0, hint: null as string | null }

  const award = awardForPackageOpen(pkg.kind)
  const now = Date.now()
  await getDb().packages.update(id, {
    openedAt: now,
    openedScoreDelta: award.delta,
    updatedAt: now,
  })
  notifyLocalDataChanged()
  return { awarded: true as const, delta: award.delta, hint: award.hint }
}

export async function getUnopenedPackages() {
  const all = await getDb().packages.toArray()
  return all.filter((p) => !p.openedAt).sort((a, b) => b.createdAt - a.createdAt)
}

export async function hasDeliveredWeeklyPackage() {
  const count = await getDb().packages.where('kind').equals('weekly').count()
  return count > 0
}

export function iconLevelForPackages(pkgs: { kind: PackageKind }[]) {
  const counts = { weekly: 0, monthly: 0, yearly: 0 }
  for (const p of pkgs) counts[p.kind]++
  if (counts.yearly > 0) return 3
  if (counts.monthly > 0) return 2
  if (counts.weekly > 0) return 1
  return 0
}
