# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Mentell is a local-first stationery-themed mental health / journaling PWA. It is a React + TypeScript + Vite application. Journal data persists client-side via IndexedDB (Dexie.js) and localStorage.

An **optional** Cloudflare Worker (`worker/`) provides weekly AI summaries via Workers AI. The static app is deployed on **GitHub Pages**; the worker is deployed separately with Wrangler.

**GitHub Pages base path:** Production URL is `https://projects.sillylittle.tech/mentell/`. CI sets `VITE_BASE=/mentell/` in `.github/workflows/gh-pages.yml`. Local dev uses `base: /`. Use `publicUrl()` for static assets under `public/`.

**UI assets:** Edit PNGs in [`asset/`](asset/) (source), then run `npm run sync:assets` to copy into `public/asset/`. Production builds run sync automatically. Reference assets in React via `publicUrl('/asset/…')`.

### Development commands

All commands are defined in `package.json` scripts:

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Sync UI assets | `npm run sync:assets` (`asset/` → `public/asset/`) |
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

### Firebase sync + share links (optional)

See [`docs/FIREBASE.md`](docs/FIREBASE.md). Off by default via `VITE_ENABLE_FIREBASE=0` in [`.env.example`](.env.example).

- **Sync:** Google sign-in, Firestore under `users/{uid}/`, local-first with Dexie + debounced push.
- **Share:** Time-limited links → `publicShares/{code}` + viewer route `/share/:code`.
- **Rules:** [`firestore.rules`](firestore.rules) — deploy with `firebase deploy --only firestore:rules` (project id in [`.firebaserc`](.firebaserc), e.g. `men-tell-prod` for this deployment).
- **CI:** GitHub **Variables** for `VITE_FIREBASE_*` (not secrets). Wrangler unchanged.

**Customer-facing copy:** Mentell is a production app, not only a template. In UI strings (`src/features/**`, `src/components/**`), do **not** mention Firebase/GCP project ids (`men-tell-prod`), `authDomain`, bucket names, or other operator infrastructure. Use plain language (“cloud backup”, “sync across devices”, “your Google account”). Keep project ids and deploy commands in operator docs ([`docs/FIREBASE.md`](docs/FIREBASE.md), `.env*.example`, this file) only.

### Versioning

Canonical app version lives in [`VERSION`](VERSION) (semver `MAJOR.MINOR.PATCH`). Keep [`package.json`](package.json) `version` in sync when bumping.

| Bump | When | Example |
|------|------|---------|
| **MAJOR** | Breaking UX, data migrations users must notice, or incompatible API/env changes | `1.4.2` → `2.0.0` |
| **MINOR** | New features, notable UI flows, non-breaking behavior additions | `1.4.2` → `1.5.0` |
| **PATCH** | Bug fixes, copy, styling, docs, dependency patches with no user-facing feature | `1.4.2` → `1.4.3` |

After changing `VERSION`, run `npm run build:check` so Vite reinjects `VITE_APP_VERSION` into the footer (`src/shared/version.ts` → `AppLegalFooter`).

### License

Source is **BSD-2-Clause** — see [`LICENSE`](LICENSE). Footer legal copy matches SillyLittleTech / Hack Club fiscal sponsorship; do not remove without owner approval.

### Privacy copy

In-app page: [`src/features/legal/PrivacyPolicyPage.tsx`](src/features/legal/PrivacyPolicyPage.tsx) at `/privacy`. Links to [SillyLittleTech Privacy Policy](https://sillylittle.tech/policy). Mentell-specific sections cover individual-use (not HIPAA for providers), optional Firebase Auth/sync/share, and optional Cloudflare Workers AI. Update this page when cloud feature flags or data flows change.

### Motion

- **Route transitions:** Wrap route trees in [`AnimatedRoutes`](src/shared/motion/AnimatedRoutes.tsx) (fade + slight vertical slide). Keep [`AppLegalFooter`](src/components/AppLegalFooter.tsx) **outside** the animated wrapper so the footer does not re-animate on every tab.
- **Programmatic scroll:** Use [`scrollToTop`](src/shared/motion/scroll.ts) / [`scrollToElementId`](src/shared/motion/scroll.ts) (e.g. privacy page)—not raw `window.scrollTo` without checking reduced motion.
- **Variants:** Reuse [`pageTransitionProps`](src/shared/motion/pageTransition.ts) and always gate with [`shouldReduceMotion()`](src/shared/motion/useMotionPrefs.ts) / [`motionDuration()`](src/shared/motion/useMotionPrefs.ts). Settings → **Reduced motion** and `prefers-reduced-motion` set `data-reduced-motion` on `<html>`.

### Non-obvious notes

- There are no automated tests (no test framework configured). Verify changes via lint, type checking, and manual browser testing.
- The app uses Vite 8 with `vite-plugin-pwa`; the service worker is generated at build time only (not during dev). PWA features cannot be tested with `npm run dev`.
- **`npm run build` appears to hang** after printing `✓ built in …` — the process is still running **PWA/service-worker generation** with no further stdout for 20–40s. Use `npm run build:check` when you only need a quick compile verification.
- Use `npm run dev -- --host 0.0.0.0` to expose the dev server on all interfaces (needed in cloud/container environments).
- Debug mode: `npm run dev:debug` or `npm run build:debug` enables a debug panel via Vite's `--mode debug`.
