import pointerTemplateSvg from '../../../asset/shop/pointer.svg?raw'
import type { CursorItem } from './shopCatalog'

export type CursorContext = 'default' | 'pointer' | 'text'

const FALLBACK_HOTSPOT: Record<CursorContext, [number, number]> = {
  default: [3, 3],
  pointer: [3, 3],
  text: [7, 12],
}
const CURSOR_RENDER_SIZE = '24'

function serializeSvgElement(svg: SVGSVGElement) {
  const raw = new XMLSerializer().serializeToString(svg)
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(raw)}`
}

function hintedContext(hint: string | undefined | null): CursorContext | null {
  const normalized = hint?.trim().toLowerCase()
  if (!normalized) return null
  if (normalized.includes('point') || normalized.includes('pointer')) return 'pointer'
  if (normalized.includes('text')) return 'text'
  if (normalized.includes('default') || normalized.includes('base')) return 'default'
  return null
}

function hintForElement(el: SVGElement): string {
  const dataContext = el.getAttribute('data-context') ?? ''
  const inkLabel = el.getAttribute('inkscape:label') ?? ''
  return `${dataContext} ${inkLabel}`.trim()
}

function applyLegacyContextLayers(svg: SVGSVGElement, context: CursorContext): boolean {
  const contextLayers = svg.querySelectorAll<SVGGElement>('g[data-context]')
  if (!contextLayers.length) return false
  contextLayers.forEach((layer) => {
    const active = layer.dataset.context === context
    layer.style.display = active ? 'inline' : 'none'
  })
  return true
}

function applyHintedContextVisibility(svg: SVGSVGElement, context: CursorContext) {
  const drawables = Array.from(
    svg.querySelectorAll<SVGElement>('path,rect,circle,ellipse,polygon,polyline'),
  )
  if (!drawables.length) return

  let foundContextHint = false
  drawables.forEach((el) => {
    const hinted = hintedContext(hintForElement(el))
    if (!hinted) return
    foundContextHint = true
    el.style.display = hinted === context ? 'inline' : 'none'
  })
  if (!foundContextHint) return

  if (context === 'default') {
    const explicitDefault = drawables.find((el) => hintedContext(hintForElement(el)) === 'default')
    const outlineFallback = drawables.find((el) => el.dataset.fill === 'outline')
    const unlabeledFallback = drawables.find((el) => hintedContext(hintForElement(el)) === null)
    const active = explicitDefault ?? outlineFallback ?? unlabeledFallback
    if (active) active.style.display = 'inline'
    return
  }

  drawables.forEach((el) => {
    if (hintedContext(hintForElement(el)) === null) {
      el.style.display = 'none'
    }
  })
}

function colorForContext(item: CursorItem, context: CursorContext) {
  if (context === 'text') return item.cursor.textPrimary ?? item.cursor.primary
  if (context === 'default') return item.cursor.outline
  return item.cursor.primary
}

function applyCursorColors(svg: SVGSVGElement, item: CursorItem, context: CursorContext) {
  const fills = svg.querySelectorAll<SVGElement>('[data-fill]')
  fills.forEach((el) => {
    const role = el.dataset.fill
    if (role === 'primary') el.style.fill = item.cursor.primary
    if (role === 'secondary') el.style.fill = item.cursor.secondary
    if (role === 'outline') el.style.fill = item.cursor.outline
    if (role === 'text') el.style.fill = item.cursor.textPrimary ?? item.cursor.primary
  })

  const strokes = svg.querySelectorAll<SVGElement>('[data-stroke]')
  strokes.forEach((el) => {
    const role = el.dataset.stroke
    if (role === 'outline') el.style.stroke = item.cursor.outline
    if (role === 'primary') el.style.stroke = item.cursor.primary
  })

  // New pointer assets do not need data-fill/data-stroke attributes;
  // tint unlabeled geometry from context to keep previews and live cursors aligned.
  const drawables = svg.querySelectorAll<SVGElement>('path,rect,circle,ellipse,polygon,polyline')
  drawables.forEach((el) => {
    if (el.dataset.fill || el.dataset.stroke) return
    const fillAttr = el.getAttribute('fill')?.toLowerCase()
    if (fillAttr !== 'none') {
      el.style.fill = colorForContext(item, context)
    }
    const strokeAttr = el.getAttribute('stroke')?.toLowerCase()
    if (strokeAttr && strokeAttr !== 'none') {
      el.style.stroke = item.cursor.outline
    }
  })
}

export function renderCursorCssValue(item: CursorItem, context: CursorContext): string | null {
  const doc = new DOMParser().parseFromString(pointerTemplateSvg, 'image/svg+xml')
  const svg = doc.documentElement
  if (!(svg instanceof SVGSVGElement)) return null

  svg.setAttribute('width', CURSOR_RENDER_SIZE)
  svg.setAttribute('height', CURSOR_RENDER_SIZE)
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')

  const usedLegacyContext = applyLegacyContextLayers(svg, context)
  if (!usedLegacyContext) {
    applyHintedContextVisibility(svg, context)
  }
  applyCursorColors(svg, item, context)

  const hotspot = item.cursor.hotspot?.[context]
  const [hx, hy] = hotspot ?? FALLBACK_HOTSPOT[context]
  return `url("${serializeSvgElement(svg)}") ${hx} ${hy}, auto`
}
