# Historical Comparer Wiring — "vs. typical for this time of year" → Little Falls Dashboard

Architecture for surfacing how current discharge compares to a multi-year seasonal baseline, e.g. *"lower than 89% of early Augusts on record."* Scope: Potomac River @ Little Falls Pump Station (USGS-01646500).

Companion to `MODEL_WIRING.md`, which covers the flood-model inference path. This feature is **independent of the model** — it touches no `.pkl`, no `FEATURE_COLUMNS`, and carries none of the train/serve skew risk. It is descriptive statistics over USGS daily values.

## 1. Settled design

```python
BASELINE_PARAMS     = {"00060": "discharge_cfs"}
SEASONAL_YEARS      = 6      # 5 full +/-7d windows survive the recent-180d cut
DAY_PAD             = 7      # window half-width, in days either side of today's date
EXCLUDE_RECENT_DAYS = 180    # keeps the current season out of its own baseline
MIN_SAMPLES         = 30     # ~73 observations available; comfortable margin
TTL_HOURS           = 24
```

Two things get displayed:

1. **Headline** — today's percentile against the 6-year seasonal window. `percent_change` returned as a secondary number.
2. **Per-year strip** — the early-August mean for each individual year, as a small bar row.

## 2. Why seasonal, and why percentile — the evidence

A "vs. the last 365 days' average" comparison is structurally wrong on a river, because discharge is strongly seasonal: an August reading against a trailing-365-day mean reports "far below average" every August, because spring snowmelt is sitting in the baseline. Half the year, in a predictable direction, on a public dashboard.

Both approaches were tested against this site's own history — 5,817 daily means covering 2010-07-06 → 2026-07-06, simulating what each would have displayed on 1,096 real days:

| | Single day, 365d ago | Seasonal window (±7d × 5yr) |
|---|---|---|
| Median day-over-day swing in the headline | 8.7 pts | 3.9 pts |
| 90th percentile swing | **90.1 pts** | 38.9 pts |
| Worst single-day swing | 941 pts | 702 pts |
| Std dev of the reported number | 249 | 128 |
| Days reporting >100% change | 20.6% | 11.1% |

**The two disagree on direction — up vs. down — on 23.6% of days.**

The 90th-percentile row is decisive: on ~36 days a year the single-day version moves the headline more than 90 percentage points overnight, because it anchors a public claim to one arbitrary day's weather.

**But the seasonal window is only ~2× better, not a fix.** Std dev 128, and 11% of days still exceed 100%. Rivers are genuinely that variable, and percent-change is the wrong summary for them: it is unbounded upward (4× normal reads "+300%") but floored at −100%, so the two directions are not visually comparable.

**This is why percentile is the headline and percent-change is secondary.** Percentile is bounded 0–100, stable day to day, and undistorted by the skew.

## 3. Current architecture (as-is)

`backend/app/routers/potomac_river/pot_river_dc_little_falls_pump_station.py` serves two endpoints today: `/current_conditions` (P1D continuous, 4 parameters, for the charts) and `/flood_risk` (model inference).

- **Nothing in `backend/app/` fetches more than 3 days of history.** The longest lookback in the serving path is `_fetch_daily_water_quality(lookback_days=3)`.
- **There is no caching layer in the serving path.** The `requests_cache` session in `flood_features_...py` is Open-Meteo-specific with a deliberate 300s expiry. Every USGS call goes to the network on every request. This feature cannot follow that pattern.
- **The static CSVs under `backend/SOURCES_AND_DATASHEETS/` are not a usable source.** They are dated snapshots; wiring them in as a baseline would freeze the "6-year average" at the pull date and drift further from truth every day, with nothing in the response to indicate it.

**Patterns to reuse (as patterns, not imports):**
- The reshape block in `_fetch_daily_water_quality()` — rename codes → names, `to_datetime(utc=True)`, `to_numeric(errors="coerce")`, `pivot_table(aggfunc="first")`.
- `InsufficientDataError` → `200 {"status": "insufficient_data"}` rather than a `500`, as already established in `get_flood_risk()`.
- The `.astype(object).where(pd.notna(...), None)` NaN scrub in `flood_prediction_...py`. Multi-year USGS data is *more* gap-prone than a 24h pull.

## 4. Why discharge only

`00060` (discharge) is reliably published by USGS as a daily-value series. `00065` (gage height) frequently is not — many sites offer stage only as continuous instantaneous data. Building on `00060` removes that availability unknown entirely.

