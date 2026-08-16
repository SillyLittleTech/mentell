import { Link, Navigate, Route, useLocation } from 'react-router-dom'
import { AnimatedRoutes } from './shared/motion/AnimatedRoutes'
import { AnimatePresence, LayoutGroup } from 'framer-motion'
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
import { isTauri } from './shared/platform/runtime'
import { syncTauriDeliverySchedule } from './pwa/tauriNotifications'
import { ScoreTicker } from './features/score/ScoreTicker'
import { ScoreBurst } from './features/score/ScoreBurst'
import { Shoppe } from './features/shop/Shoppe'
import { SettingsPage } from './features/settings/SettingsPage'
import { useAppSettings } from './shared/settings/useAppSettings'
import { publicUrl } from './shared/publicUrl'
import { SCORE_CHANGED_EVENT } from './features/score/scoreEvents'
import { ShareDashboardPage } from './features/share/ShareDashboardPage'
import { SyncOnboardingBanner } from './features/settings/SyncOnboardingBanner'
import { VerifyEmailPage } from './features/settings/VerifyEmailPage'
import { AppLegalFooter } from './components/AppLegalFooter'
import { PrivacyPolicyPage } from './features/legal/PrivacyPolicyPage'
import { FeedbackPage, FeedbackThankYouPage } from './features/feedback/FeedbackPage'
import { SpeechBubbleIcon } from './components/SpeechBubbleIcon'
import { CharacterLabPage } from './features/character/CharacterLabPage'
import { DeskCharacterLayout } from './features/character/DeskCharacterLayout'
import { MobileHeaderMascot } from './features/character/MobileHeaderMascot'
import { AccountButton } from './components/shell/AccountButton'
import { CharacterTabIconSync } from './features/character/CharacterTabIconSync'
import { AuthDeeplinkPage } from './features/auth/AuthDeeplinkPage'
import { AuthLinkPage } from './features/auth/AuthLinkPage'
import { EmailLinkDesktopHandoff } from './features/auth/EmailLinkDesktopHandoff'
import { isFirebaseSyncEnabled, isShareLinksEnabled } from './shared/features/featureFlags'
import { isDebugMode } from './shared/debug/debugFlags'
import { useAuthOptional } from './shared/firebase/AuthProvider'
import { ShopCosmeticEffects } from './features/shop/shopCosmetics'
import { getOrCreateAnonSearchUserId, requestProjectorSearch } from './features/compilation/projectorSearch'
import { emitBackgroundActivity } from './shared/backgroundActivity'
import { scrollToTop } from './shared/motion/scroll'
import { motionDuration } from './shared/motion/useMotionPrefs'
import { SidebarNav } from './components/shell/SidebarNav'
import { BottomNav } from './components/shell/BottomNav'
import { RightRail } from './components/shell/RightRail'
import { DeskSpotlight } from './components/shell/DeskSpotlight'
import { ThemeToggleButton } from './components/ThemeToggleButton'
import { HomeGreeting } from './features/home/HomeGreeting'

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
    if (isTauri()) {
      void syncTauriDeliverySchedule()
    } else if (!loadAppSettings().disableNotifications && isWebPushConfigured()) {
      void syncPushSubscription()
    }
  }, [])

  const auth = useAuthOptional()
  const authUid = auth?.user?.uid

  useEffect(() => {
    if (authUid && !isTauri() && !loadAppSettings().disableNotifications && isWebPushConfigured()) {
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
    <LayoutGroup>
    <div
      className={
        shareRouteActive
          ? 'min-h-[100svh]'
          : 'desk px-4 py-6 pb-24 md:pb-6'
      }
    >
      <EmailLinkDesktopHandoff />
      {!shareRouteActive ? <CharacterTabIconSync /> : null}
      {!shareRouteActive ? <ShopCosmeticEffects /> : null}
      {!shareRouteActive ? <StickyLayer /> : null}
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
            <Route path="/verify" element={<VerifyEmailPage />} />
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
        <div className="mx-auto w-full max-w-6xl md:grid md:grid-cols-[16rem_1fr_auto] md:gap-6">
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
              className={`relative mt-6 w-full max-w-4xl overflow-visible ${
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
                <Route path="/verify" element={<VerifyEmailPage />} />
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

          <RightRail />
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
    </LayoutGroup>
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
  const location = useLocation()
  const onHome = location.pathname === '/'

  return (
    <>
      <header className={`w-full space-y-3 overflow-visible ${focusActive ? 'streak-focus-target' : ''}`}>
        <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-start">
          <div className="flex min-w-0 flex-wrap items-start gap-3">
            <div className="relative z-0 hidden min-h-[5rem] min-w-0 flex-1 items-center overflow-visible md:flex">
              {onHome ? <HomeGreeting variant="desktop" /> : null}
            </div>
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
          </div>

          <div className="relative z-10 hidden min-h-[5rem] items-center justify-center md:flex md:justify-self-center">
            <PackageAlert onAward={onPackageAward} placement="inline" size="lg" />
          </div>

          <div className="flex items-start justify-between gap-3 md:justify-end md:justify-self-end">
            <div className="grid flex-1 grid-cols-[1fr_auto] items-center gap-3 md:hidden">
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
                <div className="paper flex items-center rounded-2xl px-2 py-1">
                  <MobileHeaderMascot />
                </div>
              )}
              <AccountButton />
              <div className="flex min-h-[3rem] items-center justify-between gap-3">
                <Link
                  to="/feedback"
                  className="paper focus-ring flex h-11 w-11 items-center justify-center rounded-full transition"
                  aria-label="Open feedback form"
                  title="Feedback form"
                >
                  <SpeechBubbleIcon className="h-5 w-5" />
                </Link>
                <PackageAlert onAward={onPackageAward} placement="inline" size="sm" />
              </div>
              <ThemeToggleButton mode={mode} onToggle={toggle} className="rounded-full" />
            </div>

            <div className="hidden md:flex">
              {!settings.disablePoints ? (
                <ScoreTicker
                  total={score.total}
                  streak={score.streak}
                  streakFreezes={score.streakFreezes}
                  hint={incomingHint}
                  streakOutcome={streakOutcome}
                />
              ) : null}
            </div>
          </div>
        </div>
      </header>
    </>
  )
}

function PaperSection({
  title,
  subtitle,
  children,
}: {
  title: React.ReactNode
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
      title={
        <>
          <span className="hidden md:inline">Draft today’s letter</span>
          <span className="md:hidden">
            <HomeGreeting variant="mobile" fallback="Draft today’s letter" />
          </span>
        </>
      }
      subtitle="Draft it like stationery — then review and submit."
    >
      <DeskCharacterLayout>
      <div
        className="relative"
        onPointerDownCapture={composerLocked ? onBlockedComposerInteraction : undefined}
      >
        {composerLocked ? (
          <div className="absolute inset-x-0 top-32 z-20 sm:top-36">
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
