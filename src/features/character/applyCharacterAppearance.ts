import { applyBlinkOpenState } from './characterBlink'
import { charManifest } from './charManifest'
import type { CharacterAppearance } from './characterAppearance'
import type { CharacterAccessoryItem } from '../shop/shopCatalog'

const SVG_NS = 'http://www.w3.org/2000/svg'
const SVG_INSTANCE_ATTR = 'data-mentell-appearance-instance'

let nextSvgInstanceId = 0

const EYE_TOGGLE_GRADIENT_FILL: Record<string, string> = {
  g104: '#c8c9cd',
  g105: '#986334',
  g107: '#4599ba',
}

function setToggleOptionVisible(el: SVGElement, show: boolean) {
  el.style.display = show ? 'inline' : 'none'
}

function setElementVisible(el: SVGElement, show: boolean) {
  el.style.display = show ? 'inline' : 'none'
}

function bringToFront(el: SVGElement) {
  const svg = el.ownerSVGElement
  if (!svg || el.parentNode === svg) {
    el.parentNode?.appendChild(el)
    return
  }
  svg.appendChild(el)
}

function normalizeLookup(value: string) {
  return value
    .toLowerCase()
    .replace(/_(toggle|iii|dni).*$/i, '')
    .replace(/^toggle/, '')
    .replace(/[^a-z0-9]+/g, '')
}

function toggleGroupMatches(
  group: (typeof charManifest.toggleGroups)[number],
  groupKey: string,
) {
  const normalized = normalizeLookup(groupKey)
  return (
    group.key === groupKey ||
    group.parentId === groupKey ||
    normalizeLookup(group.label) === normalized ||
    normalizeLookup(group.key) === normalized
  )
}

function optionMatches(option: { id: string; label: string }, optionId: string) {
  const normalized = normalizeLookup(optionId)
  return option.id === optionId || normalizeLookup(option.label) === normalized
}

function resolveAccessoryToggle(toggle: { groupKey: string; optionId: string }) {
  const group = charManifest.toggleGroups.find((entry) =>
    toggleGroupMatches(entry, toggle.groupKey),
  )
  const option = group?.options.find((entry) => optionMatches(entry, toggle.optionId))
  if (!group || !option) return null
  return { groupKey: group.key, optionId: option.id }
}

function isAccessoryToggleGroup(group: (typeof charManifest.toggleGroups)[number]) {
  return ['layer2', 'layer3', 'layer4', 'layer5', 'layer6', 'layer7', 'layer8'].includes(
    group.parentId,
  )
}

function isBaseFillKey(key: string) {
  return key === 'path45' || key === 'path65' || key === 'hair_fill'
}

function accessoryToggleRows(accessory: CharacterAccessoryItem) {
  const rows = accessory.characterAccessory.toggles ?? []
  const legacy = accessory.characterAccessory.toggle
    ? [
        {
          groupKey: accessory.characterAccessory.toggle.groupKey,
          optionIds: [accessory.characterAccessory.toggle.optionId],
        },
      ]
    : []
  return [...rows, ...legacy]
}

function setPartVisibleByKey(svg: SVGSVGElement, key: string, show: boolean) {
  const byId = svg.getElementById(key)
  if (byId instanceof SVGElement) {
    setElementVisible(byId, show)
    return
  }
  const normalized = normalizeLookup(key)
  svg.querySelectorAll<SVGElement>('*').forEach((el) => {
    const label = el.getAttribute('inkscape:label') ?? ''
    if (normalizeLookup(label) === normalized) setElementVisible(el, show)
  })
}

function setPetFaceVisible(svg: SVGSVGElement, show: boolean) {
  for (const key of ['facebase_DNI', 'FACETOGGLE']) {
    const normalized = normalizeLookup(key)
    svg.querySelectorAll<SVGElement>('*').forEach((el) => {
      const label = el.getAttribute('inkscape:label') ?? ''
      if (normalizeLookup(label) !== normalized) return
      setElementVisible(el, show)
      if (show) bringToFront(el)
    })
  }
}

function hidePartByKey(svg: SVGSVGElement, key: string) {
  setPartVisibleByKey(svg, key, false)
}

