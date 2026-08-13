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

const EYE_COLOR_BY_LABEL: Record<string, string> = {
  default: '#c8c9cd',
  brown: '#986334',
  blue: '#4599ba',
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
    .replace(/[\s_]+(toggle|iii|dni|blk)\b.*$/i, '')
    .replace(/_(toggle|iii|dni|blk).*$/i, '')
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

function resolveToggleOption(
  group: (typeof charManifest.toggleGroups)[number],
  stored: string | null | undefined,
) {
  if (stored) {
    const exact = group.options.find((option) => option.id === stored)
    if (exact) return exact
    const byLabel = group.options.find((option) => optionMatches(option, stored))
    if (byLabel) return byLabel
    const prefixHits = group.options.filter((option) => stored.startsWith(`${option.id}-`))
    if (prefixHits.length) {
      return prefixHits.reduce((best, option) =>
        option.id.length >= best.id.length ? option : best,
      )
    }
  }
  return group.options.find((option) => option.id === group.defaultOption) ?? group.options[0]
}

function forEachInkscapeLabel(
  root: ParentNode,
  fn: (el: SVGElement, label: string) => void,
) {
  root.querySelectorAll('g, path, ellipse, circle, rect, use').forEach((node) => {
    if (!(node instanceof SVGElement)) return
    const label = node.getAttribute('inkscape:label')
    if (label) fn(node, label)
  })
}

function findGroupRoot(
  svg: SVGSVGElement,
  group: (typeof charManifest.toggleGroups)[number],
): SVGElement | null {
  const byId = svg.getElementById(group.parentId)
  if (byId instanceof SVGElement) return byId
  // Headshot remaps the iris group id (layer18 → layer18-7) but keeps the label.
  if (group.key !== 'layer18') return null
  const normalized = normalizeLookup(group.label)
  let match: SVGElement | null = null
  forEachInkscapeLabel(svg, (el, label) => {
    if (!match && el.tagName.toLowerCase() === 'g' && normalizeLookup(label) === normalized) {
      match = el
    }
  })
  return match
}

function findOptionEl(
  svg: SVGSVGElement,
  option: { id: string; label: string },
  groupRoot: SVGElement | null,
): SVGElement | null {
  const byId = svg.getElementById(option.id)
  if (byId instanceof SVGElement) return byId
  if (!groupRoot) return null
  const normalized = normalizeLookup(option.label)
  let match: SVGElement | null = null
  forEachInkscapeLabel(groupRoot, (el, label) => {
    if (!match && normalizeLookup(label) === normalized) match = el
  })
  return match
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
  return 'isAccessory' in group && group.isAccessory === true
}

function optionCompanionIds(option: (typeof charManifest.toggleGroups)[number]['options'][number]) {
  return 'companionIds' in option && option.companionIds ? [...option.companionIds] : []
}

function groupFollowVisibilityIds(group: (typeof charManifest.toggleGroups)[number]) {
  return 'followVisibilityIds' in group && group.followVisibilityIds
    ? [...group.followVisibilityIds]
    : []
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
  forEachInkscapeLabel(svg, (el, label) => {
    if (normalizeLookup(label) === normalized) setElementVisible(el, show)
  })
}

function setPetFaceVisible(svg: SVGSVGElement, show: boolean) {
  forEachInkscapeLabel(svg, (el, label) => {
    if (label !== 'facebase_DNI' && label !== 'FACETOGGLE') return
    setElementVisible(el, show)
    if (show) bringToFront(el)
  })
}

function hidePartByKey(svg: SVGSVGElement, key: string) {
  setPartVisibleByKey(svg, key, false)
}

function parseHexColor(color: string): [number, number, number] | null {
  const value = color.trim()
  const hex = value.replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return hex.split('').map((part) => parseInt(part + part, 16)) as [number, number, number]
  }
  if (/^[0-9a-f]{6}$/i.test(hex) || /^[0-9a-f]{8}$/i.test(hex)) {
    return [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [
      number,
      number,
      number,
    ]
  }
  const rgb = value.match(
    /^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)(?:\s*[,/]\s*[\d.]+)?\s*\)$/i,
  )
  if (!rgb) return null
  return [1, 2, 3].map((index) =>
    Math.max(0, Math.min(255, Math.round(Number(rgb[index])))),
  ) as [number, number, number]
}

