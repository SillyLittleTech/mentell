import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { splitHelplineResources } from './localResources/rankHelplines'
import { shouldReduceMotion } from '../../shared/motion/useMotionPrefs'
import type { RiskAssessment } from './riskAssessment'
import { fetchResourcesForTopics } from './localResources/fetchResources'
import { appendPooledScrapeResources } from './localResources/pooledScrape'
import { referencesForeignCounty } from './localResources/geoFilter'
import { formatPublicPlaceLabel } from './localResources/formatPlace'
import { emergencyBannerCopy } from './localResources/nationalResources'
import { partitionHospitalHelplines } from './localResources/hospitalHelplines'
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
import {
  COMMON_COUNTRY_OPTIONS,
  placeFromManual,
  type ManualLocationFields,
} from './localResources/manualPlace'

type PanelPhase = 'idle' | 'loading' | 'adjust' | 'results' | 'error'

const CONTACT_OPTIONS: { id: ContactMethodPreference; label: string }[] = [
  { id: 'any', label: 'Any (phone, text, chat, or web)' },
  { id: 'phone', label: 'Phone call' },
  { id: 'sms', label: 'Text message' },
  { id: 'chat', label: 'Online chat' },
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

function partitionPooled(resources: LocalResource[]) {
  const pooled: LocalResource[] = []
  const rest: LocalResource[] = []
  for (const resource of resources) {
    if (resource.kind === 'pooled') pooled.push(resource)
    else rest.push(resource)
  }
  return { pooled, rest }
}

function HelplineResourceGroups({
  resources,
  place,
}: {
  resources: LocalResource[]
  place: GeoPlace
}) {
  const { pooled, rest } = partitionPooled(resources)
  const { hospital, other } = partitionHospitalHelplines(rest)
  const grouped = splitHelplineResources(other, place)
  const local = grouped.local
  const broader = grouped.broader

  return (
    <>
      {local.length ? (
        <div className="grid gap-2">
          <p className="text-xs font-semibold">Closer to you</p>
          {local.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : null}
      {hospital.length ? (
        <div className="grid gap-2">
          <p className="text-xs font-semibold">Hospital &amp; emergency crisis lines</p>
          {hospital.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : null}
      {broader.length ? (
        <div className="grid gap-2">
          <p className="ink-muted text-xs font-semibold">Statewide &amp; national</p>
          {broader.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : null}
      {pooled.length ? (
        <div className="grid gap-2">
          <p className="text-xs font-semibold">Additional local suggestions (AI)</p>
          <p className="ink-muted text-[11px]">
            From the same AI service as crisis notes, using your area (ZIP/county). Verify phone numbers and
            hours before you rely on them.
          </p>
          {pooled.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : null}
      {!hospital.length && !local.length && !broader.length && !pooled.length ? (
        <p className="ink-muted text-sm">No matches in this area. Try Find A Helpline below.</p>
      ) : null}
      {!hospital.length ? (
        <p className="ink-muted text-[11px]">
          Some hospital crisis lines are not in public directories. If you need immediate help, call your local
          emergency number or go to the nearest emergency department.
        </p>
      ) : null}
    </>
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
  const heading =
    result.topic === 'suicide' ? 'Crisis & mental health lines' : topicLabel(result.topic)

  return (
    <section className="grid gap-2" aria-label={heading}>
      <h4 className="text-sm font-semibold">{heading}</h4>
      {result.error ? <p className="ink-muted text-sm">{result.error}</p> : null}
      {isHelplineTopic && place && result.resources.length ? (
        <HelplineResourceGroups resources={result.resources} place={place} />
      ) : result.resources.length && place ? (
        <div className="grid gap-2">
          {result.resources
            .filter(
              (resource) =>
                !referencesForeignCounty(
                  `${resource.name} ${resource.description ?? ''} ${resource.address ?? ''}`,
                  place,
                ),
            )
            .map((resource) => (
              <ResourceCard key={resource.id} resource={resource} />
            ))}
        </div>
      ) : result.resources.length ? (
        <div className="grid gap-2">
          {result.resources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : !result.error ? (
        <p className="ink-muted text-sm">No matches in this area. Try Find A Helpline below.</p>
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
  const flowAnchorRef = useRef<HTMLDivElement>(null)

  const [phase, setPhase] = useState<PanelPhase>('idle')
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
  const [homeCountry, setHomeCountry] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  const loading = phase === 'loading'
  const audienceCountry = (homeCountry ?? place?.countryCode ?? 'US').toUpperCase()

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

  function syncAdjustFormFromPlace(resolved: GeoPlace) {
    const code = resolved.countryCode.toUpperCase()
    const known = COMMON_COUNTRY_OPTIONS.some((option) => option.code === code)
    setCountryPick(known ? code : 'OTHER')
    setCountryOther(known ? '' : code)
    setRegionCode(resolved.regionCode ?? '')
    setZip(resolved.zip ?? '')
    setPlaceLabel(resolved.city ?? '')
  }

  function topicsForSearch() {
    return activeTopics.length ? activeTopics : inferredTopics
  }

  async function runFetch(
    resolvedPlace: GeoPlace,
    method: ContactMethodPreference,
    topics: ResourceTopic[],
  ) {
    setContactMethod(method)
    setPhase('loading')
    setLocating(false)
    setErrorMessage(null)
    setResults([])
    setPlace(resolvedPlace)
    setHomeCountry(resolvedPlace.countryCode)
    try {
      const fetched = await fetchResourcesForTopics({
        place: resolvedPlace,
        topics,
        contactMethod: method,
      })
      const withPooled = await appendPooledScrapeResources(fetched, resolvedPlace, topics)
      setResults(withPooled)
      setPhase('results')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Something went wrong.')
      setPhase('error')
    }
  }

  function openAdjust(hint?: string) {
    setLocationHint(hint ?? null)
    setActiveTopics((prev) => (prev.length ? prev : inferredTopics))
    if (place) syncAdjustFormFromPlace(place)
    setPhase('adjust')
  }

  async function submitAdjust() {
    try {
      const resolvedPlace = await placeFromManual(manualFields())
      setPlace(resolvedPlace)
      const topics =
        resolvedPlace.countryCode === 'US'
          ? topicsForSearch()
          : topicsForSearch().filter((t) => t === 'suicide' || t === 'mental_health')
      if (resolvedPlace.countryCode !== 'US' && !topics.length) {
        setActiveTopics(['mental_health', 'suicide'])
      }
      await runFetch(resolvedPlace, contactMethod, topics.length ? topics : ['mental_health'])
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not use that location.')
      setPhase('error')
    }
  }

  function beginLocalSearch() {
    void (async () => {
      setActiveTopics(inferredTopics)
      setPhase('loading')
      setLocating(true)
      setErrorMessage(null)
      setLocationHint(null)
      try {
        const resolvedPlace = await resolveCoordinates()
        setPlace(resolvedPlace)
        syncAdjustFormFromPlace(resolvedPlace)
        const topics =
          resolvedPlace.countryCode === 'US'
            ? inferredTopics
            : ['mental_health', 'suicide'] as ResourceTopic[]
        await runFetch(resolvedPlace, 'any', topics)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not read your location.'
        setErrorMessage(message)
        openAdjust(message)
      } finally {
        setLocating(false)
      }
    })()
  }

  function toggleTopic(topic: ResourceTopic) {
    setActiveTopics((prev) =>
      prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic],
    )
  }

  const publicPlaceLabel = formatPublicPlaceLabel(place)
  const emergency = emergencyBannerCopy(audienceCountry)

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
        {emergency.lead}
        {emergency.hotline ? (
          <>
            {' '}
            <strong>{emergency.hotline}</strong>, or chat at{' '}
          </>
        ) : (
          ' '
        )}
        <a className="underline" href={emergency.href} target="_blank" rel="noreferrer">
          {emergency.linkLabel}
        </a>
        .
      </p>

      <section className="grid gap-2" aria-labelledby={actionsHeadingId}>
        <h3 id={actionsHeadingId} className="text-sm font-semibold">
          Find help near you
        </h3>
        <button
          type="button"
          className={`${actionButtonClass(compact)} w-fit`}
          aria-label="Find local and regional resources using your location"
          disabled={loading}
          onClick={beginLocalSearch}
        >
          Find local &amp; regional resources
        </button>
        <button
          type="button"
          className="focus-ring ink-muted w-fit text-xs underline"
          aria-label="Adjust country, region, topics, or contact preferences"
          disabled={loading}
          onClick={() => openAdjust()}
        >
          Something not right?
        </button>
      </section>

      {showFlowPanel ? (
        <div id="local-resources-flow" ref={flowAnchorRef} className="grid gap-3">
          {phase === 'adjust' ? (
            <section
              className="grid gap-2 rounded-2xl border border-[var(--paper-border)] p-3"
              aria-label="Adjust search settings"
            >
              <h4 className="text-sm font-semibold">Adjust your search</h4>
              {locationHint ? (
                <p className="text-sm" style={{ color: 'var(--danger)' }}>
                  {locationHint}
                </p>
              ) : (
                <p className="ink-muted text-xs">
                  Update your country, area, topics, or how you prefer to connect. US searches can include food
                  pantries and housing counseling.
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
                  Country code (two letters)
                  <input
                    className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
                    value={countryOther}
                    onChange={(e) => setCountryOther(e.target.value)}
                    maxLength={2}
                  />
                </label>
              ) : null}
              <label className="grid gap-1 text-xs">
                State / province / region
                <input
                  className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
                  value={regionCode}
                  onChange={(e) => setRegionCode(e.target.value)}
                  placeholder="PA, BC, ON…"
                />
              </label>
              <label className="grid gap-1 text-xs">
                City or neighborhood
                <input
                  className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
                  value={placeLabel}
                  onChange={(e) => setPlaceLabel(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs">
                ZIP / postal code (helps US food search)
                <input
                  className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs">
                Preferred contact method
                <select
                  className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1.5"
                  value={contactMethod}
                  onChange={(e) => setContactMethod(e.target.value as ContactMethodPreference)}
                >
                  {CONTACT_OPTIONS.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className={actionButtonClass(compact)}
                  aria-label="Search with these settings"
                  onClick={() => void submitAdjust()}
                >
                  Search with these settings
                </button>
                <button
                  type="button"
                  className="focus-ring ink-muted text-xs underline"
                  onClick={() => {
                    void (async () => {
                      try {
                        const resolved = await resolveCoordinates()
                        setPlace(resolved)
                        syncAdjustFormFromPlace(resolved)
                        setHomeCountry(resolved.countryCode)
                      } catch (err) {
                        setLocationHint(
                          err instanceof Error ? err.message : 'Could not read your location.',
                        )
                      }
                    })()
                  }}
                >
                  Use my location
                </button>
                <button
                  type="button"
                  className="focus-ring ink-muted text-xs underline"
                  onClick={() => setPhase(results.length ? 'results' : 'idle')}
                >
                  Cancel
                </button>
              </div>
            </section>
          ) : null}

          {phase === 'loading' ? (
            <div className="rounded-2xl border border-[var(--paper-border)] p-3" role="status" aria-live="polite">
              <p className="font-semibold">
                {locating ? 'Getting your location…' : 'Loading resources near you…'}
              </p>
              <p className="ink-muted mt-1">
                {locating
                  ? 'Mentell uses your location to find nearby crisis and community resources.'
                  : 'Contacting regional directories.'}
              </p>
            </div>
          ) : null}

          {phase === 'error' ? (
            <div className="grid gap-2 rounded-2xl border border-[var(--danger)]/40 p-3">
              <p className="font-semibold" style={{ color: 'var(--danger)' }}>
                {errorMessage}
              </p>
          <p className="ink-muted">
            You can still use{' '}
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
                  className="focus-ring ink-muted text-xs underline"
                  aria-label="Adjust search settings"
                  onClick={() => openAdjust()}
                >
                  Something not right?
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
                {publicPlaceLabel ? <p className="ink-muted mt-1 text-xs">{publicPlaceLabel}</p> : null}
              </div>
              {results.map((result, index) => (
                <ResultSection key={`${result.topic}-${index}`} result={result} place={place} />
              ))}
              <button
                type="button"
                className="focus-ring ink-muted w-fit text-xs underline"
                aria-label="Adjust search settings"
                onClick={() => openAdjust()}
              >
                Something not right?
              </button>
            </section>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <a className="underline" href="https://findahelpline.com/" target="_blank" rel="noreferrer">
          Find A Helpline (worldwide)
        </a>
        {audienceCountry === 'US' ? (
          <a className="underline" href="https://www.usa.gov/mental-health" target="_blank" rel="noreferrer">
            USAGov mental health
          </a>
        ) : null}
      </div>
    </div>
  )
}