function parseHexColor(color: string): [number, number, number] | null {
  const hex = color.trim().replace(/^#/, '')
  if (hex.length === 3) {
    return hex.split('').map((part) => parseInt(part + part, 16)) as [number, number, number]
  }
  if (hex.length === 6 || hex.length === 8) {
    return [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [
      number,
      number,
      number,
    ]
  }
  return null
}

function darkenColor(color: string, amount = 0.42) {
  const rgb = parseHexColor(color)
  if (!rgb) return color
  const [r, g, b] = rgb.map((channel) => Math.max(0, Math.round(channel * (1 - amount))))
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function hasVisibleStroke(el: SVGElement) {
  const stroke = el.style.stroke || el.getAttribute('stroke') || ''
  if (!stroke || stroke === 'none') return false
  return true
}

function applyHairFill(el: SVGElement, color: string) {
  el.style.fill = color
  if (hasVisibleStroke(el)) {
    el.style.stroke = darkenColor(color)
    el.style.strokeOpacity = '1'
  }
}

function ensureDefs(svg: SVGSVGElement) {
  const existing = svg.querySelector('defs')
  if (existing instanceof SVGDefsElement) return existing
  const defs = document.createElementNS(SVG_NS, 'defs')
  svg.insertBefore(defs, svg.firstChild)
  return defs
}

function setStop(stop: SVGStopElement, color: string, opacity: string, offset: string) {
  stop.setAttribute('offset', offset)
  stop.style.stopColor = color
  stop.style.stopOpacity = opacity
}

function ensureEyeGradient(svg: SVGSVGElement, id: string, color: string) {
  const existing = svg.getElementById(id)
  if (existing instanceof SVGLinearGradientElement) return existing

  const gradient = document.createElementNS(SVG_NS, 'linearGradient')
  gradient.id = id
  gradient.setAttribute('x1', '0')
  gradient.setAttribute('y1', '0')
  gradient.setAttribute('x2', '0')
  gradient.setAttribute('y2', '1')

  const shadow = document.createElementNS(SVG_NS, 'stop')
  setStop(shadow, '#000000', '1', '0')
  gradient.appendChild(shadow)

  const iris = document.createElementNS(SVG_NS, 'stop')
  setStop(iris, color, '1', '0.72')
  gradient.appendChild(iris)

  ensureDefs(svg).appendChild(gradient)
  return gradient
}

function svgInstanceId(svg: SVGSVGElement) {
  const existing = svg.getAttribute(SVG_INSTANCE_ATTR)
  if (existing) return existing
  nextSvgInstanceId += 1
  const id = String(nextSvgInstanceId)
  svg.setAttribute(SVG_INSTANCE_ATTR, id)
  return id
}

function applyEyeGradient(svg: SVGSVGElement, activeToggle: SVGGElement, active: string) {
  const color = EYE_TOGGLE_GRADIENT_FILL[active]
  if (!color) return

  const instanceId = svgInstanceId(svg)
  activeToggle.querySelectorAll<SVGElement>('path').forEach((path, index) => {
    const gradientId = `mentell-eye-${instanceId}-${active}-${index}`
    ensureEyeGradient(svg, gradientId, color)
    path.style.fill = `url(#${gradientId})`
    path.style.opacity = '1'
  })
}

export function applyCharacterAppearance(
  svg: SVGSVGElement,
  appearance: CharacterAppearance,
  accessories: CharacterAccessoryItem[] = [],
) {
  const activeAccessoryFillKeys = new Set(
    accessories.flatMap((accessory) => accessory.characterAccessory.fillKeys ?? []),
  )

  for (const fillable of charManifest.fillables) {
    if (!isBaseFillKey(fillable.key) && !activeAccessoryFillKeys.has(fillable.key)) {
      continue
    }
    const color = appearance.fills[fillable.key] ?? fillable.defaultFill
    const targetIds =
      'targetIds' in fillable && fillable.targetIds
        ? [...fillable.targetIds]
        : [fillable.id]
    for (const id of targetIds) {
      const el = svg.getElementById(id)
      if (!(el instanceof SVGElement)) continue
      if (fillable.key === 'hair_fill') {
        applyHairFill(el, color)
        continue
      }
      el.style.fill = color
    }
  }

  for (const group of charManifest.globalFillGroups) {
    const color = appearance.fills[group.key] ?? group.defaultFill
    for (const id of group.targetIds) {
      const el = svg.getElementById(id)
      if (!(el instanceof SVGElement)) continue
      el.style.fill = color
    }
  }

  const accessoryToggles = new Map<string, Set<string>>()
  const accessoryPartKeys = new Set<string>()
  for (const accessory of accessories) {
    for (const row of accessoryToggleRows(accessory)) {
      for (const optionId of row.optionIds) {
        const resolved = resolveAccessoryToggle({ groupKey: row.groupKey, optionId })
        if (!resolved) continue
        const active = accessoryToggles.get(resolved.groupKey) ?? new Set<string>()
        active.add(resolved.optionId)
        accessoryToggles.set(resolved.groupKey, active)
      }
    }
    for (const part of accessory.characterAccessory.parts ?? []) {
      accessoryPartKeys.add(part)
    }
  }
  let activeSkinHidingAccessory = false

  for (const group of charManifest.toggleGroups) {
    const activeAccessoryOptions = accessoryToggles.get(group.key)
    const active = activeAccessoryOptions
      ? [...activeAccessoryOptions][0]
      : isAccessoryToggleGroup(group)
        ? null
        : appearance.toggles[group.key] ?? group.defaultOption

    if (group.key === 'blush' && 'elementId' in group) {
      const blush = svg.getElementById(group.elementId)
      if (blush instanceof SVGElement) {
        blush.style.display = active === 'on' ? 'inline' : 'none'
        blush.style.opacity = active === 'on' ? '1' : '0'
        blush.style.visibility = active === 'on' ? 'visible' : 'hidden'
      }
      continue
    }

    for (const opt of group.options) {
      const el = svg.getElementById(opt.id)
      if (!(el instanceof SVGElement)) continue
      const show = activeAccessoryOptions ? activeAccessoryOptions.has(opt.id) : opt.id === active
      setToggleOptionVisible(
        el,
        show,
      )
      if (show && activeAccessoryOptions && group.key !== 'layer2') bringToFront(el)
    }

    if (group.key === 'layer18') {
      if (!active) continue
      const activeToggle = svg.getElementById(active)
      if (activeToggle instanceof SVGGElement) {
        activeToggle.style.opacity = '1'
        applyEyeGradient(svg, activeToggle, active)
      }
    }
  }

  setPetFaceVisible(svg, accessoryToggles.has('layer2'))

  const knownAccessoryParts = [
    'GHOST',
    'GHOST_armL_joint',
    'GHOST_armR_joint',
    'SKELETON',
    'SKELETON_armL_joint',
    'SKELETON_armR_joint',
    'Lemmon',
  ]
  for (const part of knownAccessoryParts) {
    if (!accessoryPartKeys.has(part)) hidePartByKey(svg, part)
  }

  for (const accessory of accessories) {
    for (const part of accessory.characterAccessory.parts ?? []) {
      setPartVisibleByKey(svg, part, true)
      const el = svg.getElementById(part)
      if (el instanceof SVGElement) bringToFront(el)
    }
    if (accessory.characterAccessory.hideSkin) {
      activeSkinHidingAccessory = true
    }
    if (accessory.characterAccessory.hideBaseClothes) {
      for (const part of ['layer15', 'layer19', 'path65', 'shoesDNI']) {
        setPartVisibleByKey(svg, part, false)
      }
    }
  }

  if (activeSkinHidingAccessory) {
    const skin = charManifest.fillables.find((fillable) => fillable.key === 'path45')
    const targetIds =
      skin && 'targetIds' in skin && skin.targetIds ? [...skin.targetIds] : skin ? [skin.id] : []
    for (const id of targetIds) {
      const el = svg.getElementById(id)
      if (el instanceof SVGElement) setElementVisible(el, false)
    }
  }

  applyBlinkOpenState(svg)
}
