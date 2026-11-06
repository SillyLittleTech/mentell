#!/usr/bin/env node
/**
 * Build a Tauri v2 static updater manifest (latest.json) from CI artifact folders.
 * Expects mentell-macos / mentell-linux / mentell-windows artifact trees under --artifacts.
 */
import fs from 'node:fs'
import path from 'node:path'

const PLATFORM_KEYS = {
  'mentell-macos': 'darwin-aarch64',
  'mentell-linux': 'linux-x86_64',
  'mentell-windows': 'windows-x86_64'
}

function parseArgs (argv) {
  const out = {
    artifacts: './artifacts',
    version: '',
    tag: '',
    repo: 'SillyLittleTech/mentell'
  }
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--artifacts') out.artifacts = argv[++i]
    else if (arg === '--version') out.version = argv[++i]
    else if (arg === '--tag') out.tag = argv[++i]
    else if (arg === '--repo') out.repo = argv[++i]
    else if (arg === '--help' || arg === '-h') {
      console.log(
        'Usage: node scripts/build-tauri-latest-json.mjs --version 1.2.3 --tag v1.2.3-123 [--artifacts ./artifacts]'
      )
      process.exit(0)
    }
  }
  if (!out.version || !out.tag) {
    console.error('Missing required --version and --tag')
    process.exit(1)
  }
  return out
}

function walkFiles (dir, acc = []) {
  if (!fs.existsSync(dir)) return acc
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walkFiles(full, acc)
    else acc.push(full)
  }
  return acc
}

function pickUpdaterBundle (files, artifactName) {
  const sigs = files.filter((f) => f.endsWith('.sig'))
  if (sigs.length === 0) return null

  if (artifactName === 'mentell-windows') {
    const nsisSig = sigs.find(
      (f) => f.includes(`${path.sep}nsis${path.sep}`) && f.endsWith('.exe.sig')
    )
    if (nsisSig) {
      return { sigPath: nsisSig, bundlePath: nsisSig.slice(0, -4) }
    }
  }

  if (artifactName === 'mentell-macos') {
    const tarSig = sigs.find((f) => f.endsWith('.app.tar.gz.sig'))
    if (tarSig) {
      return { sigPath: tarSig, bundlePath: tarSig.slice(0, -4) }
    }
  }

  if (artifactName === 'mentell-linux') {
    const appSig = sigs.find((f) => f.endsWith('.AppImage.sig'))
    if (appSig) {
      return { sigPath: appSig, bundlePath: appSig.slice(0, -4) }
    }
  }

  const sigPath = sigs[0]
  return { sigPath, bundlePath: sigPath.slice(0, -4) }
}

const { artifacts, version, tag, repo } = parseArgs(process.argv)
const baseUrl = `https://github.com/${repo}/releases/download/${tag}`

const manifest = {
  version,
  notes: `Mentell ${version}`,
  pub_date: new Date().toISOString(),
  platforms: {}
}

for (const [folder, platformKey] of Object.entries(PLATFORM_KEYS)) {
  const root = path.join(artifacts, folder)
  const files = walkFiles(root)
  const picked = pickUpdaterBundle(files, folder)
  if (!picked) {
    console.warn(
      `No updater signature found under ${root}; skipping ${platformKey}`
    )
    continue
  }
  if (!fs.existsSync(picked.bundlePath)) {
    console.warn(`Bundle missing for ${picked.sigPath}`)
    continue
  }
  const filename = path.basename(picked.bundlePath)
  manifest.platforms[platformKey] = {
    url: `${baseUrl}/${filename}`,
    signature: fs.readFileSync(picked.sigPath, 'utf8').trim()
  }
}

if (Object.keys(manifest.platforms).length === 0) {
  console.error('No platform entries generated; refusing to write latest.json')
  process.exit(1)
}

const outPath = path.join(artifacts, 'latest.json')
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(
  `Wrote ${outPath} with platforms: ${Object.keys(manifest.platforms).join(', ')}`
)
