# AGENTS.md

## Cursor Cloud specific instructions

### Product overview

Mentell is a local-first stationery-themed mental health / journaling PWA. It is a React + TypeScript + Vite application. Journal data persists client-side via IndexedDB (Dexie.js) and localStorage.

An **optional** Cloudflare Worker (`worker/`) provides weekly AI summaries via Workers AI. The static app is deployed on **GitHub Pages**; the worker is deployed separately with Wrangler.

**GitHub Pages base path:** Production URL is `https://projects.sillylittle.tech/mentell/`. CI sets `VITE_BASE=/mentell/` in `.github/workflows/gh-pages.yml`. Local dev uses `base: /`. Use `publicUrl()` for static assets under `public/`.

**UI assets:** Edit PNGs in [`asset/`](asset/) (source), then run `npm run sync:assets` to copy into `public/asset/`. Character SVGs live in [`asset/char/`](asset/char/) (also synced to `public/asset/char/`); `sync:assets` regenerates [`src/features/character/charManifest.generated.ts`](src/features/character/charManifest.generated.ts) from `charprod.svg` inkscape labels (DNI / III / TOGGLE). Test customization at `/character-lab`. Production builds run sync automatically. Reference PNGs in React via `publicUrl('/asset/…')`.

### Development commands

All commands are defined in `package.json` scripts:

| Task | Command |
|---|---|
| Install deps | `npm install` |
| Sync UI assets | `npm run sync:assets` (`asset/` → `public/asset/`) |
| Dev server | `npm run dev` (Vite on port 5173) |
| Debug dev server | `npm run dev:debug` (isolated `mentell-debug` IndexedDB + scoped localStorage) |
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

### Projector AI Search (Cloudflare AI Search)

Optional natural-language search over journal entries on the Projector (`/week`) tab. Uses the same Worker with a new route and an AI Search instance.

**Operator setup**

1. In the Cloudflare dashboard, create an **AI Search** instance named `mentell-journals` (built-in storage).
2. Add custom metadata fields: `userId` (text), `entryId` (text), `dateKey` (text), `updatedAt` (number or text).
3. Create **two** AI Gateways:
   - `mentell-workers-ai` — attach rate limits / spend limits here; used by weekly summary and projector fallbacks via `AI_GATEWAY_ID`.
   - A dedicated gateway for the AI Search instance — **no rate limiting and no caching** (Cloudflare warns these break indexing/query accuracy).
4. Worker binding is already in [`worker/wrangler.jsonc`](worker/wrangler.jsonc) (`AI_SEARCH` → `mentell-journals`, `remote: true` for local dev).
5. Optional secrets/vars: `AI_GATEWAY_ID`, `PROJECTOR_SEARCH_TOKEN` (falls back to `WEEKLY_SUMMARY_TOKEN`).

**Local client env** (root `.env.local`):

```env
VITE_ENABLE_PROJECTOR_AI_SEARCH=1
VITE_PROJECTOR_SEARCH_ENDPOINT=http://127.0.0.1:8787/projector-search
VITE_PROJECTOR_SEARCH_TOKEN=dev-local-token
```

The Search button is gated by Settings → **Disable AI summaries** (same local AI toggle) plus the build flags above. Without an AI Search binding, the Worker falls back to local keyword match + Workers AI.

**Production:** set GitHub Variables `VITE_ENABLE_PROJECTOR_AI_SEARCH`, `VITE_PROJECTOR_SEARCH_ENDPOINT`, and reuse `WEEKLY_AI_TOKEN` / `VITE_PROJECTOR_SEARCH_TOKEN` as needed.

### Firebase sync + share links (optional)

See [`docs/FIREBASE.md`](docs/FIREBASE.md). Off by default via `VITE_ENABLE_FIREBASE=0` in [`.env.example`](.env.example).