More importantly, **discharge is the correct variable for this claim**. Stage is measured against a local datum: if the channel scours or aggrades, or the gauge is re-surveyed, the same physical water level reads as a different number. A multi-year gage-height baseline can therefore drift for reasons unrelated to how much water is in the river. Discharge is rating-curve corrected, which absorbs exactly that, and is comparable across years by construction.

Gage height keeps its place in `/flood_risk`, where absolute stage against a flood threshold is the point — a different question from "is this year dry."

If `00065` daily values are later confirmed available and wanted, adding them back is one entry in `BASELINE_PARAMS`; the rest of the code is parameter-agnostic. It should stay a secondary card and should not lead a public claim.

## 5. Fetch

Use `waterdata.get_daily`, **not** `get_continuous`. Six years of 15-minute data is ~210,000 rows; six years of daily means is ~2,200 — the same answer for 1% of the bytes.

```python
SITE_ID = "USGS-01646500"

def _fetch_daily_history() -> pd.Series:
    df, _ = waterdata.get_daily(
        monitoring_location_id=SITE_ID,
        parameter_code=list(BASELINE_PARAMS),
        time=f"P{SEASONAL_YEARS}Y",
    )
    if df.empty:
        raise InsufficientDataError("USGS returned no daily discharge data.")
    # same reshape as _fetch_daily_water_quality(); returns a tz-aware daily Series
```

Note `water_temperature_c` / `temperature_c` naming collisions discussed in `MODEL_WIRING.md` §4 do not arise here, because this module handles one parameter that the feature pipeline does not use. **Still do not import this module from `flood_features_...py`** — the lookback windows and aggregations are chosen for display, not for the model.

## 6. Caching — one tier

A 6-year baseline changes by one day out of ~2,200 per day. Fetching it per request would make this the slowest endpoint in the app for data that is functionally static.

```python
_cache: dict = {"frame": None, "at": None}

def _history() -> pd.Series:
    now = pd.Timestamp.now(tz="UTC")
    if _cache["frame"] is not None and now - _cache["at"] < pd.Timedelta(hours=TTL_HOURS):
        return _cache["frame"]
    frame = _fetch_daily_history()
    _cache.update({"frame": frame, "at": now})
    return frame
```

Six lines, and the difference between a 40 ms endpoint and a multi-second one. Keep `at` tz-aware (UTC) — a naive timestamp raises the moment it meets a tz-aware one.

**No disk snapshot.** An earlier draft specified a Parquet tier for outage resilience. Dropped: no Parquet engine is installed in `backend/venv` (`pyarrow` is a ~40 MB binary dependency for ~2,200 rows), and a USGS outage on a descriptive statistic is a `503` worth taking. Add a CSV snapshot later if USGS actually proves flaky — `to_csv` / `read_csv(index_col=0, parse_dates=[0])` plus a `tz_localize("UTC")` on the way back in.

**Known limitation, accepted:** `_cache` is per-worker. Under `uvicorn --workers 4` there are four copies and up to four cold fetches. Fine at this traffic.

**Warm at startup** in the `lifespan` block in `backend/app/main.py`, after the model load:

```python
    try:
        warm_baseline_cache()
    except Exception as exc:
        # Must NOT block startup -- an upstream outage here would otherwise take
        # down /flood_risk too, which has nothing to do with this feature.
        print(f"Baseline warm failed, will lazy-load on first request: {exc}")
```

The `try/except` is load-bearing, not politeness.

## 7. The statistics

Pure functions over a Series — no I/O, so they are testable without a network round trip.

