import { charManifest } from './charManifest'

/** Maps charprod art-space paths into the headshot viewBox. */
export const HEADSHOT_CHAR_MATRIX =
  'matrix(0.44774806,0,0,0.44774806,264.3503,-101.61394)'

const HEADSHOT_EYE_TOGGLE_IDS = ['g104', 'g105', 'g107'] as const

const EYE_STACK_IDS = ['layer14', 'layer18', 'g100'] as const

function raiseAfterAnchor(
  svg: SVGSVGElement,
  anchorId: string,
  ids: readonly string[],
): Element | null {
  const anchor = svg.getElementById(anchorId)
  const parent = anchor?.parentElement ?? svg
  if (!anchor) return null
  let insertRef: ChildNode | null = anchor.nextSibling
  for (const id of ids) {
    const el = svg.getElementById(id)
    if (!el) continue
    parent.insertBefore(el, insertRef)
    insertRef = el.nextSibling
  }
  return parent
}

export function normalizeHeadshotEyeToggles(svg: SVGSVGElement) {
  for (const id of HEADSHOT_EYE_TOGGLE_IDS) {
    const group = svg.getElementById(id)
    if (group) group.setAttribute('transform', HEADSHOT_CHAR_MATRIX)
  }
}

/**
 * Headshot: hair (layer16) must stay under eye whites; iris + pupils stay on top.
 */
export function fixHeadshotPaintOrder(svg: SVGSVGElement) {
  normalizeHeadshotEyeToggles(svg)

  const layer16 = svg.getElementById('layer16')
  const layer14 = svg.getElementById('layer14')
  const parent = layer16?.parentElement
  if (layer14 && parent && layer16) {
    parent.insertBefore(layer14, layer16.nextSibling)
  }
}

/**
 * Full body: stack whites → iris → pupils above hair/shirt, then arms/sleeves on top.
 */
export function fixCharacterPaintOrder(svg: SVGSVGElement) {
  const parent = raiseAfterAnchor(svg, 'layer13', EYE_STACK_IDS)
  if (!parent) return

  const sleeveParentId =
    charManifest.globalFillGroups.find((group) => group.key === 'sleeves')?.parentId ?? 'layer19'
  const frontIds = [
    charManifest.arms.armL.jointId,
    charManifest.arms.armR.jointId,
    sleeveParentId,
  ]

  for (const id of frontIds) {
    const el = svg.getElementById(id)
    if (el) parent.appendChild(el)
  }
}
