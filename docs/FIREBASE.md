# Firebase setup (Mentell)

Optional **Google**, **email/password**, and **email link** sign-in, **Firestore sync**, and **share links**. Default build flags keep everything **local-only** (no Firebase project required for forks).

## Feature flags

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_ENABLE_FIREBASE` | `0` | Load Firebase SDK |
| `VITE_ENABLE_FIREBASE_SYNC` | `0` | Account UI + sync |
| `VITE_ENABLE_SHARE_LINKS` | `0` | Share links + `/share/:code` viewer |

All `VITE_FIREBASE_*` config values are **public** in the client bundle (not GitHub Secrets).

## One-time Console setup

1. Create project (e.g. `men-tell-prod`) on **Spark (free)**.
2. Register **Web app** → copy config into `.env.local` / GitHub Actions **Variables**.
3. **Authentication** → enable **Google**.
4. **Authentication** → enable **Email/Password**, and turn on **Email link (passwordless sign-in)** on the same provider (required for magic links).
5. **Authentication** → **Authorized domains**: `localhost`, `projects.sillylittle.tech`, `mentell.sillylittle.tech` (if used), and your custom auth host if used (e.g. `auth.mentell.sillylittle.tech`).
6. **Google Cloud Console** (same project) → **APIs & Services** → **Credentials** → **OAuth 2.0 Client ID** (Web client, auto-created by Firebase) → **Authorized redirect URIs** must include exactly:
   ```text
   https://<VITE_FIREBASE_AUTH_DOMAIN>/__/auth/handler
   ```
   Examples:
   - Default: `https://men-tell-prod.firebaseapp.com/__/auth/handler`
   - Custom auth host: `https://auth.mentell.sillylittle.tech/__/auth/handler`
   If you change `VITE_FIREBASE_AUTH_DOMAIN`, update this URI or Google returns **Error 400: redirect_uri_mismatch**.
7. **Firestore** → create database (production mode), pick a region.
8. **(Recommended)** Firestore **TTL** on collection `publicShares`, field `expiresAt`.

The **Mentell app** is hosted on **GitHub Pages** (`https://projects.sillylittle.tech/mentell/`). A **small landing page** on Firebase Hosting explains that sign-in happens in the app (see below).

## Email link (magic link) sign-in

