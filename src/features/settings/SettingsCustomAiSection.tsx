import { useAppSettings } from '../../shared/settings/useAppSettings'

export function SettingsCustomAiSection() {
  const { settings, updateSettings } = useAppSettings()

  return (
    <section className="paper rounded-3xl p-6">
      <div className="font-paper text-xl">Custom AI (Bring Your Own AI)</div>
      <div className="mt-4 grid gap-4">
        <label className="flex items-center justify-between gap-3 text-sm">
          <span>
            Enable Custom AI
            <div className="ink-muted text-xs">Point AI prompts to custom local instances (Ollama, LM Studio) or third-party endpoints.</div>
          </span>
          <input
            type="checkbox"
            checked={settings.aiProvider === 'custom'}
            onChange={(e) => updateSettings({ aiProvider: e.target.checked ? 'custom' : 'default' })}
          />
        </label>

        {settings.aiProvider === 'custom' && (
          <div className="grid gap-3 rounded-2xl border border-[var(--paper-border)] p-4">
            <label className="grid gap-1 text-sm">
              <span className="ink-muted text-xs font-medium">Base URL</span>
              <input
                type="text"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2"
                placeholder="e.g. http://localhost:11434/v1 or https://api.openai.com/v1"
                value={settings.aiBaseUrl}
                onChange={(e) => updateSettings({ aiBaseUrl: e.target.value })}
              />
              <span className="ink-muted text-xs text-[var(--danger)]">
                Make sure to configure CORS for local instances (e.g. <code>OLLAMA_ORIGINS="*"</code>).
              </span>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="ink-muted text-xs font-medium">Model Name</span>
              <input
                type="text"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2"
                placeholder="e.g. llama3.2, mistral, gpt-4o-mini"
                value={settings.aiModel}
                onChange={(e) => updateSettings({ aiModel: e.target.value })}
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="ink-muted text-xs font-medium">API Key (Optional)</span>
              <input
                type="password"
                className="focus-ring rounded-2xl border border-[var(--paper-border)] bg-transparent px-3 py-2"
                placeholder="Bearer token for custom endpoints"
                value={settings.aiApiKey}
                onChange={(e) => updateSettings({ aiApiKey: e.target.value })}
              />
            </label>
          </div>
        )}
      </div>
    </section>
  )
}
