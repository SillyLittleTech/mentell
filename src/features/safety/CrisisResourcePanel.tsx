import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { splitHelplineResources } from './localResources/rankHelplines'
import { shouldReduceMotion } from '../../shared/motion/useMotionPrefs'
import type { RiskAssessment } from './riskAssessment'
import { fetchResourcesForTopics, staticUsResources } from './localResources/fetchResources'
import {
  ALL_RESOURCE_TOPICS,
  inferResourceTopics,
  topicLabel,
} from './localResources/inferTopics'
import { resolveCoordinates } from './localResources/geocode'
import type {
  ContactMethodPreference,
  GeoPlace,
  LocalResource,
  LocalResourceFetchResult,
  ResourceTopic,
} from './localResources/types'
import { loadDebugLocationOverride } from './localResources/debugLocation'
import { isDebugMode } from '../../shared/debug/debugFlags'
import {
  COMMON_COUNTRY_OPTIONS,
  placeFromManual,
  type ManualLocationFields,
} from './localResources/manualPlace'

type PanelPhase =
  | 'idle'
  | 'pickContact'
  | 'internationalSetup'
  | 'manualAdjust'
  | 'loading'
  | 'results'
  | 'error'

type SearchFlow = 'local' | 'international' | 'manual'

const CONTACT_OPTIONS: { id: ContactMethodPreference; label: string; hint: string }[] = [
  { id: 'any', label: 'Any way to reach them', hint: 'Phone, text, chat, or web' },
  { id: 'phone', label: 'Phone call', hint: 'Voice lines only' },
  { id: 'sms', label: 'Text message', hint: 'SMS or text-in lines' },
  { id: 'chat', label: 'Online chat', hint: 'Web chat when available' },
]

function telHref(value: string) {
  const digits = value.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : undefined
}

function ResourceActions({ resource }: { resource: LocalResource }) {
  const phoneHref = resource.phone ? telHref(resource.phone) : undefined
  return (
    <div className="flex flex-wrap gap-2">
      {phoneHref ? (
        <a
          className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-1.5 font-semibold"
          href={phoneHref}
        >
          Call
        </a>
      ) : null}
      {resource.sms ? (
        <a
          className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-1.5 font-semibold"
          href={`sms:${resource.sms.replace(/\s+/g, '')}`}
        >
          Text
        </a>
      ) : null}
      {resource.chatUrl ? (
        <a
          className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-1.5 font-semibold"
          href={resource.chatUrl}
          target="_blank"
          rel="noreferrer"
        >
          Chat
        </a>
      ) : null}
      {resource.website ? (
        <a
          className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-1.5 font-semibold"
          href={resource.website}
          target="_blank"
          rel="noreferrer"
        >
          Website
        </a>
      ) : null}
    </div>
  )
}

function ResourceCard({ resource }: { resource: LocalResource }) {
  return (
    <article className="rounded-2xl border border-[var(--paper-border)] bg-[var(--paper-bg)] p-3">
      <p className="font-semibold">{resource.name}</p>
      {resource.description ? <p className="ink-muted mt-1">{resource.description}</p> : null}
      {resource.address ? <p className="mt-1 text-sm">{resource.address}</p> : null}
      {resource.hours ? <p className="ink-muted mt-1 text-xs">Hours: {resource.hours}</p> : null}
      <div className="mt-2">
        <ResourceActions resource={resource} />
      </div>
      <p className="ink-muted mt-2 text-[11px]">Source: {resource.sourceLabel}</p>
    </article>
  )
}

