/** Resolve a public/ path for the current Vite base (e.g. /mentell/ on GitHub Pages). */
export function publicUrl(path: string) {
  const base = import.meta.env.BASE_URL
  const clean = path.startsWith('/') ? path.slice(1) : path
  return `${base}${clean}`
}
