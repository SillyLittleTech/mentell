import { Link, Navigate, Route, Routes } from 'react-router-dom'
import { useTheme } from './shared/theme/useTheme'
import { LetterComposer } from './features/compose/LetterComposer'
import { SubmitAnimation } from './features/compose/SubmitAnimation'
import { awardForSubmission, getScoreSnapshot } from './features/score/scoreService'
import { upsertEntryFromDraft } from './features/entries/entryService'
import { useEffect, useState } from 'react'
import { WeeklyProjector } from './features/compilation/WeeklyProjector'
import { PackageAlert } from './features/packages/PackageAlert'
import { Notepad } from './features/notes/Notepad'
import { StickyBoard } from './features/stickies/StickyBoard'
import { DebugPanel } from './features/debug/DebugPanel'
import { generateDuePackages } from './features/packages/packageGenerator'
import { ScoreTicker } from './features/score/ScoreTicker'
import { Shoppe } from './features/shop/Shoppe'
import { SettingsPage } from './features/settings/SettingsPage'
import { useAppSettings } from './shared/settings/useAppSettings'

function App() {
  const [score, setScore] = useState(() => getScoreSnapshot())
  const [incomingDelta, setIncomingDelta] = useState<number | null>(null)
  const [incomingHint, setIncomingHint] = useState<string | null>(null)

  useEffect(() => {
    generateDuePackages()
  }, [])

  const handleAward = (delta: number, hint: string | null) => {
    setScore(getScoreSnapshot())
    setIncomingDelta(delta)
    setIncomingHint(hint)
  }

  return (
    <div className="desk px-4 py-6">
      <TopBar
        score={score}
        incomingDelta={incomingDelta}
        incomingHint={incomingHint}
        onScoreAnimationDone={() => {
          setIncomingDelta(null)
          setIncomingHint(null)
        }}
      />
      <main className="mx-auto mt-6 w-full max-w-4xl">
        <Routes>
          <Route
            path="/"
            element={<HomePlaceholder onAward={handleAward} />}
          />
          <Route path="/week" element={<WeekPlaceholder />} />
          <Route path="/notes" element={<NotesPlaceholder />} />
          <Route
            path="/shop"
            element={
              <ShopPlaceholder
                onScoreChanged={() => {
                  setScore(getScoreSnapshot())
                }}
              />
            }
          />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/archive" element={<ArchivePlaceholder />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <PackageAlert onAward={handleAward} />
      <DebugPanel />
    </div>
  )
}

function TopBar({
  score,
  incomingDelta,
  incomingHint,
  onScoreAnimationDone,
}: {
  score: ReturnType<typeof getScoreSnapshot>
  incomingDelta: number | null
  incomingHint: string | null
  onScoreAnimationDone: () => void
}) {
  const { mode, toggle } = useTheme()
  const { settings } = useAppSettings()
  return (
    <header className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3">
      <div className="flex items-baseline gap-3">
        <div className="paper rounded-2xl px-4 py-3">
          <div className="font-paper text-2xl tracking-tight">Mentell</div>
          <div className="ink-muted text-sm">local-first stationery journal</div>
        </div>
      </div>

      {!settings.disablePoints ? (
        <div className="paper flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
          <ScoreTicker
            total={score.total}
            streak={score.streak}
            incomingDelta={incomingDelta}
            hint={incomingHint}
            onDone={onScoreAnimationDone}
          />
        </div>
      ) : null}

      <nav className="paper flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
        <DeskLink to="/" label="Envelope" subtitle="Write" />
        <DeskLink to="/week" label="Projector" subtitle="Week" />
        <DeskLink to="/notes" label="Notepad" subtitle="Notes" />
        <DeskLink to="/shop" label="Shoppe" subtitle="Shop" />
        <DeskLink to="/settings" label="Settings" subtitle="Prefs" />
        <button
          type="button"
          className="focus-ring ml-2 rounded-xl border border-[var(--paper-border)] px-3 py-2 text-sm"
          onClick={toggle}
          aria-label="Toggle theme"
        >
          {mode === 'dark' ? 'Light' : 'Dark'}
        </button>
      </nav>
    </header>
  )
}

function DeskLink({ to, label, subtitle }: { to: string; label: string; subtitle: string }) {
  const icon =
    label === 'Envelope'
      ? '/asset/envelope.png'
      : label === 'Projector'
        ? '/asset/projector.png'
        : label === 'Shoppe'
          ? '/asset/gift_small.png'
          : null
  return (
    <Link
      className="focus-ring group rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left hover:-translate-y-[1px] hover:shadow-[0_12px_22px_rgba(0,0,0,0.12)]"
      to={to}
    >
      <div className="flex items-center gap-2">
        {icon ? (
          <img alt="" src={icon} draggable={false} className="h-8 w-8 shrink-0 select-none object-contain" />
        ) : null}
        <div>
          <div className="font-mono text-xs opacity-70">{label}</div>
          <div className="text-sm font-medium">{subtitle}</div>
        </div>
      </div>
    </Link>
  )
}

function PaperSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <section className="paper rounded-3xl p-6">
      <div className="font-paper text-2xl">{title}</div>
      <div className="ink-muted mt-1 text-sm">{subtitle}</div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

function HomePlaceholder({
  onAward,
}: {
  onAward: (delta: number, hint: string | null) => void
}) {
  const [submitting, setSubmitting] = useState(false)

  return (
    <PaperSection
      title="Draft today’s letter"
      subtitle="Draft it like stationery — then review and submit."
    >
      <LetterComposer
        onSubmit={async (draft) => {
          const award = await awardForSubmission(draft.dateKey)
          await upsertEntryFromDraft({
            ...draft,
            scoreDelta: award.totalDelta,
            streakAtSubmit: award.nextStreak,
          })

          await generateDuePackages()
          onAward(award.totalDelta, award.hint)
          setSubmitting(true)
        }}
      />

      <SubmitAnimation
        key={submitting ? 'submit-open' : 'submit-closed'}
        open={submitting}
        onFinished={() => {
          setSubmitting(false)
        }}
      />
    </PaperSection>
  )
}

function WeekPlaceholder() {
  return <WeeklyProjector />
}

function NotesPlaceholder() {
  return (
    <div className="space-y-4">
      <Notepad />
      <StickyBoard />
    </div>
  )
}

function ShopPlaceholder({ onScoreChanged }: { onScoreChanged: () => void }) {
  return (
    <Shoppe
      onSpent={() => {
        onScoreChanged()
      }}
    />
  )
}

function ArchivePlaceholder() {
  return (
    <PaperSection
      title="Archive"
      subtitle="Past packages (weekly/monthly/yearly) will show up here."
    >
      <div className="ink-muted rounded-2xl border border-[var(--paper-border)] p-4">
        Archive placeholder.
      </div>
    </PaperSection>
  )
}

export default App