```python
def _phase(index) -> np.ndarray:
    """Position within the calendar year as a 0..1 fraction, leap-year exact."""
    return (index.dayofyear - 1) / np.where(index.is_leap_year, 366., 365.)


def _seasonal_window(series: pd.Series, target: pd.Timestamp, pad: int = DAY_PAD) -> pd.Series:
    ph = _phase(series.index)
    tp = (target.dayofyear - 1) / (366. if target.is_leap_year else 365.)
    raw = np.abs(ph - tp)
    # Circular distance: the calendar is a ring, not a line. Without the minimum,
    # Dec 29 vs Jan 2 reads as a 0.989 gap instead of 0.011, and every window near
    # New Year's silently comes back half empty.
    return series[np.minimum(raw, 1. - raw) <= pad / 365.].dropna()


def compare(current: float, series: pd.Series, target: pd.Timestamp) -> dict:
    # Exclude the current season BEFORE windowing -- see the note below.
    series = series[series.index < target - pd.Timedelta(days=EXCLUDE_RECENT_DAYS)]
    window = _seasonal_window(series, target)

    if window.count() < MIN_SAMPLES:
        return {"status": "insufficient_data", "sample_size": int(window.count())}

    mean = float(window.mean())
    # Guard the divide BEFORE it happens -- a near-zero denominator produces a
    # "+40,000% above average" headline out of a rounding artifact.
    if not np.isfinite(mean) or abs(mean) < 1e-9:
        return {"status": "undefined", "sample_size": int(window.count())}

    return {
        "status": "ok",
        "percentile": float((window < current).mean() * 100),   # headline
        "percent_change": (current - mean) / mean * 100,        # secondary
        "baseline_mean": mean,
        "baseline_median": float(window.median()),
        "sample_size": int(window.count()),
    }
```

**`EXCLUDE_RECENT_DAYS` is not optional.** Without it the window picks up the trailing week of the *current* year — today's own value plus the six days before it, ~10% of the window. During a genuine drought or flood the past week is strongly correlated with today, so the baseline gets dragged toward current conditions and systematically damps the anomaly the feature exists to surface. The worse the event, the more it under-reports. 180 days is the natural cut: anything shorter either clips the window or leaves current-season data inside it.

**`current` must be a trailing mean, not the latest 15-minute reading.** A single instantaneous value against a multi-year baseline produces a headline that flips between "30% up" and "15% down" on page refresh — which reads as broken even when both numbers are correct. Use the trailing 24h mean; the existing P1D pull in `get_current_data()` already has exactly this. Echo the choice as `current_window` so the frontend can caption it honestly.

**`baseline_median` is returned but not displayed.** Discharge is right-skewed — a couple of flood days in a 73-sample window pull the mean above typical conditions. It is in the response so a large mean/median divergence is diagnosable without a re-fetch.

### Per-year strip

```python
def per_year_means(series: pd.Series, target: pd.Timestamp, pad: int = DAY_PAD) -> dict:
    """Early-August mean per individual year, for the context strip."""
    window = _seasonal_window(series, target, pad)
    return {int(y): {"mean": float(g.mean()), "n": int(g.count())}
            for y, g in window.groupby(window.index.year) if g.count() >= 5}
```

This one deliberately does **not** apply `EXCLUDE_RECENT_DAYS` — the current year is a legitimate bar on the chart. It must only be kept out of its own *baseline*, in `compare()`.

## 8. Why there is no 1-year or 2-year "average"

"1 year ago" and "the 1-year average" are different claims. The first is fine; the second does not have the data behind it. Sample counts for a target of Aug 5, after the 180-day exclusion:

| Lookback | ±7d | ±14d |
|---|---|---|
| 1y | **7 obs** ✗ | **15 obs** ✗ |
| 2y | **20 obs** ✗ | 42 obs ✓ |
| 4y | 47 obs ✓ | 99 obs ✓ |
| 6y | 73 obs ✓ | 154 obs ✓ |

The 180-day cut clips the oldest year in half, so a 1-year lookback leaves 7 days of early-August data. A 7-observation mean called "the 1-year average" is the single-day noise problem again, barely diluted.

**The per-year strip answers the multi-horizon question better than three percentages would**, because the user sees the actual year-to-year spread and can judge whether this year is off-trend or inside normal variance. Three "% vs average" figures hide exactly that, and two of the three would be statistically empty.

## 9. Endpoint contract

```
GET /potomac/little_falls_pump_station/historical_context
```

No query parameters. An earlier draft had `?mode=seasonal|trailing` and `?windows=`; both are gone — there is one correct mode and one correct window, and exposing the wrong ones as options invites them into the UI without their caveats.

```jsonc
{
  "site_id": "USGS-01646500",
  "parameter": "discharge_cfs",
  "generated_at": "2026-08-05T14:03:00Z",
  "baseline_as_of": "2026-08-05T02:00:00Z",
  "current": 1180.0,
  "current_window": "24h",
  "observed_at": "2026-08-05T13:45:00Z",
  "comparison": {
    "status": "ok",
    "percentile": 11.4,
    "percent_change": -51.7,
    "baseline_mean": 2443.0,
    "baseline_median": 2050.0,
    "sample_size": 73
  },
  "per_year": {
    "2021": { "mean": 2610.0, "n": 7 },
    "2022": { "mean": 2180.0, "n": 13 },
    "2023": { "mean": 2890.0, "n": 13 },
    "2024": { "mean": 2340.0, "n": 14 },
    "2025": { "mean": 2200.0, "n": 13 },
    "2026": { "mean": 1180.0, "n": 7 }
  }
}
```