- **Sync:** Google sign-in, Firestore under `users/{uid}/`, local-first with Dexie + debounced push.
- **Share:** Time-limited links → `publicShares/{code}` + viewer route `/share/:code`.
- **Offline link codes:** Optional `VITE_ENABLE_AUTH_HANDOFF=1` + Worker `POST /auth/handoff/*` (see [`docs/FIREBASE.md`](docs/FIREBASE.md)) — hosted app creates a code; offline ZIP / desktop redeems it once online.
- **Rules:** [`firestore.rules`](firestore.rules) — deploy with `firebase deploy --only firestore:rules` (project id in [`.firebaserc`](.firebaserc), e.g. `men-tell-prod` for this deployment).
- **CI:** GitHub **Variables** for `VITE_FIREBASE_*` (not secrets). Wrangler unchanged.

**Customer-facing copy:** Mentell is a production app, not only a template. In UI strings (`src/features/**`, `src/components/**`), do **not** mention Firebase/GCP project ids (`men-tell-prod`), `authDomain`, bucket names, or other operator infrastructure. Use plain language (“cloud backup”, “sync across devices”, “your Google account”). Keep project ids and deploy commands in operator docs ([`docs/FIREBASE.md`](docs/FIREBASE.md), `.env*.example`, this file) only.

### Versioning

Canonical app version lives in [`VERSION`](VERSION) (semver `MAJOR.MINOR.PATCH`). Keep [`package.json`](package.json) `version` in sync when bumping.

**Default to a PATCH / sub-minor bump** (`1.18.14` → `1.18.15`). That includes most new features, UI additions, copy, styling, bug fixes, docs, and dependency patches.

| Bump | When | Example |
|------|------|---------|
| **PATCH** (sub-minor, default) | Almost every change: features, fixes, copy, styling, docs, small UX additions | `1.4.2` → `1.4.3` |
| **MINOR** | Only unusually large product changes (a whole new area of the app, a major UX overhaul) | `1.4.2` → `1.5.0` |
| **MAJOR** | Almost never. Only when the owner **explicitly asks** for a major bump (or an incompatible migration they call out as major) | `1.4.2` → `2.0.0` |

Do not choose MAJOR on your own. Prefer PATCH unless the change is clearly a large product expansion.

After changing `VERSION`, run `npm run build:check` so Vite reinjects `VITE_APP_VERSION` into the footer (`src/shared/version.ts` → `AppLegalFooter`).

### License

Source is **BSD-2-Clause** — see [`LICENSE`](LICENSE). Footer legal copy matches SillyLittleTech / Hack Club fiscal sponsorship; do not remove without owner approval.

### Privacy copy

