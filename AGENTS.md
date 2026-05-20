# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Mentell is a local-first stationery-themed mental health / journaling PWA. It is a React + TypeScript + Vite application. Journal data persists client-side via IndexedDB (Dexie.js) and localStorage.

An **optional** Cloudflare Worker (`worker/`) provides weekly AI summaries via Workers AI. The static app is deployed on **GitHub Pages**; the worker is deployed separately with Wrangler.

### Development commands

All commands are defined in `package.json` scripts:

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Dev server | `npm run dev` (Vite on port 5173) |
| Lint | `npm run lint` (ESLint) |
| Type check | `npx tsc -b` |
| Build (production, includes PWA) | `npm run build` (tsc + vite build; **~30s after** `✓ built` while PWA generates — looks hung) |
| Build (fast, no PWA) | `npm run build:check` (use for agent/CI typecheck verification) |
| Preview prod build | `npm run preview` |
| Worker dev | `npm run worker:dev` (port 8787) |
| Worker deploy | `npm run worker:deploy` |

### Weekly AI (Cloudflare Workers)

**Local**

1. `cd worker && npm install && cp .dev.vars.example .dev.vars`
2. Create KV namespaces and update `worker/wrangler.jsonc` ids (`wrangler kv namespace create RATE_LIMIT_KV` + `--preview`)
3. `npm run worker:dev`
4. Root `.env.local`: `VITE_ENABLE_WEEKLY_AI_SUMMARY=1`, `VITE_WEEKLY_AI_ENDPOINT=http://127.0.0.1:8787/weekly-summary`, `VITE_WEEKLY_AI_TOKEN=dev-local-token` (must match `worker/.dev.vars`; **quote** tokens that contain `#`, e.g. `VITE_WEEKLY_AI_TOKEN="my#token"`)

**Production**

1. `wrangler secret put WEEKLY_SUMMARY_TOKEN` (CORS allows any `*.sillylittle.tech` and `*.workers.dev` by default)
2. `npm run worker:deploy` — note the `*.workers.dev` URL
3. GitHub repo → Settings → Actions:
   - Secret: `WEEKLY_AI_TOKEN` (same as `WEEKLY_SUMMARY_TOKEN`)
   - Variables: `VITE_ENABLE_WEEKLY_AI_SUMMARY=1`, `VITE_WEEKLY_AI_ENDPOINT=https://<worker>/weekly-summary`

The AI card on `/week` only appears when env flags are set **and** a weekly package has been delivered. Users can set local AI preferences (name, age range, context), choose reflection vs narrative overview mode, cache summaries when data unchanged, and download RAW HTML reports (week / last 4 weeks / all time).

Worker POST body also accepts optional `mode` (`reflection` | `overview`) and `profile` (`displayName`, `ageRange`, `about`).

### Non-obvious notes

- There are no automated tests (no test framework configured). Verify changes via lint, type checking, and manual browser testing.
- The app uses Vite 8 with `vite-plugin-pwa`; the service worker is generated at build time only (not during dev). PWA features cannot be tested with `npm run dev`.
- **`npm run build` appears to hang** after printing `✓ built in …` — the process is still running **PWA/service-worker generation** with no further stdout for 20–40s. Use `npm run build:check` when you only need a quick compile verification.
- Use `npm run dev -- --host 0.0.0.0` to expose the dev server on all interfaces (needed in cloud/container environments).
- Debug mode: `npm run dev:debug` or `npm run build:debug` enables a debug panel via Vite's `--mode debug`.
