# Mentell 2.0

## Highlights

- **HBCM** replaces calendar streaks: fractional 0–5 heat (+1 per logged day, −0.5 per missed day), display rounds up. Legacy streak values migrate once on first load.
- **Shoppe**: weekly gradient status bar for mood/consistency by day.
- **Quick log** vs **full entry**: quick logs are sentiment (+ optional short note), stored with `entryType: quick_log`, and excluded from projector AI search indexing.
- **Projector**: **Feelings over time** chart with range controls; projector search requests include a compact `feelings_over_time` digest for the Worker.
- **Cluster celebration** and **comeback toast** events (debug panel can fire them for QA).
- **EMA/RMA heat** for sustained risk trends; optional `VITE_DISABLE_RISK_HEAT_V2=1` disables the new path.

## Upgrade

- Existing journal rows are preserved. Streak keys in localStorage migrate to HBCM automatically once (`mentell.v2.hbcm.*`).
- Cloud `meta/score` still uses legacy field names for compatibility; `streak` maps to HBCM display.

## Operators

- Set `VITE_DISABLE_RISK_HEAT_V2` only if you need to turn off the new sustained-risk behavior during rollout.
- Rebuild and redeploy the Worker so `/projector-search` accepts `feelings_over_time` in POST bodies.
