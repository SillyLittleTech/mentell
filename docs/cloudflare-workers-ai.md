# Weekly AI summary setup (Cloudflare Workers AI)

This app keeps AI summary UI hidden unless feature flags are set.

## 1) Frontend feature flags

Create `.env.local`:

- `VITE_ENABLE_WEEKLY_AI_SUMMARY=1`
- `VITE_WEEKLY_AI_ENDPOINT=http://127.0.0.1:8787/weekly-summary`
- `VITE_WEEKLY_AI_TOKEN=dev-local-token` (optional but recommended)

If these are missing, the Weekly AI summary card is not rendered.

## 2) Worker for local testing first

Create a small Cloudflare Worker endpoint that calls Workers AI and returns `{ "summary": "..." }`.

Example `wrangler.jsonc` essentials:

- `name`: your worker name
- `main`: `src/index.ts`
- `compatibility_date`: recent date
- `ai.binding`: `AI`

Set local/prod secrets:

- `wrangler secret put WEEKLY_SUMMARY_TOKEN`

Use `WEEKLY_SUMMARY_TOKEN` to validate `Authorization: Bearer ...` from the frontend.

## 3) Suggested Worker request flow

1. Parse `{ entries: [...] }` from JSON body.
2. Enforce server-side rate limits (recommended baseline: 24/hour/IP and 80/day/IP).
3. Call `env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages: [...] })`.
4. Return JSON: `{ summary: "..." }`.

## 4) Local validation

1. Run worker locally (`wrangler dev`).
2. Run app locally (`npm run dev -- --host 0.0.0.0`).
3. Submit a few entries.
4. Open Weekly tab and click "Generate weekly AI summary".
5. Verify summary text appears and rate limits trigger after repeated calls.

## 5) Production checklist

1. Deploy worker with Wrangler.
2. Set production `WEEKLY_SUMMARY_TOKEN` as secret.
3. Configure frontend env vars in hosting:
   - `VITE_ENABLE_WEEKLY_AI_SUMMARY=1`
   - `VITE_WEEKLY_AI_ENDPOINT=<your worker URL>/weekly-summary`
   - `VITE_WEEKLY_AI_TOKEN=<same token>`
4. Keep UI disabled in environments where these vars are not set.
