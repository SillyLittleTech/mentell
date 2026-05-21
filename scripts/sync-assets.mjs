import { copyFile, mkdir, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'asset')
const destDir = path.join(root, 'public', 'asset')
const MENTELL_ICON_SRC = 'mentellicon-Default-1024x1024@1x.png'
const MENTELL_ICON_DEST = 'mentell-icon.png'

async function main() {
  let entries
  try {
    entries = await readdir(srcDir)
  } catch {
    console.error(`Missing source folder: ${srcDir}`)
    process.exit(1)
  }

  await mkdir(destDir, { recursive: true })

  const pngs = entries.filter((f) => f.toLowerCase().endsWith('.png'))
  let copied = 0

  for (const file of pngs) {
    await copyFile(path.join(srcDir, file), path.join(destDir, file))
    copied++
  }

  const iconSrc = path.join(srcDir, MENTELL_ICON_SRC)
  try {
    await copyFile(iconSrc, path.join(destDir, MENTELL_ICON_DEST))
    console.log(`Copied ${MENTELL_ICON_SRC} → public/asset/${MENTELL_ICON_DEST}`)
  } catch {
    console.warn(`Warning: ${MENTELL_ICON_SRC} not found; skipping mentell-icon.png`)
  }

  console.log(`Synced ${copied} PNG(s) from asset/ → public/asset/`)
}

main()
