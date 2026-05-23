import { applyBlinkOpenState } from './characterBlink'
import { charManifest } from './charManifest'
import type { CharacterAppearance } from './characterAppearance'

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
) {
  for (const fillable of charManifest.fillables) {
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

  for (const group of charManifest.toggleGroups) {
    const active = appearance.toggles[group.key] ?? group.defaultOption

    if (group.key === 'blush' && 'elementId' in group) {
      const blush = svg.getElementById(group.elementId)
      if (blush instanceof SVGElement) {
        blush.style.display = active === 'on' ? 'inline' : 'none'
        blush.style.opacity = active === 'on' ? '1' : '0'
      }
      continue
    }

    for (const opt of group.options) {
      const el = svg.getElementById(opt.id)
      if (!(el instanceof SVGElement)) continue
      setToggleOptionVisible(el, opt.id === active)
    }

    if (group.key === 'layer18') {
      const activeToggle = svg.getElementById(active)
      if (activeToggle instanceof SVGGElement) {
        activeToggle.style.opacity = '1'
        applyEyeGradient(svg, activeToggle, active)
      }
    }
  }

  applyBlinkOpenState(svg)
}
