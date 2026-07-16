import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { EntryRow } from '../../db/schema'
import { MaterialIcon } from '../../components/MaterialIcon'
import { useBodyScrollLock } from '../../shared/motion/useBodyScrollLock'
import { motionDuration, shouldReduceMotion } from '../../shared/motion/useMotionPrefs'
import { useAuthOptional } from '../../shared/firebase/authContext'
import { ProjectorEntriesCarousel } from './ProjectorEntriesCarousel'
import {
  ProjectorEntryDetail,
  ProjectorEntrySlide,
} from './ProjectorEntrySlide'
import {
  getOrCreateAnonSearchUserId,
  requestProjectorSearch,
  type ProjectorIndexStatus,
  type ProjectorSearchEntry,
  type ProjectorSearchMessage,
  type ProjectorSearchResult,
} from './projectorSearch'
import {
  downloadSearchChat,
  type SearchExportItem,
} from './projectorSearchExport'

type BusyKind = 'search' | 'followup' | null

type ThreadItem =
  | { id: string; kind: 'message'; role: 'user' | 'assistant'; content: string }
  | { id: string; kind: 'entries'; entries: ProjectorSearchEntry[] }

function newId() {
  return crypto.randomUUID()
}

function statusLabel(
  busy: BusyKind,
  indexStatus: ProjectorIndexStatus | undefined,
): string | null {
  if (busy === 'search') return 'Searching…'
  if (busy === 'followup') return 'Asking follow-up…'
  if (!indexStatus || indexStatus === 'idle') return null
  if (indexStatus === 'synced') return 'Cloud index updating — local matches included now.'
  if (indexStatus === 'skipped') return 'Cloud index up to date.'
  if (indexStatus === 'failed') return 'Cloud index unavailable — showing local matches.'
  return null
}

function threadFromResult(res: ProjectorSearchResult): ThreadItem[] {
  if (res.type === 'answer') {
    return [{ id: newId(), kind: 'message', role: 'assistant', content: res.text }]
  }
  if (res.type === 'entries') {
    const items: ThreadItem[] = []
    if (res.preamble?.trim()) {
      items.push({ id: newId(), kind: 'message', role: 'assistant', content: res.preamble })
    }
    if (res.entries.length > 0) {
      items.push({ id: newId(), kind: 'entries', entries: res.entries })
    }
    return items
  }
  return []
}

function apiMessagesFromThread(thread: ThreadItem[]): ProjectorSearchMessage[] {
  return thread
    .filter((item): item is Extract<ThreadItem, { kind: 'message' }> => item.kind === 'message')
    .map((item) => ({ role: item.role, content: item.content }))
}

function exportItemsFromThread(thread: ThreadItem[]): SearchExportItem[] {
  return thread.map((item) => {
    if (item.kind === 'message') {
      return { kind: 'message', role: item.role, content: item.content }
    }
    return {
      kind: 'entries',
      count: item.entries.length,
      labels: item.entries.map(
        (e) => `${e.dateKey} [${e.sentiment}] ${e.situation || '(no situation)'}`,
      ),
    }
  })
}

function hasAssistantResults(thread: ThreadItem[]) {
  return thread.some(
    (item) =>
      (item.kind === 'message' && item.role === 'assistant') || item.kind === 'entries',
  )
}

function ChatBubble({ role, children }: { role: 'user' | 'assistant'; children: ReactNode }) {
  return (
    <div className={`chat-bubble ${role === 'user' ? 'chat-bubble--user' : 'chat-bubble--assistant'}`}>
      {children}
    </div>
  )
}

function projectorCloseConfirmEnabled() {
  return import.meta.env.VITE_ENABLE_PJS_CLOSECONF === '1'
}

export type ProjectorSearchModalProps = {
  open: boolean
  onClose: () => void
  /** Debug: seed results without network */
  debugSeed?: ProjectorSearchResult | null
}

export function ProjectorSearchModal({ open, onClose, debugSeed }: ProjectorSearchModalProps) {
  if (!open) return null
  return (
    <ProjectorSearchModalInner
      key={debugSeed ? `seed-${debugSeed.type}` : 'live'}
      onClose={onClose}
      debugSeed={debugSeed ?? null}
    />
  )
}

