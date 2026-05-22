import { Link, Navigate, Route } from 'react-router-dom'
import { AnimatedRoutes } from './shared/motion/AnimatedRoutes'
import { AnimatePresence } from 'framer-motion'
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
import { ScoreBurst } from './features/score/ScoreBurst'
import { Shoppe } from './features/shop/Shoppe'
import { SettingsPage } from './features/settings/SettingsPage'
import { useAppSettings } from './shared/settings/useAppSettings'
import { publicUrl } from './shared/publicUrl'
import { SCORE_CHANGED_EVENT } from './features/score/scoreEvents'
import { ShareDashboardPage } from './features/share/ShareDashboardPage'
import { SyncOnboardingBanner } from './features/settings/SyncOnboardingBanner'
import { AppLegalFooter } from './components/AppLegalFooter'
import { PrivacyPolicyPage } from './features/legal/PrivacyPolicyPage'
import { isFirebaseSyncEnabled, isShareLinksEnabled } from './shared/features/featureFlags'
import { useAuthOptional } from './shared/firebase/AuthProvider'

type ScoreChangeOptions = { deferOverlay?: boolean }

function App() {
  const [score, setScore] = useState(() => getScoreSnapshot())
  const [incomingDelta, setIncomingDelta] = useState<number | null>(null)
  const [incomingHint, setIncomingHint] = useState<string | null>(null)
  const [pendingOverlay, setPendingOverlay] = useState<{
    delta: number
    hint: string | null
  } | null>(null)

  useEffect(() => {
    generateDuePackages()
  }, [])

  useEffect(() => {
    const refresh = () => setScore(getScoreSnapshot())
    window.addEventListener(SCORE_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(SCORE_CHANGED_EVENT, refresh)
  }, [])

  const handleScoreChange = (
    delta: number,
    hint: string | null,
    options?: ScoreChangeOptions,
  ) => {
    setScore(getScoreSnapshot())
    if (delta === 0) return
    if (options?.deferOverlay) {
      setPendingOverlay({ delta, hint })
      return
    }
    setIncomingDelta(delta)
    setIncomingHint(hint)
  }

  const showPendingScoreOverlay = () => {
    if (!pendingOverlay) return
    setIncomingDelta(pendingOverlay.delta)
    setIncomingHint(pendingOverlay.hint)
    setPendingOverlay(null)
  }

  const clearScoreOverlay = () => {
    setIncomingDelta(null)
    setIncomingHint(null)
  }

  return (
    <div className="desk px-4 py-6">
      <TopBar score={score} incomingHint={incomingHint} />
      <main className="mx-auto mt-6 w-full max-w-4xl">
        <AnimatedRoutes>
          <Route
            path="/"
            element={
              <HomePlaceholder
                onScoreChange={handleScoreChange}
                onSubmitAnimationDone={showPendingScoreOverlay}
              />
            }
          />
          <Route path="/week" element={<WeekPlaceholder />} />
          <Route path="/notes" element={<NotesPlaceholder />} />
          <Route
            path="/shop"
            element={<ShopPlaceholder onScoreChange={handleScoreChange} />}
          />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          {isShareLinksEnabled() ? (
            <Route path="/share/:code" element={<ShareDashboardPage />} />
          ) : null}
          <Route path="/archive" element={<ArchivePlaceholder />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </AnimatedRoutes>
      </main>
      <AppLegalFooter />
      <PackageAlert onAward={handleScoreChange} />
      <AnimatePresence>
        {incomingDelta !== null ? (
          <ScoreBurst
            key={`${incomingDelta}-${incomingHint ?? ''}`}
            delta={incomingDelta}
            totalAfter={score.total}
            hint={incomingHint}
            onDone={clearScoreOverlay}
          />
        ) : null}
      </AnimatePresence>
      <DebugPanel />
    </div>
  )
}

function TopBar({
  score,
  incomingHint,
}: {
  score: ReturnType<typeof getScoreSnapshot>
  incomingHint: string | null
}) {
  const { mode, toggle } = useTheme()
  const { settings } = useAppSettings()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)


  return (
    <header className="mx-auto w-full max-w-4xl space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-start gap-3">
          <div className="paper flex items-center gap-3 rounded-2xl px-4 py-3">
            <img
              alt=""
              src={publicUrl('/asset/mentell-icon.png')}
              className="h-10 w-10 shrink-0 select-none object-contain"
              draggable={false}
            />
            <div>
              <div className="font-paper text-2xl tracking-tight">Mentell</div>
              <div className="ink-muted text-sm">local-first stationery journal</div>
            </div>
          </div>

          {!settings.disablePoints ? (
            <div className="paper flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
              <ScoreTicker total={score.total} streak={score.streak} hint={incomingHint} />
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggleButton mode={mode} onToggle={toggle} />
          <button
            type="button"
            className="focus-ring rounded-xl border border-[var(--paper-border)] bg-[var(--paper-bg)] p-2 text-sm font-semibold"
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-controls="primary-nav"
            aria-expanded={mobileMenuOpen}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      <nav
        id="primary-nav"
        className={`paper w-full rounded-2xl px-3 py-2 ${mobileMenuOpen ? 'flex' : 'hidden'} flex-col gap-2 md:flex md:flex-row md:flex-wrap md:items-center`}
      >
        <DeskLink
          to="/"
          label="Envelope"
          subtitle="Write"
          onNavigate={() => setMobileMenuOpen(false)}
        />
        <DeskLink
          to="/week"
          label="Projector"
          subtitle="Week"
          onNavigate={() => setMobileMenuOpen(false)}
        />
        <DeskLink
          to="/notes"
          label="Notepad"
          subtitle="Notes"
          onNavigate={() => setMobileMenuOpen(false)}
        />
        <DeskLink
          to="/shop"
          label="Shoppe"
          subtitle="Shop"
          onNavigate={() => setMobileMenuOpen(false)}
        />
        <DeskLink
          to="/settings"
          label="Settings"
          subtitle="Prefs"
          onNavigate={() => setMobileMenuOpen(false)}
        />
        <ThemeToggleButton mode={mode} onToggle={toggle} className="hidden md:block md:ml-2" />
      </nav>
    </header>
  )
}

function ThemeToggleButton({
  mode,
  onToggle,
  className,
}: {
  mode: 'light' | 'dark'
  onToggle: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      className={`focus-ring rounded-xl border border-[var(--paper-border)] p-2 ${className ?? ''}`}
      onClick={onToggle}
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <img
        alt=""
        src={publicUrl(mode === 'dark' ? '/asset/light.png' : '/asset/dark.png')}
        className="h-8 w-8 select-none object-contain"
        draggable={false}
      />
    </button>
  )
}

const NAV_ICONS: Record<string, string> = {
  Envelope: '/asset/envelope.png',
  Projector: '/asset/projector.png',
  Notepad: '/asset/notepad.png',
  Shoppe: '/asset/shoppe.png',
  Settings: '/asset/setting.png',
}

function navIconFor(label: string) {
  const path = NAV_ICONS[label]
  return path ? publicUrl(path) : null
}

function DeskLink({
  to,
  label,
  subtitle,
  onNavigate,
}: {
  to: string
  label: string
  subtitle: string
  onNavigate?: () => void
}) {
  const icon = navIconFor(label)
  return (
    <Link
      className="focus-ring group w-full rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left hover:-translate-y-[1px] hover:shadow-[0_12px_22px_rgba(0,0,0,0.12)] md:w-auto"
      to={to}
      onClick={onNavigate}
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
  onScoreChange,
  onSubmitAnimationDone,
}: {
  onScoreChange: (delta: number, hint: string | null, options?: ScoreChangeOptions) => void
  onSubmitAnimationDone: () => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [shakeBanner, setShakeBanner] = useState(0)
  const { settings } = useAppSettings()
  const auth = useAuthOptional()
  const composerLocked =
    isFirebaseSyncEnabled() &&
    !auth?.loading &&
    !auth?.user &&
    !settings.syncPromptDismissed

  function onBlockedComposerInteraction() {
    if (composerLocked) setShakeBanner((k) => k + 1)
  }

  return (
    <PaperSection
      title="Draft today’s letter"
      subtitle="Draft it like stationery — then review and submit."
    >
      <SyncOnboardingBanner shakeKey={shakeBanner} />
      <div
        className="relative"
        onPointerDownCapture={composerLocked ? onBlockedComposerInteraction : undefined}
      >
        {composerLocked ? (
          <div
            className="absolute inset-0 z-10 cursor-not-allowed"
            aria-hidden
            onFocus={onBlockedComposerInteraction}
          />
        ) : null}
        <LetterComposer
          disabled={composerLocked}
          onSubmit={async (draft) => {
          const award = await awardForSubmission(draft.dateKey)
          await upsertEntryFromDraft({
            ...draft,
            scoreDelta: award.totalDelta,
            streakAtSubmit: award.nextStreak,
          })

          await generateDuePackages()
          onScoreChange(award.totalDelta, award.hint, { deferOverlay: true })
          setSubmitting(true)
        }}
        />
      </div>

      <SubmitAnimation
        key={submitting ? 'submit-open' : 'submit-closed'}
        open={submitting}
        onFinished={() => {
          setSubmitting(false)
          onSubmitAnimationDone()
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

function ShopPlaceholder({
  onScoreChange,
}: {
  onScoreChange: (delta: number, hint: string | null) => void
}) {
  return (
    <Shoppe
      onScoreChange={(delta, hint) => {
        onScoreChange(delta, hint)
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
