/**
 * Parses asset/char/charprod.svg inkscape:label conventions into a TS manifest.
 * DNI = do not customize, III = fill color, TOGGLE = mutually exclusive siblings.
 * toggle*_III parents = global fill across all style variants.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = path.join(root, 'asset', 'char', 'charprod.svg')
const headshotPath = path.join(root, 'asset', 'char', 'headshot.svg')
const outPath = path.join(root, 'src', 'features', 'character', 'charManifest.generated.ts')

const ID_RE = /\bid="([^"]+)"/
const STYLE_RE = /style="([^"]*)"/

function classifyLabel(label) {
  const u = label.toUpperCase()
  if (u.endsWith('_DNI')) return 'dni'
  if (u.endsWith('_TOGGLE_III') || u.endsWith('_TOGGLE')) return 'toggle'
  if (label.toLowerCase().endsWith('_toggle')) return 'toggle'
  if (/toggle.*_III$/i.test(label)) return 'globalFill'
  if (u.endsWith('_III')) return 'iii'
  return null
}

function humanize(label) {
  return label
    .replace(/_(TOGGLE|Toggle|III|DNI).*$/i, '')
    .replace(/_/g, ' ')
    .replace(/\btoggle\b/gi, '')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase()) || label
}

function globalFillKey(label) {
  if (/shirt/i.test(label)) return 'shirt'
  if (/sleeve/i.test(label)) return 'sleeves'
  return humanize(label).toLowerCase().replace(/\s+/g, '_')
}

function parseFill(style) {
  if (!style) return null
  const m = style.match(/(?:^|;)\s*fill:(#[0-9a-fA-F]{3,8})/)
  if (m) return m[1]
  return null
}

function isVisibleOpening(tag) {
  const style = tag.match(STYLE_RE)?.[1] ?? ''
  if (!style.includes('display:')) return true
  return /display:\s*inline/.test(style)
}

function pathStartX(pathTag) {
  const d = pathTag.match(/\bd="([^"]*)"/)?.[1]
  if (!d) return null
  const m = d.match(/-?\d*\.?\d+/)
  return m ? Number.parseFloat(m[0]) : null
}

/** Direct-child toggle options only (one nesting level under parent). */
function directToggleChildren(parentInner) {
  const children = []
  let depth = 0
  for (let i = 0; i < parentInner.length; i++) {
    if (parentInner.startsWith('<g', i)) {
      if (depth === 0) {
        const slice = parentInner.slice(i)
        const label = slice.match(/inkscape:label="([^"]+)"/)?.[1]
        const id = slice.match(/\bid="([^"]+)"/)?.[1]
        const tagEnd = slice.indexOf('>')
        const tag = slice.slice(0, tagEnd + 1)
        if (label && id && classifyLabel(label) === 'toggle') {
          children.push({ id, label, visible: isVisibleOpening(tag) })
        }
      }
      depth++
      i = parentInner.indexOf('>', i)
      continue
    }
    if (parentInner.startsWith('</g>', i)) {
      depth = Math.max(0, depth - 1)
      i += 3
      continue
    }
    if (depth === 0 && parentInner.startsWith('<path', i)) {
      const slice = parentInner.slice(i)
      const label = slice.match(/inkscape:label="([^"]+)"/)?.[1]
      const id = slice.match(/\bid="([^"]+)"/)?.[1]
      const tagEnd = slice.indexOf('>')
      const tag = slice.slice(0, tagEnd + 1)
      if (label && id && classifyLabel(label) === 'toggle') {
        children.push({ id, label, visible: isVisibleOpening(tag) })
      }
    }
  }
  return children
}

function extractBalancedGroup(xml, startIndex) {
  const open = xml.indexOf('>', startIndex)
  if (open === -1) return null
  let depth = 1
  let i = open + 1
  while (i < xml.length && depth > 0) {
    const nextOpen = xml.indexOf('<g', i)
    const nextClose = xml.indexOf('</g>', i)
    if (nextClose === -1) break
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth++
      i = nextOpen + 2
    } else {
      depth--
      i = nextClose + 4
    }
  }
  return xml.slice(startIndex, i)
}

function collectSolidFillPathIds(block) {
  const ids = []
  const tagRe = /<(path|ellipse)\b[^>]*>/g
  let m
  while ((m = tagRe.exec(block)) !== null) {
    const tag = m[0]
    const id = tag.match(ID_RE)?.[1]
    const style = tag.match(STYLE_RE)?.[1]
    if (id && parseFill(style)) ids.push(id)
  }
  return [...new Set(ids)]
}

