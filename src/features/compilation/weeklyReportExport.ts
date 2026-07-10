<<<<<<< HEAD
import { endOfWeek, format, parseISO, startOfWeek, subWeeks } from 'date-fns'
import { getDb, type EntryRow } from '../../db/schema'
import { getEffectiveGlobalName } from '../../shared/settings/effectiveGlobalName'
import { weekKeyForDateKey } from './weeklyStats'

export type RawReportRange = 'week' | 'last4' | 'all'

function toDateKey(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

export async function fetchEntriesForRange(
  range: RawReportRange,
  anchorDateKey: string,
): Promise<EntryRow[]> {
  if (range === 'all') {
    return getDb().entries.orderBy('dateKey').toArray()
  }

  const anchor = parseISO(anchorDateKey)
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 })
  const endKey = toDateKey(weekEnd)

  if (range === 'week') {
    const weekStart = startOfWeek(anchor, { weekStartsOn: 1 })
    return getDb().entries
      .where('dateKey')
      .between(toDateKey(weekStart), endKey, true, true)
      .toArray()
  }

  const startKey = toDateKey(startOfWeek(subWeeks(anchor, 4), { weekStartsOn: 1 }))
  return getDb().entries.where('dateKey').between(startKey, endKey, true, true).toArray()
}

function countSentiments(entries: EntryRow[]) {
  let positives = 0
  let negatives = 0
  let mixed = 0
  let warnings = 0
  for (const e of entries) {
    if (e.sentiment === '+') positives++
    else if (e.sentiment === '-') negatives++
    else mixed++
    if (e.warningLevel === 'warn') warnings++
  }
  return { positives, negatives, mixed, warnings, total: entries.length }
}

function emotionLabel(e: EntryRow) {
  if (e.emotionNote) return e.emotionNote
  if (e.emotion === 'happy') return 'Happy'
  if (e.emotion === 'calm') return 'Calm'
  if (e.emotion === 'anxious') return 'Anxious'
  if (e.emotion === 'sad') return 'Sad'
  if (e.emotion === 'angry') return 'Angry'
  return 'Other'
}

function barSvg(label: string, value: number, max: number, color: string) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return `
    <div class="bar-row">
      <div class="bar-label">${label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="bar-val">${value}</div>
    </div>`
}

