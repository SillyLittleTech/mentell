import { Link, Navigate, Route, useLocation } from 'react-router-dom'
import { AnimatedRoutes } from './shared/motion/AnimatedRoutes'
import { AnimatePresence } from 'framer-motion'
import { useTheme } from './shared/theme/useTheme'
import { LetterComposer } from './features/compose/LetterComposer'
import { SubmitAnimation } from './features/compose/SubmitAnimation'
import { awardForSubmission, getScoreSnapshot } from './features/score/scoreService'
import { upsertEntryFromDraft } from './features/entries/entryService'
import { useEffect, useRef, useState } from 'react'
import { WeeklyProjector } from './features/compilation/WeeklyProjector'
import { PackageAlert } from './features/packages/PackageAlert'
import { Notepad } from './features/notes/Notepad'
import { StickyDock } from './features/stickies/StickyDock'
import { StickyLayer } from './features/stickies/StickyLayer'
import { DebugPanel } from './features/debug/DebugPanel'
import { runPackageDeliveryAndNotify } from './features/packages/runPackageDelivery'
import { maybeRequestNotificationPermission } from './pwa/notifications'
import { dateKeyForLocalDay } from './shared/dates'
import { pushLocalChangesNow } from './shared/sync/syncService'
import { isWebPushConfigured, syncPushSubscription } from './pwa/pushSubscribe'
import { loadAppSettings } from './shared/settings/appSettings'
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
import { FeedbackPage, FeedbackThankYouPage } from './features/feedback/FeedbackPage'
import { SpeechBubbleIcon } from './components/SpeechBubbleIcon'
import { CharacterLabPage } from './features/character/CharacterLabPage'
import { CharacterNavIcon } from './features/character/CharacterNavIcon'
import { DeskCharacterLayout } from './features/character/DeskCharacterLayout'
import { LeftDeskMascot } from './features/character/LeftDeskMascot'
import { MobileHeaderMascot } from './features/character/MobileHeaderMascot'
import { CharacterTabIconSync } from './features/character/CharacterTabIconSync'
import { isFirebaseSyncEnabled, isShareLinksEnabled } from './shared/features/featureFlags'
import { useAuthOptional } from './shared/firebase/AuthProvider'
import { ShopCosmeticEffects } from './features/shop/shopCosmetics'
import { scrollToTop } from './shared/motion/scroll'
import { motionDuration } from './shared/motion/useMotionPrefs'

type StreakOutcomeAnimation =
  | { kind: 'break'; key: number; from: number }
  | { kind: 'freeze'; key: number; previousFreezes: number; nextFreezes: number }
type ScoreChangeOptions = { deferOverlay?: boolean; streakOutcome?: StreakOutcomeAnimation }