function collectSleeveIdsBySide(xml, sleeveParentId) {
  const parentMatch = new RegExp(
    `<g\\b[^>]*id="${sleeveParentId}"[^>]*inkscape:label="[^"]*"[^>]*>`,
    'i',
  ).exec(xml)
  if (!parentMatch) return { left: [], right: [] }

  const block = extractBalancedGroup(xml, parentMatch.index)
  if (!block) return { left: [], right: [] }

  const midX = -485
  const left = []
  const right = []
  const pathRe = /<path\b[^>]*>/g
  let pm
  while ((pm = pathRe.exec(block)) !== null) {
    const tag = pm[0]
    const id = tag.match(ID_RE)?.[1]
    if (!id) continue
    const x = pathStartX(tag)
    if (x == null) continue
    if (x < midX) left.push(id)
    else right.push(id)
  }
  return { left, right }
}

/** armL / armR paths (gradient fills) tinted with skin. */
function collectArmSkinPathIds(xml) {
  const ids = []
  const re = /<path\b[^>]*inkscape:label="arm[LR]"[^>]*>/gi
  let m
  while ((m = re.exec(xml)) !== null) {
    const id = m[0].match(ID_RE)?.[1]
    if (id) ids.push(id)
  }
  return [...new Set(ids)]
}

/** All path/ellipse under togglehair (layer16) with a solid hex fill. */
function collectHairFillIds(xml) {
  const parentMatch = /<g\b[^>]*id="layer16"[^>]*inkscape:label="[^"]*"[^>]*>/i.exec(xml)
  if (!parentMatch) return []

  const block = extractBalancedGroup(xml, parentMatch.index)
  if (!block) return []

  const ids = []
  const tagRe = /<(path|ellipse)\b[^>]*>/g
  let m
  while ((m = tagRe.exec(block)) !== null) {
    const tag = m[0]
    const id = tag.match(ID_RE)?.[1]
    const style = tag.match(STYLE_RE)?.[1] ?? ''
    const fill = parseFill(style)
    if (!id || !fill || fill.toLowerCase() === '#ffffff') continue
    ids.push(id)
  }
  return [...new Set(ids)]
}

/** Canonical look from headshot.svg (toggles + solid fills). */
function extractAppearanceFromSvg(xml) {
  const fills = {}
  const toggles = {}

  const tagRe = /<(path|g)\b[^>]*inkscape:label="([^"]+)"[^>]*>/g
  let tm
  while ((tm = tagRe.exec(xml)) !== null) {
    const label = tm[2]
    if (classifyLabel(label) !== 'iii') continue
    if (label.toUpperCase().includes('TOGGLE')) continue
    const tag = tm[0]
    const id = tag.match(ID_RE)?.[1]
    if (!id) continue
    const color = parseFill(tag.match(STYLE_RE)?.[1])
    if (color) fills[id] = color
  }

  const hairFillIds = collectHairFillIds(xml)
  if (hairFillIds.length) {
    const block =
      extractBalancedGroup(xml, xml.search(/<g\b[^>]*id="layer16"/i)) ?? ''
    const hairColor = hairFillIds
      .map((id) => {
        const m = block.match(
          new RegExp(`<(?:path|ellipse)\\b[^>]*id="${id}"[^>]*style="([^"]*)"`, 'i'),
        )
        const fill = m ? parseFill(m[1]) : null
        return fill && fill.toLowerCase() !== '#ffffff' ? fill : null
      })
      .find(Boolean)
    if (hairColor) fills.hair_fill = hairColor
  }

  const parentRe = /<g\b[^>]*inkscape:label="([^"]*)"[^>]*>/gi
  while ((tm = parentRe.exec(xml)) !== null) {
    const parentLabel = tm[1]
    if (!/toggle/i.test(parentLabel)) continue
    if (!/inkscape:groupmode="layer"/.test(tm[0])) continue

    const parentId = tm[0].match(ID_RE)?.[1] ?? parentLabel
    const block = extractBalancedGroup(xml, tm.index)
    if (!block) continue
    const inner = block.slice(block.indexOf('>') + 1, block.lastIndexOf('</g>'))

    if (classifyLabel(parentLabel) === 'globalFill') {
      const key = globalFillKey(parentLabel)
      const targetIds = collectSolidFillPathIds(block)
      const color = targetIds
        .map((id) => {
          const m = block.match(
            new RegExp(`<(?:path|ellipse)\\b[^>]*id="${id}"[^>]*style="([^"]*)"`, 'i'),
          )
          return m ? parseFill(m[1]) : null
        })
        .find(Boolean)
      if (color) fills[key] = color
    }

    const children = directToggleChildren(inner)
    if (children.length < 2) continue
    toggles[parentId] = children.find((c) => c.visible)?.id ?? children[0].id
  }

  const blushMatch = xml.match(
    /<g\b[^>]*id="(g102)"[^>]*inkscape:label="blush_TOGGLE"[^>]*style="([^"]*)"/,
  )
  if (blushMatch) {
    toggles.blush = isVisibleOpening(blushMatch[0]) ? 'on' : 'off'
  }

  return { fills, toggles }
}