function ProjectorSearchModalInner({
  onClose,
  debugSeed,
}: {
  onClose: () => void
  debugSeed: ProjectorSearchResult | null
}) {
  const auth = useAuthOptional()
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState<BusyKind>(null)
  const [error, setError] = useState<string | null>(null)
  const [indexStatus, setIndexStatus] = useState<ProjectorIndexStatus | undefined>(undefined)
  const [followUp, setFollowUp] = useState('')
  const [thread, setThread] = useState<ThreadItem[]>(() => {
    if (!debugSeed || debugSeed.type === 'error') return []
    return threadFromResult(debugSeed)
  })
  const [searchStarted, setSearchStarted] = useState(() => Boolean(debugSeed && debugSeed.type !== 'error'))
  const [selected, setSelected] = useState<ProjectorSearchEntry | EntryRow | null>(null)
  const [confirmCloseOpen, setConfirmCloseOpen] = useState(false)
  const threadRef = useRef<HTMLDivElement>(null)

  const hasConversation = thread.length > 0
  const canSaveChat = hasAssistantResults(thread)
  const userMessageCount = thread.filter((t) => t.kind === 'message' && t.role === 'user').length
  const hasFollowUps = userMessageCount > 1
  const label = statusLabel(busy, indexStatus)

  useBodyScrollLock(true)

  useEffect(() => {
    const el = threadRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [thread, busy])

  function requestClose() {
    if (projectorCloseConfirmEnabled() && hasFollowUps) {
      setConfirmCloseOpen(true)
      return
    }
    onClose()
  }

  async function runSearch(nextQuery: string) {
    const q = nextQuery.trim()
    if (!q) return
    setBusy('search')
    setError(null)
    setSearchStarted(true)
    setIndexStatus(undefined)
    setThread([{ id: newId(), kind: 'message', role: 'user', content: q }])
    try {
      const userId = auth?.user?.uid || getOrCreateAnonSearchUserId()
      const res = await requestProjectorSearch({ query: q, mode: 'search', userId })
      if (res.type !== 'error') setIndexStatus(res.indexStatus)
      if (res.type === 'error') {
        setError(res.message)
        setIndexStatus(res.indexStatus)
        return
      }
      setThread((prev) => [...prev, ...threadFromResult(res)])
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Search failed.'
      setError(message)
    } finally {
      setBusy(null)
    }
  }

  async function runFollowUp() {
    const q = followUp.trim()
    if (!q) return
    setBusy('followup')
    setError(null)
    const userItem: ThreadItem = { id: newId(), kind: 'message', role: 'user', content: q }
    const nextThread = [...thread, userItem]
    setThread(nextThread)
    setFollowUp('')
    try {
      const userId = auth?.user?.uid || getOrCreateAnonSearchUserId()
      const res = await requestProjectorSearch({
        query: q,
        mode: 'chat',
        messages: apiMessagesFromThread(nextThread),
        userId,
      })
      if (res.type !== 'error') setIndexStatus(res.indexStatus)
      if (res.type === 'error') {
        setError(res.message)
        setIndexStatus(res.indexStatus)
        return
      }
      setThread((prev) => [...prev, ...threadFromResult(res)])
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Follow-up failed.'
      setError(message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4 sm:p-6"
        initial={shouldReduceMotion() ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={shouldReduceMotion() ? undefined : { opacity: 0 }}
        onClick={requestClose}
      >
        <motion.div
          className="paper flex max-h-[min(90dvh,42rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl"
          initial={shouldReduceMotion() ? false : { scale: 0.96, y: 18 }}
          animate={{ scale: 1, y: 0 }}
          exit={shouldReduceMotion() ? undefined : { scale: 0.98, y: 10 }}
          transition={{ duration: motionDuration(0.25) || 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--paper-border)] p-5">
            <div>
              <div className="font-paper text-2xl">Search journals</div>
              <div className="ink-muted mt-1 text-sm">
                Find entries or ask a question about your journal history.
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canSaveChat ? (
                <button
                  type="button"
                  className="focus-ring inline-flex items-center justify-center rounded-2xl border border-[var(--paper-border)] p-2"
                  onClick={() => downloadSearchChat(exportItemsFromThread(thread))}
                  aria-label="Save chat as HTML and log"
                  title="Save chat (.html + .log)"
                >
                  <MaterialIcon name="download" size={20} />
                </button>
              ) : null}
              <button
                type="button"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm"
                onClick={requestClose}
              >
                Close
              </button>
            </div>
          </div>

          {label ? (
            <div
              className="ink-muted flex shrink-0 items-center gap-2 border-b border-[var(--paper-border)] px-5 py-2.5 text-sm"
              role="status"
            >
              {busy || indexStatus === 'synced' ? (
                <MaterialIcon name="sync" size={16} className={busy ? 'animate-spin' : undefined} />
              ) : indexStatus === 'failed' ? (
                <MaterialIcon name="cloud_off" size={16} />
              ) : (
                <MaterialIcon name="cloud_done" size={16} />
              )}
              {label}
            </div>
          ) : null}

          {!searchStarted ? (
            <div className="shrink-0 border-b border-[var(--paper-border)] p-5 pb-4">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void runSearch(query)
                }}
              >
                <input
                  className="focus-ring min-w-0 flex-1 rounded-2xl border border-[var(--paper-border)] bg-transparent px-4 py-3 text-sm"
                  placeholder="Search or ask…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={Boolean(busy)}
                  aria-label="Search journals"
                />
                <button
                  type="submit"
                  className="btn-primary focus-ring inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold"
                  disabled={Boolean(busy) || !query.trim()}
                  aria-label="Run search"
                >
                  <MaterialIcon name="search" size={22} accent={false} />
                </button>
              </form>
            </div>
          ) : null}

          <div ref={threadRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-5">
            {error ? (
              <div className="rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </div>
            ) : null}

            {thread.map((item) => {
              if (item.kind === 'message') {
                return (
                  <ChatBubble key={item.id} role={item.role}>
                    {item.content}
                  </ChatBubble>
                )
              }
              if (item.entries.length > 2) {
                return (
                  <ProjectorEntriesCarousel
                    key={item.id}
                    entries={item.entries}
                    onSelect={(entry) => setSelected(entry)}
                  />
                )
              } else {
                return (
                  <div key={item.id} className="grid gap-3">
                    {item.entries.map((entry) => (
                      <ProjectorEntrySlide
                        key={entry.id}
                        entry={entry as EntryRow}
                        onClick={() => setSelected(entry)}
                      />
                    ))}
                  </div>
                )
              }
            })}
          </div>

          {hasConversation ? (
            <div className="shrink-0 border-t border-[var(--paper-border)] p-4">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  void runFollowUp()
                }}
              >
                <input
                  className="focus-ring min-w-0 flex-1 rounded-full border border-[var(--paper-border)] bg-transparent px-4 py-2.5 text-sm"
                  placeholder="Ask a follow-up…"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  disabled={Boolean(busy)}
                  aria-label="Follow-up question"
                />
                <button
                  type="submit"
                  className="btn-primary focus-ring inline-flex items-center justify-center rounded-full px-3.5 py-2.5 text-sm font-semibold"
                  disabled={Boolean(busy) || !followUp.trim()}
                  aria-label="Send follow-up"
                >
                  <MaterialIcon name="send" size={18} accent={false} />
                </button>
              </form>
            </div>
          ) : null}
        </motion.div>

        <AnimatePresence>
          {confirmCloseOpen ? (
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-6"
              initial={shouldReduceMotion() ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion() ? undefined : { opacity: 0 }}
              onClick={() => setConfirmCloseOpen(false)}
            >
              <motion.div
                className="paper w-full max-w-md rounded-3xl p-6"
                initial={shouldReduceMotion() ? false : { scale: 0.96, y: 12 }}
                animate={{ scale: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="font-paper text-xl">Close this search?</div>
                <p className="ink-muted mt-2 text-sm leading-relaxed">
                  Are you sure you wish to close this search? It contains follow-up messages that will
                  be lost.
                </p>
                <div className="mt-5 flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-4 py-2.5 text-sm font-semibold"
                    onClick={() => setConfirmCloseOpen(false)}
                  >
                    Keep chatting
                  </button>
                  <button
                    type="button"
                    className="btn-primary focus-ring rounded-2xl px-4 py-2.5 text-sm font-semibold"
                    onClick={onClose}
                  >
                    Close search
                  </button>
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <AnimatePresence>
          {selected ? (
            <motion.div
              className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/35 p-4 sm:p-6"
              initial={shouldReduceMotion() ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion() ? undefined : { opacity: 0 }}
              onClick={() => setSelected(null)}
            >
              <motion.div
                className="paper my-auto flex max-h-[min(90dvh,42rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl"
                initial={shouldReduceMotion() ? false : { scale: 0.96, y: 18 }}
                animate={{ scale: 1, y: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--paper-border)] p-6 pb-4">
                  <div>
                    <div className="font-paper text-2xl">
                      Slide preview <span className="font-mono">[{selected.sentiment}]</span>
                    </div>
                    <div className="ink-muted mt-1 text-sm">{selected.dateKey}</div>
                  </div>
                  <button
                    type="button"
                    className="focus-ring rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm"
                    onClick={() => setSelected(null)}
                  >
                    Close
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 pt-4">
                  <ProjectorEntryDetail entry={selected as EntryRow} />
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  )
}