In-app page: [`src/features/legal/PrivacyPolicyPage.tsx`](src/features/legal/PrivacyPolicyPage.tsx) at `/privacy`. Links to [SillyLittleTech Privacy Policy](https://sillylittle.tech/policy). Mentell-specific sections cover individual-use (not HIPAA for providers), optional Firebase Auth/sync/share, and optional Cloudflare Workers AI. Update this page when cloud feature flags or data flows change.

### Stickies

- Global overlay: [`StickyLayer`](src/features/stickies/StickyLayer.tsx) mounted in [`App.tsx`](src/App.tsx) — visible on all routes; positions are viewport `x`/`y` in Dexie (`coordSpace: 'viewport'`).
- Add/manage UI on Notes only: [`StickyDock`](src/features/stickies/StickyDock.tsx).

### Debug mode storage

- `npm run dev:debug` / `build:debug` use Dexie DB **`mentell-debug`** and localStorage keys prefixed `mentell.debug-data.*` via [`storageScope.ts`](src/shared/storage/storageScope.ts). Production `npm run dev` uses **`mentell`** — seed/clear in the debug panel does not touch prod journal data on the same origin.
- Theme (`mentell.theme`) and debug toggles (`mentell.debug.*`) stay unscoped.
- Debug builds use [`public/dev-push-sw.js`](public/dev-push-sw.js) (push-only, no Workbox) when push env vars are set — not vite-plugin-pwa dev SW. Debug panel → **notifications**: permission, subscribe, `/push/test`, status readout ([`debugNotifications.ts`](src/features/debug/debugNotifications.ts)).

### Debug mode Firebase

- [`DebugAuthProvider`](src/shared/firebase/DebugAuthProvider.tsx): in-memory auth, signs out any prod session, and only signs in with `VITE_DEBUG_FIREBASE_CUSTOM_TOKEN` for fixed uid `DEBUGGER`. If no debug custom token is set, Firebase/cloud features are disabled in debug mode. Standard sign-in UI is hidden.
- See [`docs/FIREBASE.md`](docs/FIREBASE.md) for optional custom token setup.

### Notifications and package delivery

- Settings → **Features**: `disableNotifications`, **Package delivery** (weekday + local time, default Monday 9:00), **Timezone** (device IANA, for push). Synced via Firestore `meta/settings` when cloud sync is on.
- Permission prompts: [`maybeRequestNotificationPermission`](src/pwa/notifications.ts) on Settings open and after letter submit, only when notifications are not disabled and permission is `default`.
- Delivery schedule: [`packageDelivery.ts`](src/features/packages/packageDelivery.ts) + [`generateDuePackages`](src/features/packages/packageGenerator.ts) create weekly packages only after the configured instant; [`runPackageDeliveryAndNotify`](src/features/packages/runPackageDelivery.ts) shows an OS notification when new packages appear while the tab is open.
- Visible-tab poll in [`App.tsx`](src/App.tsx) every 60s runs delivery while the tab is focused.
- **Web Push (optional, tab closed):** `VITE_VAPID_PUBLIC_KEY` + `VITE_PUSH_API_BASE` on the same worker. [`src/pwa/sw.ts`](src/pwa/sw.ts) + [`pushSubscribe.ts`](src/pwa/pushSubscribe.ts); worker cron every 15m, `PUSH_KV`, optional `FIREBASE_SERVICE_ACCOUNT_JSON` for synced users (package-ready vs generic EST reminder).

**Push operator setup:** `npx web-push generate-vapid-keys` → `wrangler kv namespace create PUSH_KV` (+ `--preview`) → paste ids in `worker/wrangler.jsonc` → `wrangler secret put VAPID_PUBLIC_KEY|VAPID_PRIVATE_KEY|FIREBASE_SERVICE_ACCOUNT_JSON` → `npm run worker:deploy`. GitHub **Variables:** `VITE_VAPID_PUBLIC_KEY`, `VITE_PUSH_API_BASE` (worker origin, no trailing slash). Details: [`worker/README.md`](worker/README.md).

### Motion

- **Route transitions:** Wrap route trees in [`AnimatedRoutes`](src/shared/motion/AnimatedRoutes.tsx) (fade + slight vertical slide). Keep [`AppLegalFooter`](src/components/AppLegalFooter.tsx) **outside** the animated wrapper so the footer does not re-animate on every tab.
- **Programmatic scroll:** Use [`scrollToTop`](src/shared/motion/scroll.ts) / [`scrollToElementId`](src/shared/motion/scroll.ts) (e.g. privacy page)—not raw `window.scrollTo` without checking reduced motion.
- **Variants:** Reuse [`pageTransitionProps`](src/shared/motion/pageTransition.ts) and always gate with [`shouldReduceMotion()`](src/shared/motion/useMotionPrefs.ts) / [`motionDuration()`](src/shared/motion/useMotionPrefs.ts). Settings → **Reduced motion** and `prefers-reduced-motion` set `data-reduced-motion` on `<html>`.

### Non-obvious notes

- There are no automated tests (no test framework configured). Verify changes via lint, type checking, and manual browser testing.
- The app uses Vite 8 with `vite-plugin-pwa` (`injectManifest` + `devOptions.enabled` for local SW). For push, set `VITE_VAPID_PUBLIC_KEY` + `VITE_PUSH_API_BASE` in `.env.local` and **restart** Vite after changing env. Use `http://127.0.0.1:8787` (not `https://`) for local worker. Fallback: `npm run build && npm run preview`.
- **`npm run build` appears to hang** after printing `✓ built in …` — the process is still running **PWA/service-worker generation** with no further stdout for 20–40s. Use `npm run build:check` when you only need a quick compile verification.
- Use `npm run dev -- --host 0.0.0.0` to expose the dev server on all interfaces (needed in cloud/container environments).
- Debug mode: `npm run dev:debug` or `npm run build:debug` enables a debug panel via Vite's `--mode debug` with isolated storage (see **Debug mode storage** above).