export function buildRawReportHtml(input: {
  range: RawReportRange
  anchorDateKey: string
  entries: EntryRow[]
}) {
  const globalName = getEffectiveGlobalName()
  const sorted = [...input.entries].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const counts = countSentiments(sorted)
  const maxBar = Math.max(counts.positives, counts.negatives, counts.mixed, 1)
  const rangeLabel =
    input.range === 'week'
      ? 'This week'
      : input.range === 'last4'
        ? 'Last 4 weeks'
        : 'All time'

  const byWeek = new Map<string, EntryRow[]>()
  for (const e of sorted) {
    const wk = weekKeyForDateKey(e.dateKey)
    const list = byWeek.get(wk) ?? []
    list.push(e)
    byWeek.set(wk, list)
  }

  const weekSections = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([wk, rows]) => {
      const wc = countSentiments(rows)
      return `
        <h3>Week ${wk}</h3>
        <p class="muted">${wc.total} entries · +${wc.positives} =${wc.mixed} -${wc.negatives}</p>`
    })
    .join('')

  const rowsHtml = sorted
    .map((e) => {
      const pill =
        e.sentiment === '+' ? 'pos' : e.sentiment === '-' ? 'neg' : 'mix'
      const warn = e.warningLevel === 'warn' ? '⚠' : ''
      return (
        '<tr>' +
        `<td>${e.dateKey}</td>` +
        `<td><span class="pill pill-${pill}">${e.sentiment}</span></td>` +
        `<td>${emotionLabel(e)}</td>` +
        `<td>${escapeHtml((e.situation || '—').slice(0, 80))}</td>` +
        `<td>${warn}</td>` +
        '</tr>'
      )
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Mentell RAW report</title>
  <style>
    :root { --paper: #f6f1e8; --ink: #2a241c; --muted: #6a5f52; --border: #d9cfc0; }
    body { font-family: Georgia, serif; background: var(--paper); color: var(--ink); margin: 2rem; line-height: 1.5; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    h2, h3 { margin-top: 1.5rem; }
    .muted { color: var(--muted); font-size: 0.9rem; }
    .card { border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; margin: 1rem 0; background: #fffef9; }
    .bar-row { display: grid; grid-template-columns: 2rem 1fr 2rem; gap: 0.5rem; align-items: center; margin: 0.35rem 0; font-family: ui-monospace, monospace; font-size: 0.85rem; }
    .bar-track { height: 10px; background: #ebe4d8; border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 4px; }
    .bar-label { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { border-bottom: 1px solid var(--border); padding: 0.5rem; text-align: left; vertical-align: top; }
    th { font-size: 0.75rem; text-transform: uppercase; color: var(--muted); }
    .pill { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 4px; font-family: monospace; font-weight: bold; }
    .pill-pos { background: rgba(42,155,88,0.15); }
    .pill-neg { background: rgba(198,29,29,0.12); }
    .pill-mix { background: rgba(224,178,44,0.2); }
  </style>
</head>
<body>
  <h1>Mentell — RAW mental health report</h1>
  <p class="muted">${rangeLabel} · Generated ${format(new Date(), 'yyyy-MM-dd HH:mm')} · mentell.sillylittle.tech</p>

  <div class="card">
    <h2>Summary</h2>
    <p><strong>${counts.total}</strong> entries · <strong>${counts.warnings}</strong> warnings flagged</p>
    ${globalName ? `<p>Name on file: ${escapeHtml(globalName)}</p>` : ''}
    <h3>Sentiment chart</h3>
    ${barSvg('+', counts.positives, maxBar, '#2a9b58')}
    ${barSvg('=', counts.mixed, maxBar, '#e0b22c')}
    ${barSvg('-', counts.negatives, maxBar, '#c61d1d')}
  </div>

  ${input.range !== 'week' && byWeek.size > 1 ? `<div class="card"><h2>By week</h2>${weekSections}</div>` : ''}

  <div class="card">
    <h2>Entries</h2>
    <table>
      <thead><tr><th>Date</th><th>Sentiment</th><th>Emotion</th><th>Situation</th><th>!</th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="5">No entries in range.</td></tr>'}</tbody>
    </table>
  </div>

  <p class="muted">This report is for personal reflection only — not medical advice.</p>
</body>
</html>`
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function downloadRawReportHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
=======
import { stripDateKey } from '../../shared/dates'
import { endOfWeek, format, parseISO, startOfWeek, subWeeks } from 'date-fns'
import { getDb, type EntryRow } from '../../db/schema'
import { getEffectiveGlobalName } from '../../shared/settings/effectiveGlobalName'
import { weekKeyForDateKey } from './weeklyStats'

export type RawReportRange = 'week' | 'last4' | 'all'

function toDateKey(d: Date) {
  return format(d, 'yyyy-MM-dd')
}

export async function fetchEntriesForRange(
  range: RawReportRange,
  anchorDateKey: string,
): Promise<EntryRow[]> {
  if (range === 'all') {
    return getDb().entries.orderBy('dateKey').toArray()
  }

  const anchor = parseISO(stripDateKey(anchorDateKey))
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 })
  const endKey = toDateKey(weekEnd)

  if (range === 'week') {
    const weekStart = startOfWeek(anchor, { weekStartsOn: 1 })
    const entriesNorm = await getDb().entries.where('dateKey').between(toDateKey(weekStart), endKey, true, true).toArray()
    const entriesBulk = await getDb().entries.where('dateKey').between('~' + toDateKey(weekStart), '~' + endKey, true, true).toArray()
    return [...entriesNorm, ...entriesBulk]
  }

  const startKey = toDateKey(startOfWeek(subWeeks(anchor, 4), { weekStartsOn: 1 }))
  const entriesNorm = await getDb().entries.where('dateKey').between(startKey, endKey, true, true).toArray()
  const entriesBulk = await getDb().entries.where('dateKey').between('~' + startKey, '~' + endKey, true, true).toArray()
  return [...entriesNorm, ...entriesBulk]
}

function countSentiments(entries: EntryRow[]) {
  let positives = 0
  let negatives = 0
  let mixed = 0
  let warnings = 0
  for (const e of entries) {
    if (e.sentiment === '+') positives++
    else if (e.sentiment === '-') negatives++
    else mixed++
    if (e.warningLevel === 'warn') warnings++
  }
  return { positives, negatives, mixed, warnings, total: entries.length }
}

function emotionLabel(e: EntryRow) {
  if (e.emotionNote) return e.emotionNote
  if (e.emotion === 'happy') return 'Happy'
  if (e.emotion === 'calm') return 'Calm'
  if (e.emotion === 'anxious') return 'Anxious'
  if (e.emotion === 'sad') return 'Sad'
  if (e.emotion === 'angry') return 'Angry'
  return 'Other'
}

function barSvg(label: string, value: number, max: number, color: string) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return `
    <div class="bar-row">
      <div class="bar-label">${label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="bar-val">${value}</div>
    </div>`
}

export function buildRawReportHtml(input: {
  range: RawReportRange
  anchorDateKey: string
  entries: EntryRow[]
}) {
  const globalName = getEffectiveGlobalName()
  const sorted = [...input.entries].sort((a, b) => a.dateKey.localeCompare(b.dateKey))
  const counts = countSentiments(sorted)
  const maxBar = Math.max(counts.positives, counts.negatives, counts.mixed, 1)
  const rangeLabel =
    input.range === 'week'
      ? 'This week'
      : input.range === 'last4'
        ? 'Last 4 weeks'
        : 'All time'

  const byWeek = new Map<string, EntryRow[]>()
  for (const e of sorted) {
    const wk = weekKeyForDateKey(e.dateKey)
    const list = byWeek.get(wk) ?? []
    list.push(e)
    byWeek.set(wk, list)
  }

  const weekSections = [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([wk, rows]) => {
      const wc = countSentiments(rows)
      return `
        <h3>Week ${wk}</h3>
        <p class="muted">${wc.total} entries · +${wc.positives} =${wc.mixed} -${wc.negatives}</p>`
    })
    .join('')

  const rowsHtml = sorted
    .map((e) => {
      const pill =
        e.sentiment === '+' ? 'pos' : e.sentiment === '-' ? 'neg' : 'mix'
      const warn = e.warningLevel === 'warn' ? '⚠' : ''
      return (
        '<tr>' +
        `<td>${e.dateKey}</td>` +
        `<td><span class="pill pill-${pill}">${e.sentiment}</span></td>` +
        `<td>${emotionLabel(e)}</td>` +
        `<td>${escapeHtml((e.situation || '—').slice(0, 80))}</td>` +
        `<td>${warn}</td>` +
        '</tr>'
      )
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Mentell RAW report</title>
  <style>
    :root { --paper: #f6f1e8; --ink: #2a241c; --muted: #6a5f52; --border: #d9cfc0; }
    body { font-family: Georgia, serif; background: var(--paper); color: var(--ink); margin: 2rem; line-height: 1.5; }
    h1 { font-size: 1.75rem; margin-bottom: 0.25rem; }
    h2, h3 { margin-top: 1.5rem; }
    .muted { color: var(--muted); font-size: 0.9rem; }
    .card { border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; margin: 1rem 0; background: #fffef9; }
    .bar-row { display: grid; grid-template-columns: 2rem 1fr 2rem; gap: 0.5rem; align-items: center; margin: 0.35rem 0; font-family: ui-monospace, monospace; font-size: 0.85rem; }
    .bar-track { height: 10px; background: #ebe4d8; border-radius: 4px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 4px; }
    .bar-label { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
    th, td { border-bottom: 1px solid var(--border); padding: 0.5rem; text-align: left; vertical-align: top; }
    th { font-size: 0.75rem; text-transform: uppercase; color: var(--muted); }
    .pill { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 4px; font-family: monospace; font-weight: bold; }
    .pill-pos { background: rgba(42,155,88,0.15); }
    .pill-neg { background: rgba(198,29,29,0.12); }
    .pill-mix { background: rgba(224,178,44,0.2); }
  </style>
</head>
<body>
  <h1>Mentell — RAW mental health report</h1>
  <p class="muted">${rangeLabel} · Generated ${format(new Date(), 'yyyy-MM-dd HH:mm')} · Local export (no AI)</p>

  <div class="card">
    <h2>Summary</h2>
    <p><strong>${counts.total}</strong> entries · <strong>${counts.warnings}</strong> warnings flagged</p>
    ${globalName ? `<p>Name on file: ${escapeHtml(globalName)}</p>` : ''}
    <h3>Sentiment chart</h3>
    ${barSvg('+', counts.positives, maxBar, '#2a9b58')}
    ${barSvg('=', counts.mixed, maxBar, '#e0b22c')}
    ${barSvg('-', counts.negatives, maxBar, '#c61d1d')}
  </div>

  ${input.range !== 'week' && byWeek.size > 1 ? `<div class="card"><h2>By week</h2>${weekSections}</div>` : ''}

  <div class="card">
    <h2>Entries</h2>
    <table>
      <thead><tr><th>Date</th><th>Sentiment</th><th>Emotion</th><th>Situation</th><th>!</th></tr></thead>
      <tbody>${rowsHtml || '<tr><td colspan="5">No entries in range.</td></tr>'}</tbody>
    </table>
  </div>

  <p class="muted">This report is for personal reflection only — not medical advice.</p>
</body>
</html>`
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function downloadRawReportHtml(html: string, filename: string) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
>>>>>>> main