function App() {
  const location = useLocation()
  const shareRouteActive = location.pathname.startsWith('/share/')
  const [score, setScore] = useState(() => getScoreSnapshot())
  const [incomingDelta, setIncomingDelta] = useState<number | null>(null)
  const [incomingHint, setIncomingHint] = useState<string | null>(null)
  const [pendingOverlay, setPendingOverlay] = useState<{
    delta: number
    hint: string | null
    streakOutcome?: StreakOutcomeAnimation
  } | null>(null)
  const [streakOutcome, setStreakOutcome] = useState<StreakOutcomeAnimation | null>(null)
  const [streakFocusActive, setStreakFocusActive] = useState(false)
  const streakOutcomeTimer = useRef<number | null>(null)

  useEffect(() => {
    void runPackageDeliveryAndNotify()
    if (!loadAppSettings().disableNotifications && isWebPushConfigured()) {
      void syncPushSubscription()
    }
  }, [])

  const auth = useAuthOptional()
  const authUid = auth?.user?.uid
  useEffect(() => {
    if (authUid && !loadAppSettings().disableNotifications && isWebPushConfigured()) {
      void syncPushSubscription()
    }
  }, [authUid])

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === 'visible') {
        void runPackageDeliveryAndNotify()
      }
    }
    const id = window.setInterval(tick, 60_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [])

  useEffect(() => {
    const refresh = () => setScore(getScoreSnapshot())
    window.addEventListener(SCORE_CHANGED_EVENT, refresh)
    return () => window.removeEventListener(SCORE_CHANGED_EVENT, refresh)
  }, [])

  useEffect(() => {
    if (!streakOutcome) return
    const timeout = window.setTimeout(() => {
      setStreakOutcome(null)
      setStreakFocusActive(false)
    }, 1500)
    return () => window.clearTimeout(timeout)
  }, [streakOutcome])

  useEffect(() => {
    return () => {
      if (streakOutcomeTimer.current !== null) {
        window.clearTimeout(streakOutcomeTimer.current)
      }
    }
  }, [])

  const handleScoreChange = (
    delta: number,
    hint: string | null,
    options?: ScoreChangeOptions,
  ) => {
    setScore(getScoreSnapshot())
    if (delta === 0) return
    if (options?.deferOverlay) {
      setPendingOverlay({ delta, hint, streakOutcome: options.streakOutcome })
      return
    }
    if (options?.streakOutcome) {
      setStreakOutcome(options.streakOutcome)
    }
    setIncomingDelta(delta)
    setIncomingHint(hint)
  }

  const showPendingScoreOverlay = () => {
    if (!pendingOverlay) return
    const nextOverlay = pendingOverlay
    if (nextOverlay.streakOutcome) {
      if (streakOutcomeTimer.current !== null) {
        window.clearTimeout(streakOutcomeTimer.current)
      }
      scrollToTop()
      setStreakFocusActive(true)
      const delay = motionDuration(420) || 0
      streakOutcomeTimer.current = window.setTimeout(() => {
        setStreakOutcome(nextOverlay.streakOutcome ?? null)
        setIncomingDelta(nextOverlay.delta)
        setIncomingHint(nextOverlay.hint)
        streakOutcomeTimer.current = null
      }, delay)
      setPendingOverlay(null)
      return
    }
    setIncomingDelta(nextOverlay.delta)
    setIncomingHint(nextOverlay.hint)
    setPendingOverlay(null)
  }

  const clearScoreOverlay = () => {
    setIncomingDelta(null)
    setIncomingHint(null)
  }

  return (
    <div className={shareRouteActive ? 'min-h-[100svh]' : 'desk px-4 py-6'}>
      {!shareRouteActive ? <CharacterTabIconSync /> : null}
      {!shareRouteActive ? <ShopCosmeticEffects /> : null}
      {!shareRouteActive ? (
        <TopBar
          score={score}
          incomingHint={incomingHint}
          streakOutcome={streakOutcome}
          focusActive={streakFocusActive}
        />
      ) : null}
      {!shareRouteActive ? <LeftDeskMascot /> : null}
      {!shareRouteActive ? <StickyLayer /> : null}
      <main
        className={
          shareRouteActive
            ? 'w-full'
            : `mx-auto mt-6 w-full max-w-4xl ${streakFocusActive ? 'streak-focus-dim' : ''}`
        }
      >
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
          <Route path="/character-lab" element={<CharacterLabPage />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/feedback" element={<FeedbackPage />} />
          <Route path="/feedback/thanks" element={<FeedbackThankYouPage />} />
          {isShareLinksEnabled() ? (
            <Route path="/share/:code" element={<ShareDashboardPage />} />
          ) : null}
          <Route path="/archive" element={<ArchivePlaceholder />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </AnimatedRoutes>
      </main>
      {!shareRouteActive ? (
        <>
          <div className={streakFocusActive ? 'streak-focus-dim' : ''}>
            <AppLegalFooter />
          </div>
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
        </>
      ) : null}
    </div>
  )
}

function TopBar({
  score,
  incomingHint,
  streakOutcome,
  focusActive,
}: {
  score: ReturnType<typeof getScoreSnapshot>
  incomingHint: string | null
  streakOutcome: StreakOutcomeAnimation | null
  focusActive: boolean
}) {
  const { mode, toggle } = useTheme()
  const { settings } = useAppSettings()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!mobileMenuOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [mobileMenuOpen])

  return (
    <>
      <header className={`mx-auto w-full max-w-4xl space-y-3 ${focusActive ? 'streak-focus-target' : ''}`}>
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
                <ScoreTicker
                  total={score.total}
                  streak={score.streak}
                  streakFreezes={score.streakFreezes}
                  hint={incomingHint}
                  streakOutcome={streakOutcome}
                />
                <MobileHeaderMascot />
              </div>
            ) : (
              <div className="paper flex items-center rounded-2xl px-2 py-1 md:hidden">
                <MobileHeaderMascot />
              </div>
            )}

            <Link
              to="/feedback"
              className="paper focus-ring flex h-12 w-12 items-center justify-center rounded-2xl transition hover:-translate-y-[1px] hover:shadow-[0_16px_26px_rgba(0,0,0,0.14)]"
              aria-label="Open feedback form"
              title="Feedback form"
            >
              <SpeechBubbleIcon className="h-5 w-5" />
            </Link>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button
              type="button"
              className="focus-ring rounded-xl border border-[var(--paper-border)] bg-[var(--paper-bg)] p-2 text-lg leading-none"
              onClick={() => setMobileMenuOpen(true)}
              aria-controls="mobile-nav-drawer"
              aria-expanded={mobileMenuOpen}
              aria-label="Open navigation menu"
            >
              ☰
            </button>
          </div>
        </div>

        <nav className="paper hidden flex-wrap items-center gap-2 rounded-2xl px-3 py-2 md:flex">
          <DeskLink to="/" label="Envelope" subtitle="Write" />
          <DeskLink to="/week" label="Projector" subtitle="Week" />
          <DeskLink to="/notes" label="Notepad" subtitle="Notes" />
          <DeskLink to="/shop" label="Shoppe" subtitle="Shop" />
          <DeskLink to="/settings" label="Settings" subtitle="Prefs" />
          <DeskLink to="/character-lab" label="Character" subtitle="Lab" />
          <ThemeToggleButton mode={mode} onToggle={toggle} className="ml-2" />
        </nav>
      </header>

      {mobileMenuOpen ? (
        <div
          className="fixed inset-0 z-50 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/45"
            aria-label="Close navigation menu"
            onClick={() => setMobileMenuOpen(false)}
          />

          <div
            id="mobile-nav-drawer"
            className="paper absolute right-3 top-3 bottom-3 flex w-[min(20rem,calc(100vw-1.5rem))] flex-col rounded-3xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.38)]"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="font-paper text-xl">Menu</div>
              <button
                type="button"
                className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-2 text-sm font-semibold"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="grid gap-2 overflow-y-auto pr-1">
              <DeskLink
                to="/"
                label="Envelope"
                subtitle="Write"
                onNavigate={() => setMobileMenuOpen(false)}
                className="w-full"
              />
              <DeskLink
                to="/week"
                label="Projector"
                subtitle="Week"
                onNavigate={() => setMobileMenuOpen(false)}
                className="w-full"
              />
              <DeskLink
                to="/notes"
                label="Notepad"
                subtitle="Notes"
                onNavigate={() => setMobileMenuOpen(false)}
                className="w-full"
              />
              <DeskLink
                to="/shop"
                label="Shoppe"
                subtitle="Shop"
                onNavigate={() => setMobileMenuOpen(false)}
                className="w-full"
              />
              <DeskLink
                to="/settings"
                label="Settings"
                subtitle="Prefs"
                onNavigate={() => setMobileMenuOpen(false)}
                className="w-full"
              />
              <DeskLink
                to="/character-lab"
                label="Character"
                subtitle="Lab"
                onNavigate={() => setMobileMenuOpen(false)}
                className="w-full"
              />
              <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border border-[var(--paper-border)] px-3 py-2">
                <span className="text-sm font-medium">Appearance</span>
                <ThemeToggleButton
                  mode={mode}
                  onToggle={toggle}
                  variant="menu"
                  showLabel
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}

function ThemeToggleButton({
  mode,
  onToggle,
  className,
  variant = 'icon',
  showLabel = false,
}: {
  mode: 'light' | 'dark'
  onToggle: () => void
  className?: string
  variant?: 'icon' | 'menu'
  showLabel?: boolean
}) {
  const label = mode === 'dark' ? 'Light mode' : 'Dark mode'
  return (
    <button
      type="button"
      className={`focus-ring inline-flex items-center gap-2 rounded-xl border border-[var(--paper-border)] ${
        variant === 'menu' ? 'px-3 py-2' : 'p-2'
      } ${className ?? ''}`}
      onClick={onToggle}
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <img
        alt=""
        src={publicUrl(mode === 'dark' ? '/asset/light.png' : '/asset/dark.png')}
        className="h-8 w-8 shrink-0 select-none object-contain"
        draggable={false}
      />
      {showLabel ? <span className="text-sm font-medium">{label}</span> : null}
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
  className,
}: {
  to: string
  label: string
  subtitle: string
  onNavigate?: () => void
  className?: string
}) {
  const icon = navIconFor(label)
  const isCharacter = label === 'Character'
  return (
    <Link
      className={`focus-ring group rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-left hover:-translate-y-[1px] hover:shadow-[0_12px_22px_rgba(0,0,0,0.12)] ${className ?? 'w-full md:w-auto'}`}
      to={to}
      onClick={onNavigate}
    >
      <div className="flex items-center gap-2">
        {isCharacter ? (
          <CharacterNavIcon className="-my-0.5 h-9 w-9 shrink-0 select-none" />
        ) : icon ? (
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
      <DeskCharacterLayout>
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
          onSubmit={async (drafts) => {
            const submitDateKey = dateKeyForLocalDay(new Date())
            const award = await awardForSubmission(submitDateKey)

            for (const draft of drafts) {
              await upsertEntryFromDraft({
                ...draft,
                dateKey: draft.dateKey,
                scoreDelta: award.totalDelta,
                streakAtSubmit: award.nextStreak,
              })
            }

            await runPackageDeliveryAndNotify()
            void pushLocalChangesNow()
            if (!loadAppSettings().disableNotifications) {
              void maybeRequestNotificationPermission()
            }
            onScoreChange(award.totalDelta, award.hint, {
              deferOverlay: true,
              streakOutcome: award.freezeConsumed
                ? {
                    kind: 'freeze',
                    key: Date.now(),
                    previousFreezes: award.previousStreakFreezes,
                    nextFreezes: award.nextStreakFreezes,
                  }
                : award.streakBroken
                  ? { kind: 'break', key: Date.now(), from: award.previousStreak }
                  : undefined,
            })
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
      </DeskCharacterLayout>
    </PaperSection>
  )
}

function WeekPlaceholder() {
  return (
    <DeskCharacterLayout>
      <WeeklyProjector />
    </DeskCharacterLayout>
  )
}

function NotesPlaceholder() {
  return (
    <DeskCharacterLayout>
      <div className="space-y-4">
        <Notepad />
        <StickyDock />
      </div>
    </DeskCharacterLayout>
  )
}

function ShopPlaceholder({
  onScoreChange,
}: {
  onScoreChange: (delta: number, hint: string | null) => void
}) {
  return (
    <DeskCharacterLayout>
      <Shoppe
        onScoreChange={(delta, hint) => {
          onScoreChange(delta, hint)
        }}
      />
    </DeskCharacterLayout>
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
