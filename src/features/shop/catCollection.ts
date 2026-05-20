const CATS_KEY = 'mentell.shop.cats'

export type CollectedCat = {
  id: string
  url: string
  collectedAt: number
}

function readRaw(): CollectedCat[] {
  try {
    const raw = localStorage.getItem(CATS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (row): row is CollectedCat =>
        row &&
        typeof row === 'object' &&
        typeof (row as CollectedCat).id === 'string' &&
        typeof (row as CollectedCat).url === 'string' &&
        typeof (row as CollectedCat).collectedAt === 'number',
    )
  } catch {
    return []
  }
}

function writeRaw(cats: CollectedCat[]) {
  localStorage.setItem(CATS_KEY, JSON.stringify(cats))
}

export function loadCatCollection(): CollectedCat[] {
  return readRaw().sort((a, b) => b.collectedAt - a.collectedAt)
}

export function getCatCount() {
  return readRaw().length
}

export function catIdFromUrl(url: string) {
  let hash = 0
  for (let i = 0; i < url.length; i++) {
    hash = (hash * 31 + url.charCodeAt(i)) | 0
  }
  return `url-${Math.abs(hash)}`
}

export function addCollectedCat(input: { id?: string | null; url: string }) {
  const id = input.id?.trim() || catIdFromUrl(input.url)
  const url = input.url.trim()
  if (!url) return loadCatCollection()

  const existing = readRaw()
  if (existing.some((c) => c.id === id)) {
    return loadCatCollection()
  }

  const next: CollectedCat = { id, url, collectedAt: Date.now() }
  writeRaw([...existing, next])
  return loadCatCollection()
}

export function clearCatCollection() {
  localStorage.removeItem(CATS_KEY)
}