**Return numbers, not sentences.** The frontend composes *"lower than 89% of early Augusts on record."* Copy edits then don't need a backend deploy.

**Error handling — three cases, not one catch-all**, matching `/flood_risk`:
- Too few samples or a near-zero baseline → **`200`** with `comparison.status` set to `insufficient_data` / `undefined`. Expected and recoverable; the card renders "—" and the per-year strip still displays.
- USGS unreachable → **`503`**, retry-able.
- No bare `except Exception: return {}`. A missing comparison must never render as a confident zero.

## 10. Build order

1. **`_fetch_daily_history()` + a `__main__` smoke test.** Print row count and date coverage for `00060`. Confirms the fetch and the reshape before anything depends on them.
2. **Pure stats functions + unit tests** on synthetic Series. Required cases, each a real failure mode:
   - **Dec 28 / Jan 3 targets** — circular wrap. The naïve modulo version returns a half-empty window here.
   - **Feb 29 target, and Mar 1 in a leap year** — phase normalization.
   - **A window containing current-season data** — asserts `EXCLUDE_RECENT_DAYS` actually removed it.
   - **All-NaN series** → `insufficient_data`, not a `NaN` serialized into JSON.
   - **Baseline mean ≈ 0** → `undefined`, not `+40000%`.
   - **A 12-sample window** → `insufficient_data`, not a number.
   - **A single flood outlier** → mean and median diverge as expected, both reported.
3. **TTL cache**, then the `lifespan` warm with its `try/except`.
4. **Router endpoint + Pydantic response model.** The declared `response_model` is what structurally stops a numpy float or bare `NaN` reaching the wire — the bug `CurrentConditionsResponse` exists to prevent.
5. **Frontend.** Percentile sentence, per-year bar strip, and distinct visible states for `insufficient_data` / `undefined`.

**Estimated volume: ~320–380 lines** — service module ~140, router + models ~60, `main.py` warm ~15, tests ~110, frontend ~55.

## 11. Risks

- **Percent-change is asymmetric and unbounded upward.** "+300%" and "−75%" describe reciprocal conditions but do not look reciprocal. This is why it is the secondary field. If the copy ever compares magnitudes, use percentile.
- **"Average" is a loaded word on a right-skewed distribution.** The mean sits above typical conditions on discharge. It ships because it matches what "average" means colloquially, but if `baseline_mean` and `baseline_median` routinely diverge by a lot, revisit whether the sentence should say "typical" and use the median.
- **The seasonal baseline is still noisy** (std dev 128 in the validation above, 11% of days >100%). Percentile as the headline is the mitigation, not the window. Do not let percent-change become the lead number in the UI without re-reading §2.
- **Per-worker cache.** Under multiple uvicorn workers the TTL means "once per day per worker," not per deployment. Harmless here; would matter on a serverless host, which is still `MODEL_WIRING.md` open question 2.
- **Do not import this module into the model's feature pipeline.** Its lookback windows and aggregations are chosen for display. This is the same class of mistake `MODEL_WIRING.md` §4 documents as train/serve skew.

## 12. Open questions

1. Is **±7 days** the right pad? USGS-conventional, and it yields a comfortable 73 samples here, but it is an untuned trade between sample size and seasonal precision.
2. Is **24h the right trailing window for `current`**? 24h stops refresh-flipping; 7d would be steadier but starts to lag genuine events.
3. Should the frontend lead with **percentile or percent-change**? §2 argues percentile. The API returns both, so this is a copy decision.
4. **`SEASONAL_YEARS = 6`** — enough, or is there interest in 10y+ for a climate-trend framing? Cost scales linearly and stays trivial (~3,600 rows at 10y); the constraint is data availability at this site.
5. Should the per-year strip show **all 6 years or a subset**? All 6 is more honest about variance; fewer bars is easier to read on mobile.

---
*Architecture document. No implementation performed. Empirical figures in §2 and §8 were computed against `backend/SOURCES_AND_DATASHEETS/usgs_data_USGS-01646500.csv` (5,817 daily means, 2010–2026).*
