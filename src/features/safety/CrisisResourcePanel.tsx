import { useMemo, useState } from 'react'
import type { RiskAssessment } from './riskAssessment'
import { fetchResourcesForTopics, staticUsResources } from './localResources/fetchResources'
import { inferResourceTopics, topicLabel } from './localResources/inferTopics'
import { resolveCoordinates } from './localResources/geocode'
import type {
  ContactMethodPreference,
  GeoPlace,
  LocalResource,
  LocalResourceFetchResult,
} from './localResources/types'
import { loadDebugLocationOverride } from './localResources/debugLocation'
import { isDebugMode } from '../../shared/debug/debugFlags'

type PanelPhase = 'idle' | 'pickContact' | 'loading' | 'results' | 'error'

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
      <div className="font-semibold">{resource.name}</div>
      {resource.description ? <div className="ink-muted mt-1">{resource.description}</div> : null}
      {resource.address ? <div className="mt-1 text-sm">{resource.address}</div> : null}
      {resource.hours ? <div className="ink-muted mt-1 text-xs">Hours: {resource.hours}</div> : null}
      <div className="mt-2">
        <ResourceActions resource={resource} />
      </div>
      <div className="ink-muted mt-2 text-[11px]">Source: {resource.sourceLabel}</div>
    </article>
  )
}

function ResultSection({ result }: { result: LocalResourceFetchResult }) {
  return (
    <section className="grid gap-2">
      <h4 className="text-sm font-semibold">{topicLabel(result.topic)}</h4>
      {result.error ? <div className="ink-muted text-sm">{result.error}</div> : null}
      {result.resources.length ? (
        <div className="grid gap-2">
          {result.resources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      ) : !result.error ? (
        <div className="ink-muted text-sm">No matches in this area. Try 211 or the national lines below.</div>
      ) : null}
    </section>
  )
}

export function CrisisResourcePanel({
  compact = false,
  risk,
}: {
  compact?: boolean
  risk?: Pick<RiskAssessment, 'reasons' | 'flaggedTerms' | 'responseKind'>
}) {
  const topics = useMemo(
    () =>
      inferResourceTopics({
        reasons: risk?.reasons,
        flaggedTerms: risk?.flaggedTerms,
        responseKind: risk?.responseKind,
      }),
    [risk?.reasons, risk?.flaggedTerms, risk?.responseKind],
  )

  const [phase, setPhase] = useState<PanelPhase>('idle')
  const [contactMethod, setContactMethod] = useState<ContactMethodPreference>('any')
  const [place, setPlace] = useState<GeoPlace | null>(null)
  const [results, setResults] = useState<LocalResourceFetchResult[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const debugOverride = isDebugMode() ? loadDebugLocationOverride() : null

  async function loadResources(method: ContactMethodPreference) {
    setContactMethod(method)
    setPhase('loading')
    setErrorMessage(null)
    setResults([])
    try {
      const resolvedPlace = await resolveCoordinates()
      setPlace(resolvedPlace)
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

  function beginLocalSearch() {
    setPhase('pickContact')
  }

  const staticResources = staticUsResources()
  const regionHint =
    place?.regionCode ?? debugOverride?.regionCode ?? (place?.countryCode === 'US' ? 'US' : place?.countryCode)

  return (
    <div className={`grid gap-3 ${compact ? 'text-xs' : 'text-sm'}`}>
      <div>
        If you might be in immediate danger, call emergency services now. In the United States, call or text{' '}
        <strong>988</strong>, or chat at{' '}
        <a className="underline" href="https://988lifeline.org/chat/" target="_blank" rel="noreferrer">
          988lifeline.org
        </a>
        .
      </div>

      <div className="grid gap-2 rounded-2xl border border-[var(--paper-border)] p-3">
        <div className="font-semibold">National lines (always available)</div>
        <div className="grid gap-2">
          {staticResources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      </div>

      {phase === 'idle' ? (
        <button
          type="button"
          className="focus-ring w-fit rounded-xl border border-[var(--paper-border)] px-3 py-2 font-semibold"
          onClick={beginLocalSearch}
        >
          Find local & regional resources
        </button>
      ) : null}

      {phase === 'pickContact' ? (
        <div className="grid gap-2 rounded-2xl border border-[var(--paper-border)] p-3">
          <div className="font-semibold">How do you want to connect?</div>
          <div className="ink-muted text-xs">
            Mentell will use your location{debugOverride ? ' (debug override on)' : ''} to load{' '}
            {topics.map(topicLabel).join(', ')} near you.
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {CONTACT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-2 text-left"
                onClick={() => void loadResources(option.id)}
              >
                <div className="font-semibold">{option.label}</div>
                <div className="ink-muted text-xs">{option.hint}</div>
              </button>
            ))}
          </div>
          <button
            type="button"
            className="focus-ring ink-muted w-fit text-xs underline"
            onClick={() => setPhase('idle')}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {phase === 'loading' ? (
        <div className="rounded-2xl border border-[var(--paper-border)] p-3" role="status">
          <div className="font-semibold">Loading resources near you…</div>
          <div className="ink-muted mt-1">
            Checking location and contacting regional directories ({contactMethod === 'any' ? 'all contact types' : contactMethod}).
          </div>
        </div>
      ) : null}

      {phase === 'error' ? (
        <div className="grid gap-2 rounded-2xl border border-[var(--danger)]/40 p-3">
          <div className="font-semibold" style={{ color: 'var(--danger)' }}>
            {errorMessage}
          </div>
          <div className="ink-muted">
            You can still use 988, NAMI, or{' '}
            <a className="underline" href="https://findahelpline.com/" target="_blank" rel="noreferrer">
              Find A Helpline
            </a>{' '}
            worldwide.
          </div>
          <button
            type="button"
            className="focus-ring w-fit rounded-xl border border-[var(--paper-border)] px-3 py-2 font-semibold"
            onClick={beginLocalSearch}
          >
            Try again
          </button>
        </div>
      ) : null}

      {phase === 'results' ? (
        <div className="grid gap-3 rounded-2xl border border-[var(--paper-border)] p-3">
          <div>
            <div className="font-semibold">Resources near you</div>
            {place?.displayName ? (
              <div className="ink-muted mt-1 text-xs">{place.displayName}</div>
            ) : regionHint ? (
              <div className="ink-muted mt-1 text-xs">Region: {regionHint}</div>
            ) : null}
          </div>
          {results.map((result) => (
            <ResultSection key={result.topic} result={result} />
          ))}
          <button
            type="button"
            className="focus-ring w-fit rounded-xl border border-[var(--paper-border)] px-3 py-2 font-semibold"
            onClick={beginLocalSearch}
          >
            Change contact preference
          </button>
        </div>
      ) : null}

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
