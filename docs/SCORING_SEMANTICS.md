# Mentell 2.x scoring and visualization semantics

Single source of truth for **HBCM** (Heat-Based Consistency Multiplier), **feelings-over-time** colors, Shoppe weekly bar, and **EMA/RMA heat** risk signals. Internal identifiers: `hbcm`, `ema_rma_heat`, `quick_log`, `entry`, `feelings_over_time`.

## HBCM (0–5 scale)

- **Internal value** `hbcmRaw`: fractional number in `[0, 5]`.
- **Display** `hbcmDisplay = ceil(hbcmRaw)` clamped to 0–5 (round up for leeway).
- **Day completion** (at least one journal action that day: **Entry** or **Quick Log**): `+1` to `hbcmRaw`, capped at `5`.
- **Missed local calendar day** after first use: if the previous calendar day had no completion, apply `-0.5` once per missed day when the user next opens the app or submits (floor at `0`).
- **First use**: no missed-day penalties until the first completed day is recorded.
- **Migration**: legacy integer streak `S` maps to `min(5, S * 0.85)` at upgrade so long streaks are not unfairly zeroed.

## Shoppe weekly bar & Feelings Over Time

Sentiment classes (full **Entry** uses pill sentiment; **Quick Log** uses the same `+` / `=` / `-`):

| Class    | Meaning                                | Color role     |
| -------- | -------------------------------------- | -------------- |
| positive | `+`                                    | Green          |
| neutral  | `=`                                    | Yellow         |
| negative | `-`                                    | Red            |
| missed   | no log on a past day (after first use) | Black (stripe) |
| no_data  | future days or before first use        | Light grey     |

Segments use **gradient blends** between adjacent days. Quick Logs contribute the same classes; multiple logs per day use the **worst** sentiment (`-` &gt; `=` &gt; `+`) for that day’s display.

## EMA/RMA heat (risk compounding)

- **Normalized input** `score_t ∈ [-1, 1]` per assessed message (distress ↑ positive).
- **EMA**: `EMA_t = score_t × α + EMA_{t-1} × (1 − α)` with **N = 5**, `α = 2/(N+1) ≈ 0.333`.
- **RMA** (rolling): simple mean of the last **N** normalized inputs (same window) for audit/compare.
- **Initialization**: `EMA_0 = score_0`.
- **Sparse data / gaps**: optional gentle decay toward `0` when skipping assessments (not applied between Quick Log-only days unless assessed).
- **Crisis / support escalation**: uses sustained EMA above threshold across several messages, not a single spike (wired in `riskAssessment.ts`).

## Hypermania / over-stimulation (distinct from crisis)

- Triggered when **excitement / milestone** language (EXCE score) is **repeatedly** high while the model would otherwise show only a **positive** celebration — separate copy and thresholds from crisis lines (see in-app modal).
