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
```

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
wrangler secret put ALLOWED_ORIGIN   # e.g. https://YOUR_ORG.github.io
npm run deploy
```

Set GitHub Actions variables/secrets for the frontend build (see root `AGENTS.md`).