/** Open-eye layers (*_BLK) vs closed-eye overlay (label exactly BLK). */
function collectBlinkLayers(xml) {
  const openLayerIds = []
  let closedLayerId = null
  const re = /<g\b[^>]*inkscape:label="([^"]*)"[^>]*>/gi
  let m
  while ((m = re.exec(xml)) !== null) {
    const label = m[1]
    const id = m[0].match(ID_RE)?.[1]
    if (!id) continue
    if (label === 'BLK') closedLayerId = id
    else if (label.endsWith('_BLK')) openLayerIds.push(id)
  }
  if (!openLayerIds.length || !closedLayerId) return null
  return {
    openLayerIds,
    closedLayerId,
    closedDurationMs: 120,
    minIntervalMs: 2000,
    maxIntervalMs: 4500,
  }
}

function applyHeadshotDefaults(structure, headshotDefaults) {
  for (const f of structure.fillables) {
    const fromHeadshot = headshotDefaults.fills[f.key]
    if (fromHeadshot) f.defaultFill = fromHeadshot
  }
  for (const g of structure.globalFillGroups) {
    const fromHeadshot = headshotDefaults.fills[g.key]
    if (fromHeadshot) g.defaultFill = fromHeadshot
  }
  for (const group of structure.toggleGroups) {
    const fromHeadshot = headshotDefaults.toggles[group.key]
    if (fromHeadshot) group.defaultOption = fromHeadshot
  }

  const appearanceDefaults = {
    fills: Object.fromEntries(
      structure.fillables.map((f) => [f.key, f.defaultFill]).concat(
        structure.globalFillGroups.map((g) => [g.key, g.defaultFill]),
      ),
    ),
    toggles: Object.fromEntries(
      structure.toggleGroups.map((g) => [g.key, g.defaultOption]),
    ),
  }

  return appearanceDefaults
}