function ResultSection({
  result,
  place,
}: {
  result: LocalResourceFetchResult
  place: GeoPlace | null
}) {
  const isHelplineTopic = result.topic === 'suicide' || result.topic === 'mental_health'
  const grouped =
    isHelplineTopic && place && result.resources.length
      ? splitHelplineResources(result.resources, place)
      : null

  return (
    <section className="grid gap-2" aria-label={topicLabel(result.topic)}>
      <h4 className="text-sm font-semibold">{topicLabel(result.topic)}</h4>
      {result.error ? <p className="ink-muted text-sm">{result.error}</p> : null}
      {grouped ? (
        <>
          {grouped.local.length ? (
            <div className="grid gap-2">
              <p className="text-xs font-semibold">Closer to you</p>
              {grouped.local.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          ) : null}
          {grouped.broader.length ? (
            <div className="grid gap-2">
              <p className="ink-muted text-xs font-semibold">Statewide &amp; national</p>
              {grouped.broader.map((resource) => (
                <ResourceCard key={resource.id} resource={resource} />
              ))}
            </div>
          ) : null}
          {!grouped.local.length && !grouped.broader.length ? (
            <p className="ink-muted text-sm">No matches in this area. Try 211 or the national lines below.</p>
          ) : null}
          <p className="ink-muted text-[11px]">
            Hospital-specific crisis lines (for example UPMC) may not appear in public directories. Call 988 or
            your nearest emergency department if you need immediate help.
          </p>
        </>
      ) : result.resources.length ? (
        <div className="grid gap-2">
          {result.resources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : !result.error ? (
        <p className="ink-muted text-sm">No matches in this area. Try 211 or the national lines below.</p>
      ) : null}
    </section>
  )
}

function actionButtonClass(compact: boolean) {
  return `focus-ring rounded-xl border border-[var(--paper-border)] px-3 font-semibold ${
    compact ? 'py-1.5 text-xs' : 'py-2 text-sm'
  }`
}

export function CrisisResourcePanel({
  compact = false,
  risk,
}: {
  compact?: boolean
  risk?: Pick<RiskAssessment, 'reasons' | 'flaggedTerms' | 'responseKind'>
}) {
  const inferredTopics = useMemo(
    () =>
      inferResourceTopics({
        reasons: risk?.reasons,
        flaggedTerms: risk?.flaggedTerms,
        responseKind: risk?.responseKind,
      }),
    [risk?.reasons, risk?.flaggedTerms, risk?.responseKind],
  )

  const actionsHeadingId = useId()
  const nationalHeadingId = useId()
  const flowAnchorRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<PanelPhase>('idle')
  const [searchFlow, setSearchFlow] = useState<SearchFlow>('local')
  const [activeTopics, setActiveTopics] = useState<ResourceTopic[]>(inferredTopics)
  const [contactMethod, setContactMethod] = useState<ContactMethodPreference>('any')
  const [place, setPlace] = useState<GeoPlace | null>(null)
  const [results, setResults] = useState<LocalResourceFetchResult[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [locationHint, setLocationHint] = useState<string | null>(null)

  const [countryPick, setCountryPick] = useState('US')
  const [countryOther, setCountryOther] = useState('')
  const [regionCode, setRegionCode] = useState('')
  const [zip, setZip] = useState('')
  const [placeLabel, setPlaceLabel] = useState('')

  const debugOverride = isDebugMode() ? loadDebugLocationOverride() : null
  const loading = phase === 'loading'

  function resolvedCountryCode() {
    if (countryPick === 'OTHER') return countryOther.trim().toUpperCase()
    return countryPick
  }

  function manualFields(): ManualLocationFields {
    return {
      countryCode: resolvedCountryCode(),
      regionCode: regionCode.trim() || undefined,
      zip: zip.trim() || undefined,
      placeLabel: placeLabel.trim() || undefined,
    }
  }

  async function runFetch(
    resolvedPlace: GeoPlace,
    method: ContactMethodPreference,
    topics: ResourceTopic[],
  ) {
    setContactMethod(method)
    setPhase('loading')
    setErrorMessage(null)
    setResults([])
    setPlace(resolvedPlace)
    try {
      const fetched = await fetchResourcesForTopics({
        place: resolvedPlace,
        topics,
        contactMethod: method,
      })
      setResults(fetched)
      setPhase('results')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.')
      setPhase('error')
    }
  }

  async function loadWithGeolocation(method: ContactMethodPreference, topics: ResourceTopic[]) {
    setPhase('loading')
    setErrorMessage(null)
    setLocationHint(null)
    try {
      const resolvedPlace = await resolveCoordinates()
      await runFetch(resolvedPlace, method, topics)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not read your location.'
      setErrorMessage(message)
      setLocationHint(message)
      setPhase('manualAdjust')
    }
  }

  async function loadWithManual(method: ContactMethodPreference, topics: ResourceTopic[]) {
    try {
      const resolvedPlace = await placeFromManual(manualFields())
      await runFetch(resolvedPlace, method, topics)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not use that location.')
      setPhase('error')
    }
  }

  function beginLocalSearch() {
    setSearchFlow('local')
    setActiveTopics(inferredTopics)
    setPhase('pickContact')
  }

  function beginInternational() {
    setSearchFlow('international')
    setCountryPick('CA')
    setCountryOther('')
    setPhase('internationalSetup')
  }

  function beginManualAdjust() {
    setSearchFlow('manual')
    setActiveTopics((prev) => (prev.length ? prev : inferredTopics))
    if (place) {
      setCountryPick(place.countryCode === 'US' ? 'US' : 'OTHER')
      setCountryOther(place.countryCode === 'US' ? '' : place.countryCode)
      setRegionCode(place.regionCode ?? '')
      setZip(place.zip ?? '')
      setPlaceLabel(place.city ?? place.displayName ?? '')
    }
    setPhase('manualAdjust')
  }

  function toggleTopic(topic: ResourceTopic) {
    setActiveTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    )
  }

  const staticResources = staticUsResources()
  const regionHint =
    place?.regionCode ?? debugOverride?.regionCode ?? (place?.countryCode === 'US' ? 'US' : place?.countryCode)
  const topicsForSearch =
    activeTopics.length > 0
      ? activeTopics
      : searchFlow === 'international'
        ? (['mental_health'] as ResourceTopic[])
        : inferredTopics

  const showFlowPanel = phase !== 'idle'

  useEffect(() => {
    if (!showFlowPanel) return
    flowAnchorRef.current?.scrollIntoView({
      behavior: shouldReduceMotion() ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [phase, showFlowPanel])

  return (
    <div className={`grid gap-3 ${compact ? 'text-xs' : 'text-sm'}`}>
      <p>
        If you might be in immediate danger, call emergency services now. In the United States, call or text{' '}
        <strong>988</strong>, or chat at{' '}
        <a className="underline" href="https://988lifeline.org/chat/" target="_blank" rel="noreferrer">
          988lifeline.org
        </a>
        .
      </p>

      <section className="grid gap-2" aria-labelledby={actionsHeadingId}>
        <h3 id={actionsHeadingId} className="text-sm font-semibold">
          Find help near you
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={actionButtonClass(compact)}
            aria-label="Find local and regional resources using your location"
            disabled={loading}
            onClick={beginLocalSearch}
          >
            Find local &amp; regional resources
          </button>
          <button
            type="button"
            className={`${actionButtonClass(compact)} ink-muted`}
            aria-label="Adjust region or topics manually"
            disabled={loading}
            onClick={beginManualAdjust}
          >
            Something not right?
          </button>
        </div>
      </section>

      {showFlowPanel ? (
      <div id="local-resources-flow" ref={flowAnchorRef} className="grid gap-3">
      {phase === 'pickContact' ? (
        <section
          className="grid gap-2 rounded-2xl border border-[var(--paper-border)] p-3"
          aria-label="Choose how to connect"
        >
          <h4 className="text-sm font-semibold">How do you want to connect?</h4>
          <p className="ink-muted text-xs">
            {searchFlow === 'international'
              ? 'Loading helplines for your country'
              : `Mentell will use your location${debugOverride ? ' (debug override on)' : ''} for ${topicsForSearch.map(topicLabel).join(', ')}.`}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CONTACT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-2 text-left"
                aria-label={`Connect via ${option.label}`}
                onClick={() => {
                  if (searchFlow === 'manual') {
                    void loadWithManual(option.id, topicsForSearch)
                    return
                  }
                  if (searchFlow === 'international') {
                    void (async () => {
                      try {
                        const resolvedPlace = await placeFromManual(manualFields())
                        await runFetch(resolvedPlace, option.id, topicsForSearch)
                      } catch (err) {
                        setErrorMessage(err instanceof Error ? err.message : 'Invalid country.')
                        setPhase('error')
                      }
                    })()
                    return
                  }
                  void loadWithGeolocation(option.id, topicsForSearch)
                }}
              >
                <span className="block font-semibold">{option.label}</span>
                <span className="ink-muted block text-xs">{option.hint}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="focus-ring ink-muted w-fit text-xs underline"
            onClick={() => setPhase('idle')}
          >
            Close
          </button>
        </section>
      ) : null}

      {phase === 'internationalSetup' ? (
        <section
          className="grid gap-2 rounded-2xl border border-[var(--paper-border)] p-3"
          aria-label="Resources outside the United States"
        >
          <h4 className="text-sm font-semibold">Resources outside the US</h4>
          <p className="ink-muted text-xs">
            Pick your country, optionally add a region or city, then choose how you want to connect.
            Mentell uses Global Helplines for national and regional crisis lines worldwide.
          </p>
          <label className="grid gap-1 text-xs">
            Country
            <select
              className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
              value={countryPick}
              onChange={(e) => setCountryPick(e.target.value)}
            >
              {COMMON_COUNTRY_OPTIONS.filter((c) => c.code !== 'US').map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {countryPick === 'OTHER' ? (
            <label className="grid gap-1 text-xs">
              Country code (two letters)
              <input
                className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
                value={countryOther}
                onChange={(e) => setCountryOther(e.target.value)}
                placeholder="GB"
                maxLength={2}
              />
            </label>
          ) : null}
          <label className="grid gap-1 text-xs">
            Region / province (optional)
            <input
              className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              placeholder="ON, ENG, NSW…"
            />
          </label>
          <label className="grid gap-1 text-xs">
            City or area (optional)
            <input
              className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
              value={placeLabel}
              onChange={(e) => setPlaceLabel(e.target.value)}
              placeholder="Toronto, London…"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={actionButtonClass(compact)}
              aria-label="Use device location for country and region"
              onClick={() => {
                setActiveTopics(['mental_health', 'suicide'])
                void (async () => {
                  try {
                    const resolved = await resolveCoordinates()
                    setCountryPick(resolved.countryCode === 'US' ? 'OTHER' : resolved.countryCode)
                    setCountryOther(resolved.countryCode)
                    setRegionCode(resolved.regionCode ?? '')
                    setPlaceLabel(resolved.displayName ?? '')
                    setSearchFlow('international')
                    setPhase('pickContact')
                  } catch {
                    setPhase('pickContact')
                  }
                })()
              }}
            >
              Use my location
            </button>
            <button
              type="button"
              className={actionButtonClass(compact)}
              aria-label="Continue to contact preferences"
              onClick={() => {
                setActiveTopics(['mental_health', 'suicide'])
                setPhase('pickContact')
              }}
            >
              Continue
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'manualAdjust' ? (
        <section
          className="grid gap-2 rounded-2xl border border-[var(--paper-border)] p-3"
          aria-label="Adjust location and topics"
        >
          <h4 className="text-sm font-semibold">Adjust location &amp; topics</h4>
          {locationHint ? (
            <p className="text-sm" style={{ color: 'var(--danger)' }}>
              {locationHint} Enter your area below instead.
            </p>
          ) : (
            <p className="ink-muted text-xs">
              Choose what to search for and where. US entries can include food pantries and HUD housing help.
            </p>
          )}
          <fieldset className="grid gap-2">
            <legend className="text-xs font-semibold">Topics</legend>
            {ALL_RESOURCE_TOPICS.map((topic) => (
              <label key={topic} className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={activeTopics.includes(topic)}
                  onChange={() => toggleTopic(topic)}
                />
                {topicLabel(topic)}
              </label>
            ))}
          </fieldset>
          <label className="grid gap-1 text-xs">
            Country
            <select
              className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
              value={countryPick}
              onChange={(e) => setCountryPick(e.target.value)}
            >
              {COMMON_COUNTRY_OPTIONS.map((option) => (
                <option key={option.code} value={option.code}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {countryPick === 'OTHER' ? (
            <label className="grid gap-1 text-xs">
              Country code
              <input
                className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
                value={countryOther}
                onChange={(e) => setCountryOther(e.target.value)}
                maxLength={2}
              />
            </label>
          ) : null}
          <label className="grid gap-1 text-xs">
            State / region
            <input
              className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
              value={regionCode}
              onChange={(e) => setRegionCode(e.target.value)}
              placeholder="PA, CA, ON…"
            />
          </label>
          <label className="grid gap-1 text-xs">
            ZIP / postal code (US food search)
            <input
              className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
              value={zip}
              onChange={(e) => setZip(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs">
            City or neighborhood (optional)
            <input
              className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
              value={placeLabel}
              onChange={(e) => setPlaceLabel(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={actionButtonClass(compact)}
              aria-label="Search with manual location"
              onClick={() => {
                setSearchFlow('manual')
                setPhase('pickContact')
              }}
            >
              Choose contact method
            </button>
            <button
              type="button"
              className="focus-ring ink-muted text-xs underline"
              onClick={() => setPhase('idle')}
            >
              Cancel
            </button>
          </div>
        </section>
      ) : null}

      {phase === 'loading' ? (
        <div className="rounded-2xl border border-[var(--paper-border)] p-3" role="status" aria-live="polite">
          <p className="font-semibold">Loading resources near you…</p>
          <p className="ink-muted mt-1">
            Contacting regional directories ({contactMethod === 'any' ? 'all contact types' : contactMethod}).
          </p>
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="grid gap-2 rounded-2xl border border-[var(--danger)]/40 p-3">
          <p className="font-semibold" style={{ color: 'var(--danger)' }}>
            {errorMessage}
          </p>
          <p className="ink-muted">
            You can still use 988, NAMI, or{' '}
            <a className="underline" href="https://findahelpline.com/" target="_blank" rel="noreferrer">
              Find A Helpline
            </a>{' '}
            worldwide.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={actionButtonClass(compact)}
              aria-label="Try finding resources again"
              onClick={beginLocalSearch}
            >
              Try again
            </button>
            <button
              type="button"
              className={actionButtonClass(compact)}
              aria-label="Enter location manually"
              onClick={beginManualAdjust}
            >
              Enter location manually
            </button>
          </div>
        </div>
      ) : null}

      {phase === 'results' ? (
        <section
          className="grid gap-3 rounded-2xl border border-[var(--paper-border)] p-3"
          aria-label="Resources near you"
        >
          <div>
            <h4 className="text-sm font-semibold">Resources near you</h4>
            {place?.displayName ? (
              <p className="ink-muted mt-1 text-xs">{place.displayName}</p>
            ) : regionHint ? (
              <p className="ink-muted mt-1 text-xs">Region: {regionHint}</p>
            ) : null}
          </div>
          {results.map((result) => (
            <ResultSection key={result.topic} result={result} place={place} />
          ))}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={actionButtonClass(compact)}
              aria-label="Change contact preference"
              onClick={() => setPhase('pickContact')}
            >
              Change contact preference
            </button>
            <button
              type="button"
              className={`${actionButtonClass(compact)} ink-muted`}
              aria-label="Adjust region or topics"
              onClick={beginManualAdjust}
            >
              Something not right?
            </button>
          </div>
        </section>
      ) : null}
      </div>
      ) : null}

      <section
        className="grid gap-2 rounded-2xl border border-[var(--paper-border)] p-3"
        aria-labelledby={nationalHeadingId}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 id={nationalHeadingId} className="text-sm font-semibold">
            National lines (United States)
          </h3>
          <button
            type="button"
            className={`${actionButtonClass(compact)} ink-muted`}
            aria-label="I am not in the United States"
            disabled={loading}
            onClick={beginInternational}
          >
            Not in the US?
          </button>
        </div>
        <div className="grid gap-2">
          {staticResources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <a className="underline" href="https://findahelpline.com/" target="_blank" rel="noreferrer">
          Find A Helpline (worldwide)
        </a>
        <a className="underline" href="https://www.usa.gov/mental-health" target="_blank" rel="noreferrer">
          USAGov mental health
        </a>
      </div>
    </div>
  )
}