function darkenColor(color: string, amount = 0.42) {
  const rgb = parseHexColor(color)
  if (!rgb) return color
  const [r, g, b] = rgb.map((channel) => Math.max(0, Math.round(channel * (1 - amount))))
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function colorsEqual(a: string, b: string) {
  if (a.trim().toLowerCase() === b.trim().toLowerCase()) return true
  const left = parseHexColor(a)
  const right = parseHexColor(b)
  return Boolean(left && right && left.every((channel, i) => channel === right[i]))
}

function luminance(rgb: [number, number, number]) {
  return (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) / 255
}

/** Keep highlights lighter and shadows darker than the chosen base colour. */
function retargetRelativeColor(authored: string, fromBase: string, toBase: string) {
  if (colorsEqual(toBase, fromBase)) return authored
  const orig = parseHexColor(authored)
  const from = parseHexColor(fromBase)
  const to = parseHexColor(toBase)
  if (!orig || !from || !to) return toBase
  const origL = luminance(orig)
  const fromL = luminance(from)
  if (origL > fromL + 0.03) {
    const t = Math.min(0.62, (origL - fromL) / Math.max(0.08, 1 - fromL))
    return mixHex(toBase, '#ffffff', t)
  }
  if (origL < fromL - 0.03) {
    const t = Math.min(0.88, (fromL - origL) / Math.max(0.08, fromL))
    return mixHex(toBase, '#000000', t)
  }
  return toBase
}

function fillTargetElements(svg: SVGSVGElement, ids: string[]): SVGElement[] {
  const found: SVGElement[] = []
  const foundIds = new Set<string>()
  const missing: string[] = []
  for (const id of ids) {
    const el = svg.getElementById(id)
    if (el instanceof SVGElement) {
      found.push(el)
      foundIds.add(el.id)
    } else {
      missing.push(id)
    }
  }
  if (!missing.length) return found

  // Headshot clones append suffixes (path85-7 → path85-7-8).
  const sorted = [...missing].sort((a, b) => b.length - a.length)
  svg.querySelectorAll('[id]').forEach((node) => {
    if (!(node instanceof SVGElement) || foundIds.has(node.id)) return
    if (!sorted.some((id) => node.id.startsWith(`${id}-`))) return
    found.push(node)
    foundIds.add(node.id)
  })
  return found
}

function hasVisibleStroke(el: SVGElement) {
  const stroke = el.style.stroke || el.getAttribute('stroke') || ''
  if (!stroke || stroke === 'none') return false
  return true
}

const XLINK_NS = 'http://www.w3.org/1999/xlink'
const ORIG_STOP_ATTR = 'data-mentell-stop-color'
const ORIG_FILL_ATTR = 'data-mentell-orig-fill'
const ORIG_STROKE_ATTR = 'data-mentell-orig-stroke'
const ORIG_LIGHTING_ATTR = 'data-mentell-lighting-color'

function rgbToHex(rgb: [number, number, number]) {
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function mixHex(a: string, b: string, t: number) {
  const left = parseHexColor(a)
  const right = parseHexColor(b)
  if (!left || !right) return a
  return rgbToHex(
    left.map((channel, i) => Math.round(channel + (right[i] - channel) * t)) as [
      number,
      number,
      number,
    ],
  )
}

function retargetColor(authored: string, fromBase: string, toBase: string) {
  const orig = parseHexColor(authored)
  const from = parseHexColor(fromBase)
  const to = parseHexColor(toBase)
  if (!orig || !from || !to) return authored
  const isBlush = orig[0] > orig[1] + 40 && orig[0] > orig[2] + 40
  if (isBlush) return mixHex(toBase, authored, 0.42)
  return rgbToHex(
    orig.map((channel, i) => {
      const ratio = from[i] === 0 ? 1 : channel / from[i]
      return Math.max(0, Math.min(255, Math.round(to[i] * ratio)))
    }) as [number, number, number],
  )
}

function cssDeclaredPaint(el: SVGElement, property: 'fill' | 'stroke') {
  const fromStyle = el
    .getAttribute('style')
    ?.match(new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i'))?.[1]
  return (fromStyle || el.getAttribute(property) || '').trim()
}

function cssFillValue(el: SVGElement) {
  // Prefer the authored style/attribute. CSSOM `.style.fill` serializes hex as rgb()
  // after a style round-trip, which used to skip retargeting on stroked hair fills.
  return (cssDeclaredPaint(el, 'fill') || el.style.fill || '').trim()
}

function fillUrlId(el: SVGElement) {
  const raw = el.getAttribute('data-mentell-fill-url') || cssFillValue(el)
  if (!raw.toLowerCase().startsWith('url(')) return null
  return raw.match(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/)?.[1] ?? null
}

function rememberFillUrl(el: SVGElement, paintId: string) {
  if (!el.getAttribute('data-mentell-fill-url')) {
    el.setAttribute('data-mentell-fill-url', `url(#${paintId})`)
  }
}

function reapplyFillUrl(el: SVGElement, paintId: string) {
  const value = `url(#${paintId})`
  el.style.fill = 'none'
  el.setAttribute('fill', 'none')
  el.style.fill = value
  el.setAttribute('fill', value)
  const style = el.getAttribute('style')
  if (style) {
    el.setAttribute(
      'style',
      style.replace(/(?:^|;)\s*fill\s*:[^;]*/gi, `;fill:${value}`).replace(/^;+|;+$/g, ''),
    )
  }
}

function svgTagName(el: Element | null | undefined) {
  return el?.tagName.toLowerCase() ?? ''
}

function isSvgGradient(
  el: Element | null | undefined,
): el is SVGLinearGradientElement | SVGRadialGradientElement {
  const tag = svgTagName(el)
  return tag === 'lineargradient' || tag === 'radialgradient'
}

function isSvgStop(el: Element | null | undefined): el is SVGStopElement {
  return svgTagName(el) === 'stop'
}

function materializePaintGradient(svg: SVGSVGElement, paintId: string) {
  const paint = svg.getElementById(paintId)
  if (!isSvgGradient(paint)) {
    return null
  }
  if (!paint.querySelector('stop')) {
    const source = resolveGradientWithStops(svg, paintId)
    if (source && source !== paint) {
      source.querySelectorAll('stop').forEach((stop) => {
        paint.appendChild(stop.cloneNode(true))
      })
    }
    paint.removeAttribute('href')
    paint.removeAttributeNS(XLINK_NS, 'href')
  }
  return paint.querySelector('stop') ? paint : null
}

function restoreGradientStops(gradient: SVGGradientElement) {
  gradient.querySelectorAll('stop').forEach((node) => {
    if (!isSvgStop(node)) return
    const orig = node.getAttribute(ORIG_STOP_ATTR)
    if (!orig) return
    node.setAttribute('stop-color', orig)
    const style = node.getAttribute('style')
    if (style) {
      node.setAttribute(
        'style',
        style.replace(/(?:^|;)\s*stop-color\s*:[^;]*/i, `;stop-color:${orig}`).replace(/^;/, ''),
      )
    }
  })
}

function setSolidFill(el: SVGElement, color: string) {
  el.setAttribute('fill', color)
  el.style.fill = color
  const style = el.getAttribute('style')
  if (style) {
    el.setAttribute(
      'style',
      style.replace(/(?:^|;)\s*fill\s*:[^;]*/gi, `;fill:${color}`).replace(/^;+|;+$/g, ''),
    )
  }
}

function rememberOrigFill(el: SVGElement) {
  if (el.getAttribute(ORIG_FILL_ATTR)) return
  const current = cssFillValue(el)
  if (!current) return
  const rgb = parseHexColor(current)
  el.setAttribute(ORIG_FILL_ATTR, rgb ? rgbToHex(rgb) : current)
}

function applyPaintFill(el: SVGElement, color: string, defaultBase: string) {
  const svg = el.ownerSVGElement
  const paintId = fillUrlId(el)
  if (svg && paintId) {
    rememberFillUrl(el, paintId)
    const gradient = materializePaintGradient(svg, paintId)
    if (gradient) {
      if (colorsEqual(color, defaultBase)) restoreGradientStops(gradient)
      else tintGradientStops(gradient, color, defaultBase)
      reapplyFillUrl(el, paintId)
      return
    }
  }
  rememberOrigFill(el)
  const authored = el.getAttribute(ORIG_FILL_ATTR) || color
  if (colorsEqual(color, defaultBase)) {
    setSolidFill(el, authored)
    return
  }
  setSolidFill(el, retargetRelativeColor(authored, defaultBase, color))
}

function gradientHrefId(gradient: SVGGradientElement) {
  const href =
    gradient.getAttribute('href') ?? gradient.getAttributeNS(XLINK_NS, 'href') ?? ''
  return href.startsWith('#') ? href.slice(1) : null
}

function resolveGradientWithStops(
  svg: SVGSVGElement,
  id: string,
  seen = new Set<string>(),
): SVGLinearGradientElement | SVGRadialGradientElement | null {
  if (seen.has(id)) return null
  seen.add(id)
  const el = svg.getElementById(id)
  if (!isSvgGradient(el)) {
    return null
  }
  if (el.querySelector('stop')) return el
  const hrefId = gradientHrefId(el)
  return hrefId ? resolveGradientWithStops(svg, hrefId, seen) : el
}

function stopColor(stop: SVGStopElement) {
  const raw = (
    stop.getAttribute('style')?.match(/(?:^|;)\s*stop-color\s*:\s*([^;]+)/i)?.[1]?.trim() ||
    stop.getAttribute('stop-color') ||
    stop.style.stopColor ||
    '#000000'
  )
  const rgb = parseHexColor(raw)
  return rgb ? rgbToHex(rgb) : raw
}

function tintGradientStops(gradient: SVGGradientElement, color: string, defaultBase: string) {
  gradient.querySelectorAll('stop').forEach((node) => {
    if (!isSvgStop(node)) return
    const authored = node.getAttribute(ORIG_STOP_ATTR) ?? stopColor(node)
    node.setAttribute(ORIG_STOP_ATTR, authored)
    const next = retargetColor(authored, defaultBase, color)
    node.setAttribute('stop-color', next)
    const style = node.getAttribute('style')
    if (style) {
      node.setAttribute(
        'style',
        style.replace(/(?:^|;)\s*stop-color\s*:[^;]*/i, `;stop-color:${next}`).replace(/^;/, ''),
      )
    }
  })
}

function cssFilterValue(el: SVGElement) {
  const fromStyle = el.getAttribute('style')?.match(/(?:^|;)\s*filter\s*:\s*([^;]+)/i)?.[1]
  return (el.style.filter || el.getAttribute('filter') || fromStyle || '').trim()
}

function filterUrlId(el: SVGElement) {
  return cssFilterValue(el).match(/url\(\s*['"]?#([^'")\s]+)['"]?\s*\)/)?.[1] ?? null
}

function tintFilterLighting(
  svg: SVGSVGElement | null,
  el: SVGElement,
  color: string,
  defaultBase: string,
) {
  if (!svg) return
  const id = filterUrlId(el)
  if (!id) return
  const filter = svg.getElementById(id)
  if (!(filter instanceof SVGFilterElement)) return
  filter.querySelectorAll('feDiffuseLighting').forEach((node) => {
    const orig = node.getAttribute(ORIG_LIGHTING_ATTR) ?? node.getAttribute('lighting-color') ?? ''
    if (!node.getAttribute(ORIG_LIGHTING_ATTR) && orig) {
      node.setAttribute(ORIG_LIGHTING_ATTR, orig)
    }
    if (colorsEqual(color, defaultBase)) {
      if (orig) node.setAttribute('lighting-color', orig)
      return
    }
    node.setAttribute('lighting-color', mixHex(color, '#ffffff', 0.32))
  })
}

function applySkinStroke(el: SVGElement, color: string, defaultBase: string) {
  const current = el.style.stroke || el.getAttribute('stroke') || ''
  if (!el.getAttribute(ORIG_STROKE_ATTR) && current && current !== 'none') {
    el.setAttribute(ORIG_STROKE_ATTR, current)
  }
  const orig = el.getAttribute(ORIG_STROKE_ATTR)
  if (!orig) return
  if (colorsEqual(color, defaultBase)) {
    el.style.stroke = orig
    el.setAttribute('stroke', orig)
    return
  }
  const stroke = darkenColor(color, 0.2)
  el.style.stroke = stroke
  el.setAttribute('stroke', stroke)
}

function applySkinFill(el: SVGElement, color: string, defaultBase: string) {
  rememberOrigFill(el)
  const authored = el.getAttribute(ORIG_FILL_ATTR) || cssFillValue(el)
  if (colorsEqual(color, defaultBase)) {
    if (authored) setSolidFill(el, authored)
  } else {
    setSolidFill(el, color)
  }
  tintFilterLighting(el.ownerSVGElement, el, color, defaultBase)
  applySkinStroke(el, color, defaultBase)
}

function isSkinMaskLabel(label: string) {
  return /skinmask/i.test(label)
}

function findSkinMaskElements(svg: SVGSVGElement) {
  const found: SVGElement[] = []
  forEachInkscapeLabel(svg, (el, label) => {
    if (isSkinMaskLabel(label)) found.push(el)
  })
  return found
}

function tintGradientStopsToColor(gradient: SVGGradientElement, color: string) {
  gradient.querySelectorAll('stop').forEach((node) => {
    if (!isSvgStop(node)) return
    const authored = node.getAttribute(ORIG_STOP_ATTR) ?? stopColor(node)
    node.setAttribute(ORIG_STOP_ATTR, authored)
    node.setAttribute('stop-color', color)
    const style = node.getAttribute('style')
    if (style) {
      node.setAttribute(
        'style',
        style.replace(/(?:^|;)\s*stop-color\s*:[^;]*/i, `;stop-color:${color}`).replace(/^;/, ''),
      )
    }
  })
}

/** Face ellipse that covers the authored red skin gradient; keep its fade, retint to skin. */
function applySkinMaskFill(el: SVGElement, color: string, defaultBase: string) {
  const svg = el.ownerSVGElement
  const paintId = fillUrlId(el)
  if (svg && paintId) {
    rememberFillUrl(el, paintId)
    const gradient = materializePaintGradient(svg, paintId)
    if (gradient) {
      if (colorsEqual(color, defaultBase)) restoreGradientStops(gradient)
      else tintGradientStopsToColor(gradient, color)
      reapplyFillUrl(el, paintId)
      return
    }
  }
  applySkinFill(el, color, defaultBase)
}

function applyHairFill(el: SVGElement, color: string, defaultBase: string) {
  applyPaintFill(el, color, defaultBase)
  const currentStroke = el.style.stroke || el.getAttribute('stroke') || ''
  if (!el.getAttribute(ORIG_STROKE_ATTR) && currentStroke && currentStroke !== 'none') {
    el.setAttribute(ORIG_STROKE_ATTR, currentStroke)
  }
  const origStroke = el.getAttribute(ORIG_STROKE_ATTR)
  if (!origStroke) return
  if (colorsEqual(color, defaultBase)) {
    el.style.stroke = origStroke
    el.setAttribute('stroke', origStroke)
    return
  }
  const stroke = darkenColor(color)
  el.style.stroke = stroke
  el.setAttribute('stroke', stroke)
  el.style.strokeOpacity = '1'
}

function svgCreate(svg: SVGSVGElement, tag: string) {
  return svg.ownerDocument.createElementNS(SVG_NS, tag)
}

function ensureDefs(svg: SVGSVGElement) {
  const existing = svg.querySelector('defs')
  if (existing instanceof SVGDefsElement) return existing
  const defs = svgCreate(svg, 'defs')
  svg.insertBefore(defs, svg.firstChild)
  return defs
}

function setStop(stop: SVGStopElement, color: string, opacity: string, offset: string) {
  stop.setAttribute('offset', offset)
  stop.setAttribute('stop-color', color)
  stop.setAttribute('stop-opacity', opacity)
}

function ensureEyeGradient(svg: SVGSVGElement, id: string, color: string) {
  const existing = svg.getElementById(id)
  if (existing instanceof SVGLinearGradientElement) return existing

  const gradient = svgCreate(svg, 'linearGradient') as SVGLinearGradientElement
  gradient.id = id
  gradient.setAttribute('x1', '0')
  gradient.setAttribute('y1', '0')
  gradient.setAttribute('x2', '0')
  gradient.setAttribute('y2', '1')

  const shadow = svgCreate(svg, 'stop') as SVGStopElement
  setStop(shadow, '#000000', '1', '0')
  gradient.appendChild(shadow)

  const iris = svgCreate(svg, 'stop') as SVGStopElement
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

function eyeGradientColor(activeId: string, label?: string) {
  const fromLabel = label ? EYE_COLOR_BY_LABEL[normalizeLookup(label)] : undefined
  return fromLabel ?? EYE_TOGGLE_GRADIENT_FILL[activeId]
}

function applyEyeGradient(
  svg: SVGSVGElement,
  activeToggle: SVGGElement,
  active: string,
  label?: string,
) {
  const color = eyeGradientColor(active, label)
  if (!color) return

  const instanceId = svgInstanceId(svg)
  activeToggle.querySelectorAll<SVGElement>('path').forEach((path, index) => {
    const gradientId = `mentell-eye-${instanceId}-${active}-${index}`
    ensureEyeGradient(svg, gradientId, color)
    path.setAttribute('fill', `url(#${gradientId})`)
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
    const rawColor = appearance.fills[fillable.key] ?? fillable.defaultFill
    const color = /^#([0-9a-f]{3,8})$/i.test(rawColor.trim()) ? rawColor : fillable.defaultFill
    const targetIds =
      'targetIds' in fillable && fillable.targetIds
        ? [...fillable.targetIds]
        : [fillable.id]
    for (const el of fillTargetElements(svg, targetIds)) {
      if (fillable.key === 'hair_fill') {
        applyHairFill(el, color, fillable.defaultFill)
        continue
      }
      if (fillable.key === 'path45') {
        applySkinFill(el, color, fillable.defaultFill)
        continue
      }
      applyPaintFill(el, color, fillable.defaultFill)
      if (hasVisibleStroke(el)) el.style.stroke = color
    }
    if (fillable.key === 'path45') {
      for (const el of findSkinMaskElements(svg)) {
        applySkinMaskFill(el, color, fillable.defaultFill)
      }
    }
  }

  for (const group of charManifest.globalFillGroups) {
    const color = appearance.fills[group.key] ?? group.defaultFill
    for (const el of fillTargetElements(svg, [...group.targetIds])) {
      applyPaintFill(el, color, group.defaultFill)
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
    const resolved = activeAccessoryOptions
      ? group.options.find((option) => activeAccessoryOptions.has(option.id))
      : isAccessoryToggleGroup(group)
        ? null
        : resolveToggleOption(group, appearance.toggles[group.key] ?? group.defaultOption)
    const active = resolved?.id ?? null
    const groupRoot = findGroupRoot(svg, group)

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
      const el = findOptionEl(svg, opt, groupRoot)
      if (!(el instanceof SVGElement)) continue
      const show = activeAccessoryOptions ? activeAccessoryOptions.has(opt.id) : opt.id === active
      setToggleOptionVisible(el, show)
      for (const companionId of optionCompanionIds(opt)) {
        const companion = svg.getElementById(companionId)
        if (companion instanceof SVGElement) setToggleOptionVisible(companion, show)
      }
      if (show && activeAccessoryOptions && group.key !== 'layer2') bringToFront(el)
    }

    const followIds = groupFollowVisibilityIds(group)
    if (followIds.length) {
      const groupActive = activeAccessoryOptions
        ? activeAccessoryOptions.size > 0
        : Boolean(active)
      for (const id of followIds) {
        const el = svg.getElementById(id)
        if (el instanceof SVGElement) setElementVisible(el, groupActive)
      }
    }

    if (isAccessoryToggleGroup(group) && !activeAccessoryOptions) {
      for (const opt of group.options) {
        const el = findOptionEl(svg, opt, groupRoot)
        if (el instanceof SVGElement) setToggleOptionVisible(el, false)
        for (const companionId of optionCompanionIds(opt)) {
          const companion = svg.getElementById(companionId)
          if (companion instanceof SVGElement) setToggleOptionVisible(companion, false)
        }
      }
    }

    if ((group.key === 'layer18' || group.key === 'layer18-6') && resolved) {
      const activeToggle = findOptionEl(svg, resolved, groupRoot)
      if (activeToggle instanceof SVGGElement) {
        activeToggle.style.opacity = '1'
        // Headshot already has authored iris fills; rewriting them into
        // programmatic gradients breaks the serialized nav/favicon SVGs.
        if (svg.getElementById('layer18')) {
          applyEyeGradient(svg, activeToggle, resolved.id, resolved.label)
        }
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
    for (const el of fillTargetElements(svg, targetIds)) {
      setElementVisible(el, false)
    }
  }

  applyBlinkOpenState(svg)
}
