# Mentell weekly AI worker

Cloudflare Worker that powers the optional **Weekly AI summary** on the Week tab.

## Local setup

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars
```

Create KV namespaces and paste ids into `wrangler.jsonc`:

```bash
wrangler login
wrangler kv namespace create RATE_LIMIT_KV
wrangler kv namespace create RATE_LIMIT_KV --preview
wrangler kv namespace create PUSH_KV
wrangler kv namespace create PUSH_KV --preview
```

For Web Push, add to `worker/.dev.vars` (see `.dev.vars.example`):

```env
VAPID_PUBLIC_KEY=<from npx web-push generate-vapid-keys>
VAPID_PRIVATE_KEY=<private key>
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}
```

Generate VAPID keys: `npx web-push generate-vapid-keys`

Run the worker:

```bash
npm run dev
# http://127.0.0.1:8787/weekly-summary
```

In the repo root, create `.env.local`:

```env
VITE_ENABLE_WEEKLY_AI_SUMMARY=1
VITE_WEEKLY_AI_ENDPOINT=http://127.0.0.1:8787/weekly-summary
VITE_WEEKLY_AI_TOKEN=dev-local-token
```

(`WEEKLY_SUMMARY_TOKEN` in `worker/.dev.vars` must match.)

## Production deploy

```bash
wrangler secret put WEEKLY_SUMMARY_TOKEN
npm run deploy
```

### API

`POST /weekly-summary` body:

```json
{
  "mode": "reflection",
  "profile": { "displayName": "", "ageRange": "prefer-not", "about": "" },
  "entries": [{ "dateKey": "2026-05-20", "sentiment": "+", "situation": "…", "details": "…" }]
}
```

- `mode`: `reflection` (default) or `overview` (objective third-person narrative per day)
- `profile`: optional; sanitized server-side. Used for reflection tone, ignored for overview objectivity.

CORS allows browser requests from:

- Any host on `sillylittle.tech` (e.g. `mentell.sillylittle.tech`, `app.sillylittle.tech`)
- Any `*.workers.dev` preview URL
- `localhost` / `127.0.0.1` for local dev

Optional: `wrangler secret put ALLOWED_HOST_SUFFIXES` with comma-separated suffixes like `.example.com`

Set GitHub Actions variables/secrets for the frontend build (see root `AGENTS.md`).

## Web Push API

Requires `PUSH_KV` ids in `wrangler.jsonc`, VAPID secrets, and (for synced users) `FIREBASE_SERVICE_ACCOUNT_JSON` with Firestore read access (e.g. **Cloud Datastore User** role on a dedicated service account — never commit the JSON).

Push delivery uses [`web-push-neo`](https://www.npmjs.com/package/web-push-neo) (`fetch` + Web Crypto), not Node `web-push`, so it runs on Cloudflare Workers without `https.request` errors.

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /push/subscribe` | Firebase ID token or `WEEKLY_SUMMARY_TOKEN` | Store subscription + delivery prefs in KV |
| `POST /push/unsubscribe` | Same | Remove subscription |
| `POST /push/test` | `WEEKLY_SUMMARY_TOKEN` | Send test notification to a subscription body |
| `POST /push/test-delayed` | `WEEKLY_SUMMARY_TOKEN` | Same + `delaySeconds` (5–120); returns immediately, push fires on worker |

Cron `*/15 * * * *` runs [`pushCron.ts`](src/pushCron.ts): within each user’s delivery window, synced users get a package-ready push when last week has entries and no `weekly` package yet; others get a generic reminder using Eastern Time.

Production secrets:

```bash
wrangler secret put VAPID_PUBLIC_KEY
wrangler secret put VAPID_PRIVATE_KEY
wrangler secret put FIREBASE_SERVICE_ACCOUNT_JSON
```

Frontend (GitHub **Variables**, not secrets): `VITE_VAPID_PUBLIC_KEY`, `VITE_PUSH_API_BASE` = worker URL without trailing slash.

## Projector AI Search

`GET|POST /projector-search` — natural-language search over journal entries (Cloudflare AI Search).

### Operator setup

1. Create AI Search instance `mentell-journals` with custom metadata: `userId`, `entryId`, `dateKey`, `updatedAt`.
2. Use **two** AI Gateways:
   - Workers AI gateway (set `AI_GATEWAY_ID`) — configure moderate rate limits here.
   - AI Search’s own gateway — **no** rate limiting or caching.
3. Binding in `wrangler.jsonc`: `AI_SEARCH` → `mentell-journals` (`remote: true` for `wrangler dev`).
4. Auth: Bearer `PROJECTOR_SEARCH_TOKEN` or `WEEKLY_SUMMARY_TOKEN`.

### Tenant isolation

All users share one AI Search instance. Isolation is by request `userId` only:

- Documents are stored at `journals/{userId}/pack-{n}.md` (packed) with matching `userId` metadata. Legacy per-entry keys `journals/{userId}/{entryId}.md` may still exist from earlier uploads.
- Index sync packs as many entries as fit under a **~3.5 MB** soft file limit (Cloudflare hard limit is 4 MB). Each entry is wrapped in clear MD markers (`<!-- mentell-entry:start … -->` / `<!-- mentell-entry:end … -->`). Before appending an entry, the packer checks whether it would exceed the limit and starts a new pack when needed.
- Entry IDs are recovered from chunk text markers (and metadata / legacy keys) after retrieval.
- Every search request requires a non-empty `userId` and retrieves with filters on both `userId` and `folder: journals/{userId}/`.
- Similarity cache is disabled per request (`cache.enabled = false`) so answers for one userId are never reused for another.
- Retrieved chunks are ownership-checked before entry resolution or answer generation; answers are built via Workers AI from owned context only (not unscoped `chatCompletions` RAG).

Different browser contexts (incognito, debug mode) use different local anon ids and must not see each other’s indexed journals. Sign-out does not rotate the local anon id.

### API

`POST /projector-search` body:

```json
{
  "query": "entries about anxiety at work",
  "mode": "search",
  "userId": "firebase-uid-or-anon-id",
  "indexDigest": "abc123",
  "entries": [{ "id": "…", "dateKey": "2026-05-20", "sentiment": "+", "situation": "…", "details": "…", "updatedAt": 0 }]
}
```

- `mode`: `search` (default), `chat` (follow-up with `messages[]`), or `index` (force reindex only).
- `userId` is **required** (sanitized; no shared `'anon'` fallback).
- Response: `{ type: "entries", entryIds, entries, preamble? }` or `{ type: "answer", text }` or `{ type: "error", message }`.
- Rate limits: 12/hour, 40/day per IP (KV keys `ps:h:` / `ps:d:`).
- `data-fetcher` merges client entries with Firestore by `updatedAt` when `FIREBASE_SERVICE_ACCOUNT_JSON` is set (skipped for `anon_*` user ids).

Client env: `VITE_ENABLE_PROJECTOR_AI_SEARCH`, `VITE_PROJECTOR_SEARCH_ENDPOINT`, `VITE_PROJECTOR_SEARCH_TOKEN` (see root `AGENTS.md`).

