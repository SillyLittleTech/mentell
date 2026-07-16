export type EntrySnapshot = {
  id: string
  createdAt?: number
  updatedAt?: number
  dateKey: string
  sentiment: string
  emotion?: string
  emotionNote?: string
  situation: string
  details: string
  behavioursNoted?: string
  reoccurringTheme?: string
  flaggedTerms?: string[]
  warningLevel?: string
  riskScore?: number
  interventionScore?: number
  riskLevel?: string
  scoreDelta?: number
  streakAtSubmit?: number
}

function rowUpdatedAt(row: { updatedAt?: number; createdAt?: number }) {
  return row.updatedAt ?? row.createdAt ?? 0
}

/** Prefer the copy with the greater updatedAt; otherwise prefer local. */
export function pickNewerEntry(
  local: EntrySnapshot | undefined,
  remote: EntrySnapshot | undefined,
): EntrySnapshot | undefined {
  if (!local) return remote
  if (!remote) return local
  return rowUpdatedAt(remote) > rowUpdatedAt(local) ? remote : local
}
