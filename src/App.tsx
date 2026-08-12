import { Link, Navigate, Route, useLocation } from 'react-router-dom'
import { AnimatedRoutes } from './shared/motion/AnimatedRoutes'
import { AnimatePresence, motion } from 'framer-motion'
import { useTheme } from './shared/theme/useTheme'
import { LetterComposer } from './features/compose/LetterComposer'
import { SubmitAnimation } from './features/compose/SubmitAnimation'
import { awardForSubmission, getScoreSnapshot } from './features/score/scoreService'
import { waitForSync } from './shared/sync/syncService'
import { upsertEntryFromDraft } from './features/entries/entryService'
import { useEffect, useRef, useState } from 'react'
import { WeeklyProjector } from './features/compilation/WeeklyProjector'
import { PackageAlert } from './features/packages/PackageAlert'
import { Notepad } from './features/notes/Notepad'
import { StickyDock } from './features/stickies/StickyDock'
import { StickyLayer } from './features/stickies/StickyLayer'
import { DebugPanel } from './features/debug/DebugPanel'
import { UiPlaygroundPage } from './features/debug/UiPlaygroundPage'
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
import { MaterialIcon } from './components/MaterialIcon'
import { CharacterLabPage } from './features/character/CharacterLabPage'
import { DeskCharacterLayout } from './features/character/DeskCharacterLayout'
import { MobileHeaderMascot } from './features/character/MobileHeaderMascot'
import { CharacterTabIconSync } from './features/character/CharacterTabIconSync'
import { AuthDeeplinkPage } from './features/auth/AuthDeeplinkPage'
import { AuthLinkPage } from './features/auth/AuthLinkPage'
import { EmailLinkDesktopHandoff } from './features/auth/EmailLinkDesktopHandoff'
import { isFirebaseSyncEnabled, isShareLinksEnabled } from './shared/features/featureFlags'
import { isDebugMode } from './shared/debug/debugFlags'
import { useAuthOptional } from './shared/firebase/AuthProvider'
import { ShopCosmeticEffects } from './features/shop/shopCosmetics'
import { getOrCreateAnonSearchUserId, requestProjectorSearch } from './features/compilation/projectorSearch'
import { emitBackgroundActivity, listenToBackgroundActivity } from './shared/backgroundActivity'
import { BackgroundActivityToast } from './components/BackgroundActivityToast'
import { scrollToTop } from './shared/motion/scroll'
import { motionDuration } from './shared/motion/useMotionPrefs'
import { SidebarNav } from './components/shell/SidebarNav'
import { BottomNav } from './components/shell/BottomNav'
import { DeskSpotlight } from './components/shell/DeskSpotlight'

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
  const [syncBusy, setSyncBusy] = useState(false)

  useEffect(() => {
    void runPackageDeliveryAndNotify()
    if (!loadAppSettings().disableNotifications && isWebPushConfigured()) {
      void syncPushSubscription()
    }
  }, [])

  const auth = useAuthOptional()
  const authUid = auth?.user?.uid

  useEffect(() => {
    return listenToBackgroundActivity((event) => {
      if (event.id !== 'sync') return
      setSyncBusy(event.type === 'start')
    })
  }, [])

  useEffect(() => {
    if (authUid && !loadAppSettings().disableNotifications && isWebPushConfigured()) {
      void syncPushSubscription()
    }
  }, [authUid])

  const mobileSyncTone = auth?.syncError
    ? 'var(--danger)'
    : syncBusy
      ? '#3b82f6'
      : auth?.user && auth.syncEnabled
        ? 'var(--success)'
        : 'rgba(148, 163, 184, 0.9)'

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
    <div
      className={
        shareRouteActive
          ? 'min-h-[100svh]'
          : 'desk px-4 py-6 pb-24 md:pb-6 mobile-sync-glow'
      }
      style={
        shareRouteActive
          ? undefined
          : ({ '--sync-glow-tone': mobileSyncTone } as Record<string, string>)
      }
    >
      <EmailLinkDesktopHandoff />
      {!shareRouteActive ? <CharacterTabIconSync /> : null}
      {!shareRouteActive ? <ShopCosmeticEffects /> : null}
      {!shareRouteActive ? <StickyLayer /> : null}
      <BackgroundActivityToast />
      {!shareRouteActive ? <DeskSpotlight /> : null}

      {shareRouteActive ? (
        <main className="w-full">
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
            <Route path="/auth/deeplink" element={<AuthDeeplinkPage />} />
            <Route path="/auth/link" element={<AuthLinkPage />} />
            <Route path="/character-lab" element={<CharacterLabPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/feedback" element={<FeedbackPage />} />
            <Route path="/feedback/thanks" element={<FeedbackThankYouPage />} />
            {isShareLinksEnabled() ? (
              <Route path="/share/:code" element={<ShareDashboardPage />} />
            ) : null}
            {isDebugMode() ? (
              <Route path="/debug/ui-playground" element={<UiPlaygroundPage />} />
            ) : null}
            <Route path="/archive" element={<ArchivePlaceholder />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </AnimatedRoutes>
        </main>
      ) : (
        <div className="mx-auto w-full max-w-6xl md:grid md:grid-cols-[16rem_1fr] md:gap-6">
          <SidebarNav />

          <div className="min-w-0">
            <TopBar
              score={score}
              incomingHint={incomingHint}
              streakOutcome={streakOutcome}
              focusActive={streakFocusActive}
              onPackageAward={handleScoreChange}
            />

            <main
              className={`mt-6 w-full max-w-4xl ${
                streakFocusActive ? 'streak-focus-dim' : ''
              }`}
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
                <Route path="/auth/deeplink" element={<AuthDeeplinkPage />} />
                <Route path="/auth/link" element={<AuthLinkPage />} />
                <Route path="/character-lab" element={<CharacterLabPage />} />
                <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/feedback/thanks" element={<FeedbackThankYouPage />} />
                {isShareLinksEnabled() ? (
                  <Route path="/share/:code" element={<ShareDashboardPage />} />
                ) : null}
                {isDebugMode() ? (
                  <Route path="/debug/ui-playground" element={<UiPlaygroundPage />} />
                ) : null}
                <Route path="/archive" element={<ArchivePlaceholder />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </AnimatedRoutes>
            </main>
          </div>
        </div>
      )}

      {!shareRouteActive ? <BottomNav /> : null}
      {!shareRouteActive ? (
        <>
          <div className={streakFocusActive ? 'streak-focus-dim' : ''}>
            <AppLegalFooter />
          </div>
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
  onPackageAward,
}: {
  score: ReturnType<typeof getScoreSnapshot>
  incomingHint: string | null
  streakOutcome: StreakOutcomeAnimation | null
  focusActive: boolean
  onPackageAward: (delta: number, hint: string | null) => void
}) {
  const { mode, toggle } = useTheme()
  const { settings } = useAppSettings()
  const auth = useAuthOptional()
  const [syncBusy, setSyncBusy] = useState(false)

  useEffect(() => {
    return listenToBackgroundActivity((event) => {
      if (event.id !== 'sync') return
      setSyncBusy(event.type === 'start')
    })
  }, [])

  const syncStatusTone = auth?.syncError
    ? 'var(--danger)'
    : syncBusy
      ? '#3b82f6'
      : auth?.user && auth.syncEnabled
        ? 'var(--success)'
        : 'rgba(148, 163, 184, 0.9)'

  return (
    <>
      <header className={`w-full space-y-3 ${focusActive ? 'streak-focus-target' : ''}`}>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-start">
          <div className="flex flex-wrap items-start gap-3">
            <div className="paper flex items-center gap-3 rounded-2xl px-4 py-3 md:hidden">
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
              <div className="paper flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 md:hidden">
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
          </div>

          <div className="hidden min-h-[5rem] items-center justify-center md:flex md:justify-self-center">
            <PackageAlert onAward={onPackageAward} placement="inline" size="lg" />
          </div>

          <div className="flex items-start justify-between gap-3 md:justify-end md:justify-self-end">
            <div className="flex flex-1 items-center justify-between gap-3 md:hidden">
              <Link
                to="/feedback"
                className="paper focus-ring flex h-11 w-11 items-center justify-center rounded-full transition"
                aria-label="Open feedback form"
                title="Feedback form"
              >
                <SpeechBubbleIcon className="h-5 w-5" />
              </Link>
              <div className="flex min-h-[3rem] items-center justify-center">
                <PackageAlert onAward={onPackageAward} placement="inline" size="sm" />
              </div>
              <ThemeToggleButton mode={mode} onToggle={toggle} className="rounded-full" />
            </div>

            <div className="hidden items-start gap-2 md:flex">
              {!settings.disablePoints ? (
                <div className="paper flex items-center rounded-3xl px-3 py-2">
                  <ScoreTicker
                    total={score.total}
                    streak={score.streak}
                    streakFreezes={score.streakFreezes}
                    hint={incomingHint}
                    streakOutcome={streakOutcome}
                  />
                  <MobileHeaderMascot />
                </div>
              ) : null}

              <div className="flex flex-col gap-2">
                <Link
                  to="/settings#account-sync"
                  className="paper focus-ring flex h-12 w-12 items-center justify-center rounded-full border border-[var(--paper-border)]"
                  aria-label="Open account and sync settings"
                  title="Account and sync"
                  style={{
                    color: syncStatusTone,
                    boxShadow: `0 0 0 3px color-mix(in srgb, ${syncStatusTone} 25%, transparent), 0 0 22px color-mix(in srgb, ${syncStatusTone} 28%, transparent)`,
                  }}
                >
                  <MaterialIcon name="person" size={22} accent={false} />
                </Link>
                <Link
                  to="/feedback"
                  className="paper focus-ring flex h-12 w-12 items-center justify-center rounded-full"
                  aria-label="Open feedback form"
                  title="Feedback form"
                >
                  <SpeechBubbleIcon className="h-5 w-5" />
                </Link>
                <ThemeToggleButton mode={mode} onToggle={toggle} className="rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </header>
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
    <motion.button
      type="button"
      className={`focus-ring inline-flex items-center gap-2 rounded-xl border border-[var(--paper-border)] ${
        variant === 'menu' ? 'px-3 py-2' : 'p-2'
      } ${className ?? ''}`}
      onClick={onToggle}
      aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      whileTap={{ scale: 0.95 }}
    >
      <motion.img
        key={mode}
        alt=""
        src={publicUrl(mode === 'dark' ? '/asset/light.png' : '/asset/dark.png')}
        className="h-8 w-8 shrink-0 select-none object-contain"
        draggable={false}
        initial={{ rotate: -180, scale: 0.86 }}
        animate={{ rotate: 0, scale: 1 }}
        transition={{ duration: motionDuration(0.38) || 0 }}
      />
      {showLabel ? <span className="text-sm font-medium">{label}</span> : null}
    </motion.button>
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
      <div
        className="relative"
        onPointerDownCapture={composerLocked ? onBlockedComposerInteraction : undefined}
      >
        {composerLocked ? (
          <div className="absolute inset-x-0 top-0 z-20">
            <SyncOnboardingBanner shakeKey={shakeBanner} mode="overlay" />
          </div>
        ) : null}
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
            await waitForSync()
            const submitDateKey = dateKeyForLocalDay(new Date())
            const award = await awardForSubmission(submitDateKey)

            await Promise.all(
              drafts.map((draft) =>
                upsertEntryFromDraft({
                  ...draft,
                  dateKey: draft.dateKey,
                  scoreDelta: award.totalDelta,
                  streakAtSubmit: award.nextStreak,
                })
              )
            )

            await runPackageDeliveryAndNotify()
            emitBackgroundActivity({ type: 'start', id: 'sync', message: 'Syncing to cloud...' })
            pushLocalChangesNow().finally(() => {
              emitBackgroundActivity({ type: 'stop', id: 'sync', message: '' })
              emitBackgroundActivity({ type: 'start', id: 'index', message: 'Indexing for AI search...' })
              requestProjectorSearch({
                query: '',
                mode: 'index',
                forceIndex: true,
                userId: auth?.user?.uid || getOrCreateAnonSearchUserId(),
              })
                .catch(() => {})
                .finally(() => {
                  emitBackgroundActivity({ type: 'stop', id: 'index', message: '' })
                })
            })
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
