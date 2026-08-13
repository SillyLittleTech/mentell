import { describe, expect, it } from 'vitest'
import { applyCharacterAppearance } from './applyCharacterAppearance'
import { defaultCharacterAppearance } from './characterAppearance'

const HAIR_PINK = '#ff4d6d'
const HAIR_DEFAULT = '#311e00'
const OUTLINE_GOLD = '#e8c76c'
const MAIN_BROWN = '#311e00'
const SKIN_DEFAULT = '#ddae67'
const PANTS_DEFAULT = '#6d7b9a'

function svgFrom(markup: string) {
  const doc = new DOMParser().parseFromString(
    `<svg xmlns="http://www.w3.org/2000/svg">${markup}</svg>`,
    'image/svg+xml',
  )
  return doc.documentElement as unknown as SVGSVGElement
}

function parseCssColor(color: string): [number, number, number] | null {
  const value = color.trim()
  const hex = value.replace(/^#/, '')
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16)) as [
      number,
      number,
      number,
    ]
  }
  const rgb = value.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i)
  if (!rgb) return null
  return [1, 2, 3].map((index) => Math.round(Number(rgb[index]))) as [number, number, number]
}

function fillOf(svg: SVGSVGElement, id: string) {
  const el = svg.getElementById(id)
  if (!(el instanceof SVGElement)) throw new Error(`missing ${id}`)
  const fromStyle = el.getAttribute('style')?.match(/(?:^|;)\s*fill\s*:\s*([^;]+)/i)?.[1]
  const raw = (fromStyle || el.getAttribute('fill') || el.style.fill || '').trim()
  const rgb = parseCssColor(raw)
  if (!rgb) return raw.toLowerCase()
  return `#${rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function appearanceWithHair(color: string) {
  const appearance = defaultCharacterAppearance()
  appearance.fills.hair_fill = color
  return appearance
}

describe('applyCharacterAppearance hair fills', () => {
  it('tints the main hair mass, not only the gold outline/base', () => {
    const svg = svgFrom(`
      <defs>
        <linearGradient id="linearGradient127">
          <stop offset="0" stop-color="#000000" />
          <stop offset="1" stop-color="#311e00" />
        </linearGradient>
      </defs>
      <path id="path93" style="fill:${OUTLINE_GOLD};stroke:none" />
      <path id="path94" style="fill:${MAIN_BROWN};stroke:url(#linearGradient127);stroke-width:2.458" />
      <path id="path45" style="fill:${SKIN_DEFAULT};stroke:none" />
      <path id="path65" style="fill:${PANTS_DEFAULT};stroke:none;filter:url(#filter321)" />
    `)

    applyCharacterAppearance(svg, appearanceWithHair(HAIR_PINK))

    const main = fillOf(svg, 'path94')
    const outline = fillOf(svg, 'path93')
    expect(main).toBe(HAIR_PINK)
    expect(outline).not.toBe(OUTLINE_GOLD.toLowerCase())
    expect(outline).not.toBe(HAIR_PINK)
    expect(fillOf(svg, 'path45')).toBe(SKIN_DEFAULT)
    expect(fillOf(svg, 'path65')).toBe(PANTS_DEFAULT)
  })

  it('still tints main hair after CSSOM serializes fill as rgb()', () => {
    const svg = svgFrom(`
      <defs>
        <linearGradient id="hairStroke">
          <stop offset="0" stop-color="#000000" />
          <stop offset="1" stop-color="#311e00" />
        </linearGradient>
      </defs>
      <path id="path94" style="fill:${MAIN_BROWN};stroke:url(#hairStroke)" />
    `)
    const main = svg.getElementById('path94')
    if (!(main instanceof SVGElement)) throw new Error('missing path94')
    // Touch CSSOM the same way namespacing paint servers does.
    main.setAttribute('style', main.getAttribute('style') ?? '')
    expect(main.style.fill).toMatch(/^rgb\(/i)

    applyCharacterAppearance(svg, appearanceWithHair(HAIR_PINK))
    expect(fillOf(svg, 'path94')).toBe(HAIR_PINK)
  })

  it('restores authored hair fills when returning to the default colour', () => {
    const svg = svgFrom(`
      <path id="path93" style="fill:${OUTLINE_GOLD};stroke:none" />
      <path id="path94" style="fill:${MAIN_BROWN};stroke:url(#linearGradient127)" />
    `)

    applyCharacterAppearance(svg, appearanceWithHair(HAIR_PINK))
    applyCharacterAppearance(svg, appearanceWithHair(HAIR_DEFAULT))

    expect(fillOf(svg, 'path94')).toBe(MAIN_BROWN)
    expect(fillOf(svg, 'path93')).toBe(OUTLINE_GOLD.toLowerCase())
  })

  it('still recolors pants and skin independently of hair', () => {
    const svg = svgFrom(`
      <path id="path93" style="fill:${OUTLINE_GOLD};stroke:none" />
      <path id="path94" style="fill:${MAIN_BROWN};stroke:url(#linearGradient127)" />
      <path id="path45" style="fill:${SKIN_DEFAULT};stroke:#000000" />
      <path id="path65" style="fill:${PANTS_DEFAULT};stroke:none;filter:url(#filter321)" />
    `)
    const appearance = defaultCharacterAppearance()
    appearance.fills.hair_fill = HAIR_PINK
    appearance.fills.path45 = '#8d5524'
    appearance.fills.path65 = '#2244aa'

    applyCharacterAppearance(svg, appearance)

    expect(fillOf(svg, 'path94')).toBe(HAIR_PINK)
    expect(fillOf(svg, 'path45')).toBe('#8d5524')
    expect(fillOf(svg, 'path65')).toBe('#2244aa')
  })

  it('matches headshot clone ids onto the main hair layer', () => {
    const svg = svgFrom(`
      <path id="path85-7-8" style="fill:${OUTLINE_GOLD};stroke:none" />
      <path id="path85-3" style="fill:${MAIN_BROWN};stroke:url(#linearGradient11)" />
    `)

    applyCharacterAppearance(svg, appearanceWithHair(HAIR_PINK))

    expect(fillOf(svg, 'path85-3')).toBe(HAIR_PINK)
    expect(fillOf(svg, 'path85-7-8')).not.toBe(OUTLINE_GOLD.toLowerCase())
    expect(fillOf(svg, 'path85-7-8')).not.toBe(HAIR_PINK)
  })
})
