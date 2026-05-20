import { db, type PackageKind, type PackageRow } from '../../db/schema'
import { makeId } from '../../shared/id'
import { awardForPackageOpen } from '../score/scoreService'

export async function ensurePackage(kind: PackageKind, periodKey: string) {
  const existing = await db.packages.where({ kind, periodKey }).first()
  if (existing) return existing
  const row: PackageRow = {
    id: makeId('pkg'),
    kind,
    periodKey,
    createdAt: Date.now(),
  }
  await db.packages.put(row)
  return row
}

export async function markPackageOpened(id: string) {
  const pkg = await db.packages.get(id)
  if (!pkg) return { awarded: false as const, delta: 0, hint: null as string | null }
  if (pkg.openedAt) return { awarded: false as const, delta: 0, hint: null as string | null }

  const award = awardForPackageOpen(pkg.kind)
  await db.packages.update(id, { openedAt: Date.now(), openedScoreDelta: award.delta })
  return { awarded: true as const, delta: award.delta, hint: award.hint }
}

export async function getUnopenedPackages() {
  const all = await db.packages.toArray()
  return all.filter((p) => !p.openedAt).sort((a, b) => b.createdAt - a.createdAt)
}

export function iconLevelForPackages(pkgs: { kind: PackageKind }[]) {
  const counts = { weekly: 0, monthly: 0, yearly: 0 }
  for (const p of pkgs) counts[p.kind]++
  if (counts.yearly > 0) return 3
  if (counts.monthly > 0) return 2
  if (counts.weekly > 0) return 1
  return 0
}

