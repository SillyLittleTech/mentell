import { useState } from 'react'
import {
  clearDebugLocationOverride,
  loadDebugLocationOverride,
  saveDebugLocationOverride,
  type DebugLocationOverride,
} from '../safety/localResources/debugLocation'

const PRESETS: { label: string; value: DebugLocationOverride }[] = [
  {
    label: 'Altoona, PA (16602)',
    value: {
      enabled: true,
      latitude: 40.5187,
      longitude: -78.3947,
      regionCode: 'PA',
      zip: '16602',
      label: 'Altoona, Pennsylvania',
    },
  },
  {
    label: 'Washington, DC',
    value: {
      enabled: true,
      latitude: 38.9072,
      longitude: -77.0369,
      regionCode: 'DC',
      zip: '20001',
      label: 'Washington, DC',
    },
  },
]

export function DebugLocalResourcesSection() {
  const existing = loadDebugLocationOverride()
  const [enabled, setEnabled] = useState(existing?.enabled ?? false)
  const [latitude, setLatitude] = useState(String(existing?.latitude ?? 40.5187))
  const [longitude, setLongitude] = useState(String(existing?.longitude ?? -78.3947))
  const [regionCode, setRegionCode] = useState(existing?.regionCode ?? 'PA')
  const [zip, setZip] = useState(existing?.zip ?? '16602')
  const [label, setLabel] = useState(existing?.label ?? 'Debug location')
  const [status, setStatus] = useState<string | null>(null)

  function applyPreset(preset: DebugLocationOverride) {
    setEnabled(true)
    setLatitude(String(preset.latitude))
    setLongitude(String(preset.longitude))
    setRegionCode(preset.regionCode ?? '')
    setZip(preset.zip ?? '')
    setLabel(preset.label ?? preset.regionCode ?? 'Debug location')
  }

  function save() {
    const lat = Number(latitude)
    const lon = Number(longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setStatus('Invalid latitude or longitude.')
      return
    }
    if (enabled) {
      saveDebugLocationOverride({
        enabled: true,
        latitude: lat,
        longitude: lon,
        regionCode: regionCode.trim() || undefined,
        zip: zip.trim() || undefined,
        label: label.trim() || undefined,
      })
      setStatus('Location override saved. Compose → crisis/support resources will use it.')
    } else {
      clearDebugLocationOverride()
      setStatus('Location override cleared — real geolocation will be used.')
    }
  }

  return (
    <div className="rounded-3xl border border-[var(--paper-border)] p-3">
      <div className="font-mono text-xs font-bold">local resources location</div>
      <div className="ink-muted mt-1 text-xs">
        Spoofs geolocation for Find local & regional resources (skips browser prompt when enabled).
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        Use debug location override
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            className="focus-ring rounded-xl border border-[var(--paper-border)] px-2 py-1 text-xs"
            onClick={() => applyPreset(preset.value)}
          >
            {preset.label}
          </button>
        ))}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs">
          Latitude
          <input
            className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs">
          Longitude
          <input
            className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs">
          State (US)
          <input
            className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1"
            value={regionCode}
            onChange={(e) => setRegionCode(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs">
          ZIP
          <input
            className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
          />
        </label>
      </div>
      <label className="mt-2 grid gap-1 text-xs">
        Label
        <input
          className="focus-ring rounded-xl border border-[var(--paper-border)] bg-transparent px-2 py-1"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <button
        type="button"
        className="focus-ring mt-3 rounded-2xl border border-[var(--paper-border)] px-3 py-2 text-sm"
        onClick={save}
      >
        Save location override
      </button>
      {status ? <div className="ink-muted mt-2 text-xs">{status}</div> : null}
    </div>
  )
}