The app implements [Firebase email link auth](https://firebase.google.com/docs/auth/web/email-link-auth):

- **Continue URL (web/PWA):** `https://<your-app-origin>/<base>/settings` (e.g. `https://projects.sillylittle.tech/mentell/settings`). The origin must be in **Authorized domains**.
- **Continue URL (Tauri desktop):** `https://projects.sillylittle.tech/mentell/auth/deeplink.html` by default (`VITE_NATIVE_AUTH_CONTINUE_URL` to override). Firebase cannot redirect to `tauri://` origins; the relay page forwards the link into the app via the `mentell://` deep link scheme.
- **`handleCodeInApp: true`** — completion runs in the Mentell SPA (web) or desktop app (via deep link).
- Email is stored in `localStorage` as `emailForSignIn` when the link is sent (not in the redirect URL).
- If the user opens the link on another device, they confirm their email in-app before `signInWithEmailLink` runs.

If links fail with a custom auth domain, the app sets `linkDomain` on `ActionCodeSettings` from `VITE_FIREBASE_AUTH_DOMAIN` when it is not the default `*.firebaseapp.com` host.

## Tauri desktop sign-in

The desktop app uses `tauri://localhost`, which Firebase Auth does not support for popups or redirects inside the WebView. Desktop sign-in uses a **built-in localhost callback server** (no third-party OAuth plugin):

1. **Google:** Firebase `createAuthUri` opens your system browser; when you approve, the browser hits `http://127.0.0.1:<port>` and Mentell completes sign-in automatically.
2. **Email link:** The magic link's continue URL is also `http://127.0.0.1:<port>`. Click the link in your mail app, approve in the browser, and Mentell completes sign-in while the app stays open.
3. **Firebase Authorized domains:** add `127.0.0.1` and `localhost` (required for both flows).
4. **Tauri capabilities:** `src-tauri/tauri.conf.json` must list `"capabilities": ["default"]` so custom auth commands are allowed.

No hosted relay page is required for desktop email sign-in. The web handoff banner (`/auth/deeplink`) is only for users who open links in a browser intentionally (e.g. offline ZIP → web).

## Offline ZIP / file:// builds

Cloud sign-in from a double-clicked offline `index.html` cannot use Google popups (`file://` is not an authorized origin). Email magic links use the same hosted continue URL as desktop. Google sign-in opens the hosted web app instead.

## Firebase Hosting landing page

Static files live in [`firebase-hosting/public/`](../firebase-hosting/public/). They provide a friendly page at `https://<PROJECT_ID>.firebaseapp.com/` (and on a **custom auth domain** if connected to this Hosting site in the Console).

- Primary link: **https://mentell.sillylittle.tech**
- Copy points users to **Settings → Account & sync** for Google / email sign-in.

Deploy:

```bash
firebase use men-tell-prod
firebase deploy --only hosting
```

Deploy rules and hosting together:

```bash
firebase deploy --only firestore:rules,hosting
```

## Deploy security rules

From repo root (after `firebase login`):

```bash
firebase use men-tell-prod
firebase deploy --only firestore:rules
```

Rules live in [`firestore.rules`](../firestore.rules).

## Local development

```bash
cp .env.local.example .env.local
# Set VITE_ENABLE_FIREBASE=1, sync/share flags, and Firebase config
npm run dev
```

Add `localhost` under **Authorized domains** if you test email links locally.

## Debug builds (`npm run dev:debug`)

- Uses [`DebugAuthProvider`](../src/shared/firebase/DebugAuthProvider.tsx) by default: **no** Google/email sign-in; Firebase Auth uses **in-memory** persistence so sessions do not leak into `npm run dev`.
- Firebase is **off** in debug mode unless you opt in:
  - **`VITE_DEBUG_FIREBASE_CUSTOM_TOKEN`** — automated `DEBUGGER` uid via Admin SDK custom token (local-only cloud sync testing).
  - **`VITE_DEBUG_ENABLE_AUTH=1`** or **`npm run dev:debug:auth`** — real Google/email sign-in with isolated debug storage.
- **Tauri desktop** (`npm run tauri:dev`) always uses real [`AuthProvider`](../src/shared/firebase/AuthProvider.tsx) when `VITE_ENABLE_FIREBASE=1`; do **not** use `dev:debug` for desktop auth testing.
- **Fixed uid `DEBUGGER`:** mint a custom token with the Firebase Admin SDK (`uid: 'DEBUGGER'`), add to `.env.local` as `VITE_DEBUG_FIREBASE_CUSTOM_TOKEN=…`. On load, debug mode signs out any existing user and uses `signInWithCustomToken`. Firestore rules already allow `request.auth.uid == userId`.

## GitHub Pages CI

Add **Repository variables** (Settings → Actions → Variables) matching `.env.local` when enabling cloud features in production builds. Update [`.github/workflows/gh-pages.yml`](../.github/workflows/gh-pages.yml) — already wired for optional vars.

**Wrangler:** unchanged for weekly AI (`WEEKLY_AI_TOKEN` secret only).

## Web Push + Firestore (optional)

When `VITE_ENABLE_FIREBASE_SYNC=1` and push env vars are set, the Cloudflare Worker can read Firestore server-side to send “package ready” pushes to signed-in users.

1. GCP → IAM → Service Accounts → create e.g. `mentell-push-cron`.
2. Grant **Cloud Datastore User** (Firestore read).
3. Keys → JSON → `wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON` (worker only; never in the client bundle).
4. Client subscribe sends the user’s Firebase ID token; cron queries `users/{uid}/entries` and `users/{uid}/packages`.

Non-synced users still receive generic weekly reminders on **Eastern Time** if they subscribed with push enabled. No change to [`firestore.rules`](../firestore.rules) for end users.

## Share links

- Creator must be signed in with **sync enabled**.
- Snapshot URL: `https://projects.sillylittle.tech/mentell/share/XXXX-XXXX-XXXX-XXXX`
- Snapshot links are time-limited. Viewers need no account; data is a sanitized snapshot in `publicShares/{code}`.
- Protected permanent links use `/share/<uid>` and require a viewer code to unlock an encrypted payload. The owner can renew the same slug instead of generating a new URL.

## Privacy (operator notes — not for in-app UI)

- Synced journal data is stored in the operator’s Firebase project under the user’s sign-in (Google or email).
- Not HIPAA-certified on Spark.
- Treat share URLs like passwords; revoke when done.
- Do not paste project ids or console URLs into customer-facing app copy; see **Customer-facing copy** in [`AGENTS.md`](../AGENTS.md).
