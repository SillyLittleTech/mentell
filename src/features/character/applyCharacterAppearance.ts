import { applyBlinkOpenState } from './characterBlink'
import { charManifest } from './charManifest'
import type { CharacterAppearance } from './characterAppearance'

function setToggleOptionVisible(el: SVGElement, show: boolean) {
  el.style.display = show ? 'inline' : 'none'
  if (!show || !(el instanceof SVGGElement)) return
  for (const child of el.querySelectorAll<SVGElement>('path,ellipse,g')) {
    const attr = child.getAttribute('style') ?? ''
    if (attr.includes('display:none') && !attr.includes('display:inline')) continue
    child.style.display = 'inline'
  }
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
      }
      continue
    }

    for (const opt of group.options) {
      const el = svg.getElementById(opt.id)
      if (!(el instanceof SVGElement)) continue
      setToggleOptionVisible(el, opt.id === active)
    }
  }

  applyBlinkOpenState(svg)
}