async function main() {
  const xml = await readFile(svgPath, 'utf8')
  const headshotXml = await readFile(headshotPath, 'utf8')

  const fillables = []
  const globalFillGroups = []
  const toggleGroups = []
  const globalFillParentIds = new Set()

  const viewBoxMatch = xml.match(/viewBox="([^"]+)"/)
  const viewBox = viewBoxMatch?.[1] ?? '0 0 296 374'

  const arms = {
    armL: { jointId: 'armL_joint', pivotX: 0, pivotY: 0, sleeveIds: [] },
    armR: { jointId: 'armR_joint', pivotX: 0, pivotY: 0, sleeveIds: [] },
  }

  const sleeveSides = collectSleeveIdsBySide(xml, 'layer19')
  arms.armL.sleeveIds = sleeveSides.left
  arms.armR.sleeveIds = sleeveSides.right

  const tagRe = /<(path|g)\b[^>]*inkscape:label="([^"]+)"[^>]*>/g
  let tm
  while ((tm = tagRe.exec(xml)) !== null) {
    const label = tm[2]
    if (classifyLabel(label) !== 'iii') continue
    if (label.toUpperCase().includes('TOGGLE')) continue
    const tag = tm[0]
    const id = tag.match(ID_RE)?.[1]
    if (!id) continue
    const style = tag.match(STYLE_RE)?.[1]
    fillables.push({
      id,
      key: id,
      label: humanize(label),
      defaultFill: parseFill(style) ?? '#ddae67',
    })
  }

  const armSkinIds = collectArmSkinPathIds(xml)
  const skinFillable = fillables.find((f) => f.id === 'path45')
  if (skinFillable && armSkinIds.length) {
    skinFillable.targetIds = [skinFillable.id, ...armSkinIds]
  }

  const hairFillIds = collectHairFillIds(xml)
  if (hairFillIds.length) {
    const block = extractBalancedGroup(
      xml,
      xml.search(/<g\b[^>]*id="layer16"/i),
    ) ?? ''
    const defaultFill =
      hairFillIds
        .map((id) => {
          const m = block.match(
            new RegExp(`<(?:path|ellipse)\\b[^>]*id="${id}"[^>]*style="([^"]*)"`, 'i'),
          )
          const fill = m ? parseFill(m[1]) : null
          return fill && fill.toLowerCase() !== '#ffffff' ? fill : null
        })
        .find(Boolean) ?? '#311e00'

    fillables.push({
      id: 'hair_fill',
      key: 'hair_fill',
      label: 'Hair',
      defaultFill,
      targetIds: hairFillIds,
    })
  }

  const parentRe = /<g\b[^>]*inkscape:label="([^"]*)"[^>]*>/gi
  while ((tm = parentRe.exec(xml)) !== null) {
    const parentLabel = tm[1]
    if (!/toggle/i.test(parentLabel)) continue
    if (!/inkscape:groupmode="layer"/.test(tm[0])) continue

    const parentId = tm[0].match(ID_RE)?.[1] ?? parentLabel
    const block = extractBalancedGroup(xml, tm.index)
    if (!block) continue
    const inner = block.slice(block.indexOf('>') + 1, block.lastIndexOf('</g>'))

    if (classifyLabel(parentLabel) === 'globalFill') {
      globalFillParentIds.add(parentId)
      const targetIds = collectSolidFillPathIds(block)
      const defaultFill =
        targetIds
          .map((id) => {
            const m = block.match(
              new RegExp(`<(?:path|ellipse)\\b[^>]*id="${id}"[^>]*style="([^"]*)"`, 'i'),
            )
            return m ? parseFill(m[1]) : null
          })
          .find(Boolean) ?? '#261b4f'

      globalFillGroups.push({
        key: globalFillKey(parentLabel),
        label: humanize(parentLabel.replace(/_III$/i, '')),
        parentId,
        defaultFill,
        targetIds,
      })
    }

    const children = directToggleChildren(inner)
    if (children.length < 2) continue
    const defaultOption = children.find((c) => c.visible)?.id ?? children[0].id
    toggleGroups.push({
      key: parentId,
      label: humanize(parentLabel.replace(/_III$/i, '')),
      parentId,
      defaultOption,
      options: children.map((c) => ({
        id: c.id,
        label: humanize(c.label),
      })),
    })
  }

  const blushMatch = xml.match(
    /<g\b[^>]*id="(g102)"[^>]*inkscape:label="blush_TOGGLE"[^>]*style="([^"]*)"/,
  )
  if (blushMatch) {
    toggleGroups.push({
      key: 'blush',
      label: 'Blush',
      parentId: 'g102',
      defaultOption: isVisibleOpening(blushMatch[0]) ? 'on' : 'off',
      options: [
        { id: 'on', label: 'On' },
        { id: 'off', label: 'Off' },
      ],
      elementId: blushMatch[1],
    })
  }

  const headshotViewBoxMatch = headshotXml.match(/viewBox="([^"]+)"/)
  const headshotViewBox = headshotViewBoxMatch?.[1] ?? '0 0 100 100'

  const headshotDefaults = extractAppearanceFromSvg(headshotXml)
  const appearanceDefaults = applyHeadshotDefaults(
    { fillables, globalFillGroups, toggleGroups },
    headshotDefaults,
  )

  const blink = collectBlinkLayers(xml)

  const manifest = {
    viewBox,
    arms,
    fillables,
    globalFillGroups,
    toggleGroups,
    appearanceDefaults,
    ...(blink ? { blink } : {}),
    headshotViewBox,
    assets: {
      character: 'char/charprod.svg',
      headshot: 'char/headshot.svg',
    },
  }

  await mkdir(path.dirname(outPath), { recursive: true })
  const ts = `// Generated by scripts/generate-char-manifest.mjs — do not edit by hand.
export const charManifest = ${JSON.stringify(manifest, null, 2)} as const

export type CharManifest = typeof charManifest
export type CharacterPoseId =
  | 'idle'
  | 'present'
  | 'think'
  | 'write'
  | 'shop'
  | 'wave'
`
  await writeFile(outPath, ts)
  console.log(
    `Wrote char manifest (${fillables.length} fills, ${globalFillGroups.length} global, ${toggleGroups.length} toggles) → ${path.relative(root, outPath)}`,
  )
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
