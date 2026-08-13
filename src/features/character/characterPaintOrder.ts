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
  const ids = new Set<string>(HEADSHOT_EYE_TOGGLE_IDS)
  const group = charManifest.toggleGroups.find((entry) => entry.key === 'layer18')
  for (const option of group?.options ?? []) ids.add(option.id)

  for (const id of ids) {
    const el = svg.getElementById(id)
    if (!(el instanceof SVGElement)) continue
    const existing = el.getAttribute('transform') ?? ''
    if (existing.includes('matrix(')) continue
    el.setAttribute('transform', HEADSHOT_CHAR_MATRIX)
  }
}

/**
 * Headshot: hair under whites; iris + pupils on top of whites.
 * Headshot iris group is `layer18-7` (charprod uses `layer18`).
 */
export function fixHeadshotPaintOrder(svg: SVGSVGElement) {
  normalizeHeadshotEyeToggles(svg)

  const layer16 = svg.getElementById('layer16')
  const parent = layer16?.parentElement
  if (!layer16 || !parent) return

  const whites = svg.getElementById('layer14')
  const iris = svg.getElementById('layer18-7') ?? svg.getElementById('layer18')
  const pupils = svg.getElementById('g100')
  let insertRef: ChildNode | null = layer16.nextSibling
  for (const el of [whites, iris, pupils]) {
    if (!el) continue
    parent.insertBefore(el, insertRef)
    insertRef = el.nextSibling
  }
}

/**
 * Full body: stack whites → iris → pupils above hair/shirt, then arms,
 * arm shadows (must composite on top of posed arms), then sleeves.
 */
export function fixCharacterPaintOrder(svg: SVGSVGElement) {
  const parent = raiseAfterAnchor(svg, 'layer13', EYE_STACK_IDS)
  if (!parent) return

  const sleeveParentId =
    charManifest.globalFillGroups.find((group) => group.key === 'sleeves')?.parentId ?? 'layer19'

  for (const id of [charManifest.arms.armL.jointId, charManifest.arms.armR.jointId]) {
    const el = svg.getElementById(id)
    if (el) parent.appendChild(el)
  }

  svg.querySelectorAll('g').forEach((el) => {
    if (el.getAttribute('inkscape:label') === 'armShadowModel') parent.appendChild(el)
  })

  const sleeves = svg.getElementById(sleeveParentId)
  if (sleeves) parent.appendChild(sleeves)
}
