import { useState } from 'react'

type LocateState = 'idle' | 'locating' | 'us' | 'global' | 'denied' | 'unavailable'

type Coords = {
  latitude: number
  longitude: number
}

function looksLikeUnitedStates(coords: Coords) {
  const { latitude, longitude } = coords
  return latitude >= 18 && latitude <= 72 && longitude >= -172 && longitude <= -65
}

export function CrisisResourcePanel({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<LocateState>('idle')

  function requestLocation() {
    if (!navigator.geolocation) {
      setState('unavailable')
      return
    }
    setState('locating')
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        }
        setState(looksLikeUnitedStates(coords) ? 'us' : 'global')
      },
      (error) => {
        setState(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable')
      },
      { enableHighAccuracy: false, maximumAge: 5 * 60 * 1000, timeout: 8000 },
    )
  }

  return (
    <div className={`grid gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
      <div>
        If you might be in immediate danger, call emergency services now. In the United States,
        call or text <strong>988</strong>, or chat at{' '}
        <a className="underline" href="https://988lifeline.org/chat/" target="_blank" rel="noreferrer">
          988lifeline.org
        </a>
        .
      </div>
      <div className="flex flex-wrap gap-2">
        <a className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-2 font-semibold" href="tel:988">
          Call 988
        </a>
        <a className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-2 font-semibold" href="sms:988">
          Text 988
        </a>
        <a className="focus-ring rounded-xl border border-[var(--paper-border)] px-3 py-2 font-semibold" href="https://findahelpline.com/" target="_blank" rel="noreferrer">
          Find A Helpline
        </a>
      </div>
      <button
        type="button"
        className="focus-ring w-fit rounded-xl border border-[var(--paper-border)] px-3 py-2 font-semibold"
        disabled={state === 'locating'}
        onClick={requestLocation}
      >
        {state === 'locating' ? 'Checking location…' : 'Find local crisis resources'}
      </button>
      {state === 'us' ? (
        <div className="ink-muted">
          Location access suggests US resources. 988 is available 24/7; USAGov and CDC also list
          mental health support options.
        </div>
      ) : state === 'global' ? (
        <div className="ink-muted">
          Location access suggests using a global directory. Find A Helpline can show services by
          country and language.
        </div>
      ) : state === 'denied' ? (
        <div className="ink-muted">
          Location was not shared. You can still use 988 in the US or Find A Helpline worldwide.
        </div>
      ) : state === 'unavailable' ? (
        <div className="ink-muted">
          Location is unavailable in this browser. You can still use the crisis links above.
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <a className="underline" href="https://www.usa.gov/mental-health" target="_blank" rel="noreferrer">
          USAGov mental health
        </a>
        <a className="underline" href="https://www.cdc.gov/howrightnow/get-help/index.html" target="_blank" rel="noreferrer">
          CDC get help now
        </a>
      </div>
    </div>
  )
}
