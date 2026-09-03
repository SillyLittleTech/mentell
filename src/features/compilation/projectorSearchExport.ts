import { downloadTextFile } from './weeklyAiSummary'
import { downloadRawReportHtml } from './weeklyReportExport'

export type SearchExportMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type SearchExportEntries = {
  kind: 'entries'
  count: number
  labels: string[]
}

export type SearchExportItem =
  | { kind: 'message'; role: 'user' | 'assistant'; content: string }
  | SearchExportEntries

const SITE_URL = 'https://mentell.slt.ong'

function escapeHtml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function stamp() {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`
}

function turnLabel(role: 'user' | 'assistant') {
  return role === 'user' ? 'User' : 'Assistant'
}

/** Plain-text chat log with labeled back-and-forth turns. */
export function buildSearchChatLog(items: SearchExportItem[]): string {
  const lines = [
    '# Mentell Projector search chat',
    '',
    `- Site: ${SITE_URL}`,
    `- Exported: ${new Date().toISOString()}`,
    '',
    '---',
    '',
  ]

  let turn = 0
  for (const item of items) {
    if (item.kind === 'message') {
      turn += 1
      lines.push(`[${turn}] ${turnLabel(item.role)}:`)
      lines.push(item.content.trim() || '(empty)')
      lines.push('')
      continue
    }
    turn += 1
    lines.push(`[${turn}] Assistant (matched entries: ${item.count}):`)
    if (item.labels.length === 0) {
      lines.push('(no entry labels)')
    } else {
      for (const label of item.labels) lines.push(`- ${label}`)
    }
    lines.push('')
  }

  return lines.join('\n')
}

/** Lightweight HTML transcript for offline reading. */
export function buildSearchChatHtml(items: SearchExportItem[]): string {
  const blocks: string[] = []
  let turn = 0
  for (const item of items) {
    turn += 1
    if (item.kind === 'message') {
      const who = turnLabel(item.role)
      const side = item.role === 'user' ? 'user' : 'assistant'
      blocks.push(
        `<article class="msg msg-${side}" data-turn="${turn}">` +
          `<div class="who">${escapeHtml(who)}</div>` +
          `<pre>${escapeHtml(item.content.trim() || '(empty)')}</pre>` +
          `</article>`,
      )
      continue
    }
    const list =
      item.labels.length > 0
        ? `<ul>${item.labels.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`
        : '<p class="muted">(no entry labels)</p>'
    blocks.push(
      `<article class="msg msg-assistant" data-turn="${turn}">` +
        `<div class="who">Assistant · matched entries (${item.count})</div>` +
        list +
        `</article>`,
    )
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mentell search chat</title>
  <style>
    :root { color-scheme: light; --ink: #1c1917; --muted: #78716c; --paper: #faf7f2; --line: #e7e0d6; --user: #e8f0ea; --assistant: #f3eee6; }
    body { margin: 0; font-family: Georgia, "Times New Roman", serif; background: var(--paper); color: var(--ink); line-height: 1.45; }
    main { max-width: 42rem; margin: 0 auto; padding: 1.5rem 1.25rem 3rem; }
    h1 { font-size: 1.6rem; font-weight: 600; margin: 0 0 0.35rem; }
    .meta { color: var(--muted); font-size: 0.9rem; margin-bottom: 1.25rem; }
    .meta a { color: inherit; }
    .msg { border: 1px solid var(--line); border-radius: 1rem; padding: 0.85rem 1rem; margin: 0.75rem 0; }
    .msg-user { background: var(--user); }
    .msg-assistant { background: var(--assistant); }
    .who { font-size: 0.75rem; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); margin-bottom: 0.4rem; }
    pre { margin: 0; white-space: pre-wrap; word-break: break-word; font-family: inherit; font-size: 1rem; }
    ul { margin: 0.25rem 0 0; padding-left: 1.1rem; }
    .muted { color: var(--muted); }
  </style>
</head>
<body>
  <main>
    <h1>Mentell search chat</h1>
    <p class="meta">
      <a href="${SITE_URL}">${SITE_URL.replace(/^https:\/\//, '')}</a>
      · Exported ${escapeHtml(new Date().toISOString())}
    </p>
    ${blocks.join('\n    ') || '<p class="muted">No messages in this chat.</p>'}
  </main>
</body>
</html>`
}

/** Download both `.html` and `.log` transcripts for the current search thread. */
export function downloadSearchChat(items: SearchExportItem[]) {
  const base = `mentell-search-chat-${stamp()}`
  downloadRawReportHtml(buildSearchChatHtml(items), `${base}.html`)
  downloadTextFile(`${base}.log`, buildSearchChatLog(items), 'text/plain;charset=utf-8')
}
