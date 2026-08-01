# Model Wiring Review — Flood Model → Little Falls Dashboard

Read-only architecture review. No implementation performed. Scope: Potomac River @ Little Falls Pump Station (USGS-01646500) chapter only.

## 1. Current architecture (as-is)

The FastAPI backend (`backend/app/main.py`) exposes one real endpoint today — `GET /potomac/little_falls_pump_station/current_conditions` (`backend/app/routers/potomac_river/pot_river_dc_little_falls_pump_station.py`) — which calls `get_current_data()` (`backend/app/services/potomac_river/flood_prediction_pot_river_dc_little_falls_pump_station.py`) to pull the last 24h of **raw, unprocessed** USGS continuous readings (discharge, gage height, water temp, specific conductance) via `dataretrieval.waterdata`. Nothing computes engineered features or calls a model anywhere in `backend/app/`. The Next.js frontend page (`frontend/src/app/chapters/pot_river_dc_little_falls_pump_station/page.tsx`) fetches that endpoint once on mount (no polling) and renders it with `RiverDataChart.tsx` (Recharts line chart). There is no shared API client/hook — the fetch logic is inlined in the page component. Model training happens entirely in standalone notebooks/scripts under `backend/chapters/.../models/flood_threshold/`, disconnected from the running app; only one of the three trained models is actually serialized to disk.

## 2. Gap analysis

**Model artifact reality is narrower than assumed:**
- Only **one** model is actually persisted: `pot_river_near_little_falls_flood_threshold_xgboost_model.json` (`backend/chapters/potomac_river/pot_river_dc_little_falls_pump_station/models/flood_threshold/`). It's a `sklearn.pipeline.Pipeline` wrapping `XGBClassifier`, saved via `joblib.dump(model, "...xgboost_model.json")` (`flood_threshold_xgboost.ipynb`, last cell). **The `.json` extension is a lie** — it's a pickle (`\x80\x04...` protocol header, confirmed with a hex dump). `file` misidentifies it as thermal-camera data. This is not XGBoost's native `save_model()` JSON/UBJ format.
- The **logistic regression notebook** (`flood_threshold_log_regression.ipynb`) trains a model but has **no save/export cell** — nothing is ever written to disk. Same for the **random forest notebook** (`flood_threshold_rf.ipynb`) and `baseline_random_forest.ipynb`. So "logistic regression classifier and XGBoost model" as two deployable artifacts is aspirational, not current state — only XGBoost exists on disk.
- **14 features, not 17** (`feature_columns` in `flood_threshold_xgboost.ipynb`, cell 4): `gage_height_ft`, `gage_height_roc_1h`, `gage_height_roc_6h`, `precip_3hr_log`, `precip_24hr_log`, `precip_72hr_log`, `temperature_2m`, `wind_speed_10m`, `vapour_pressure_deficit`, `rain`, `snowfall`, `snow_depth`, `specific_conductance_us_cm`, `temperature_c`.

**Nothing replicates the training feature pipeline at inference time.** `flood_threshold.py` (the only file that touches the saved model outside the notebook) just does `joblib.load(...)` and prints `model.get_params()` — it's a load smoke-test, not an inference path, and it isn't imported by `backend/app/` anywhere.

**Live data vs. required features — the real gap:**
| Feature | Live source today? | Notes |
|---|---|---|
| `gage_height_ft` | ✅ `current_conditions` (P1D window) | direct |
| `gage_height_roc_1h` / `roc_6h` | ⚠️ derivable | needs 1h/6h of trailing gage-height history — the P1D pull covers this, but no code computes the diff |
| `specific_conductance_us_cm` | ✅ `current_conditions` | name matches training column exactly |
| `temperature_c` | ⚠️ **latent mismatch, not yet a live bug** | Training is correct in isolation — the CSV's `temperature_c` came from `get_daily()` (daily mean, param `00010`) and the notebook trained on it faithfully. Separately, `get_current_data()` (the dashboard's live-fetch function) also pulls param `00010`, but via `get_continuous()` and labeled `water_temperature_c` — different name, different aggregation (instantaneous vs. daily mean). Nothing currently wires these two together, so there's no active bug today. The risk is specifically that whoever builds the live feature pipeline reuses `get_current_data()` as-is and inherits this mismatch — it needs to be reconciled deliberately during that work, not assumed away. |
| `precip_3hr_log` / `24hr_log` / `72hr_log` | ❌ **not fetched at all** | requires Open-Meteo hourly precipitation held in a **72-hour trailing window**, summed at three horizons, log1p-transformed. Nothing in `backend/app/` calls Open-Meteo. Only the offline ingestion script (`pot_river_dc_little_falls_pump_sta.py`) does, and only for historical training pulls. |
| `temperature_2m`, `wind_speed_10m`, `vapour_pressure_deficit`, `rain`, `snowfall`, `snow_depth` | ❌ **not fetched at all** | same problem — 6 of 14 features are Open-Meteo hourly variables with zero live path today |

In short: **8 of 14 features (all weather-derived) have no live data path whatsoever**, and one of the remaining features has a silent name/semantics mismatch. This is the "silently break" scenario the task called out, and it's already present, not hypothetical.

**Dependency gap:** `backend/requirements.txt` (and root `requirements.txt` — same file, UTF-16 encoded, worth normalizing) has **no `xgboost` entry**. The pickled model cannot even be unpickled in a fresh environment built from this file — `joblib.load` will raise `ModuleNotFoundError: No module named 'xgboost'` before any feature-mismatch issue is reached.

**Path fragility (pre-existing bug that will resurface):** `flood_threshold.py` loads the model via a hardcoded relative path `"backend/chapters/potomac_river/.../flood_threshold/...json"`, which only resolves if the process cwd is the repo root. It also has a leftover `print(os.getcwd())` debug line. Any backend startup loader needs to use a path anchored to `Path(__file__)`, not cwd.

**No deployment config found** for the backend (no `Dockerfile`, `Procfile`, `render.yaml`, `fly.toml`, `vercel.json` for it) — where/how FastAPI is actually hosted today is undetermined from the repo and needs to be confirmed before reasoning about cold starts or XGBoost binary compatibility.

**Frontend has no shared data layer to extend.** `page.tsx` inlines its own `fetchContinuousData`; there's no hook/client (no SWR/React Query in `package.json` either — just raw `fetch` in a `useEffect`). A `/predict` consumer would either duplicate this pattern or (better) prompt extracting a small shared fetch hook, since we'd now have two endpoints to poll on the same page.

## 3. Proposed integration architecture

A build procedure, in order. Each step is small enough to verify on its own before moving to the next — don't start step *n+1* until step *n*'s output has been sanity-checked.

**Step 0 — Unblock loading (housekeeping, do first, no design decisions involved).**
- Add `xgboost` to `backend/requirements.txt` (and root `requirements.txt` — currently the same file, oddly UTF-16 encoded; worth normalizing to UTF-8 while touching it). Without this, nothing below can run.
- Re-save the model artifact under a real extension: `pot_river_near_little_falls_flood_threshold_xgboost_model.pkl` instead of `...json`. Same `joblib.dump`, just an honest filename — no retraining required.

**Step 1 — Feature-pipeline module (the actual hard part; do this before touching `app/main.py` or the router).**
New file, e.g. `backend/app/services/potomac_river/flood_features_pot_river_dc_little_falls_pump_station.py`, exposing one function that returns a single-row DataFrame shaped exactly like `feature_columns` in `flood_threshold_xgboost.ipynb`:
1. Pull trailing USGS gage height (≥6h) → derive `gage_height_ft`, `gage_height_roc_1h`, `gage_height_roc_6h`. The existing P1D pull in `get_current_data()` already covers enough history for this part.
2. Pull trailing Open-Meteo **hourly** data (≥72h) via the forecast endpoint with `past_days` — **not** the `archive-api` endpoint used in training, which is history-only and unsuitable for live/recent queries. Derive `precip_3hr_log`, `precip_24hr_log`, `precip_72hr_log` (rolling sum + `log1p`, matching the notebook's transform), and pass through `temperature_2m`, `wind_speed_10m`, `vapour_pressure_deficit`, `rain`, `snowfall`, `snow_depth` directly.
3. Pull `specific_conductance_us_cm` (already available from `get_current_data()`, name matches as-is).
4. Pull `temperature_c` via `get_daily()`, param `00010`, daily mean — **not** `get_current_data()`'s `water_temperature_c` (instantaneous, different aggregation). This is the mismatch flagged in the gap analysis; fixing it *is* this step.
5. Assemble the row with columns in the exact name/order the fitted pipeline expects. Let the pipeline's own `StandardScaler`/`SimpleImputer` steps do scaling — don't hand-roll it.
- **Verify before moving on:** run this function against a timestamp you also have a row for in the training CSV, and diff the two feature vectors. If they don't match, stop here — nothing downstream will save you from a wrong feature vector.

**Step 2 — Load the model at startup, not per-request.**
In `backend/app/main.py`, load the `.pkl` once (FastAPI lifespan/startup event) and store it on `app.state.flood_model`. Build the path from `Path(__file__).resolve()` up to the models directory — never cwd-relative, which is the bug already present in `flood_threshold.py`'s hardcoded `"backend/chapters/..."` string (plus its leftover `print(os.getcwd())`). Loading once matters because deserializing a sklearn `Pipeline` + XGBoost booster on every request is pure waste, and doubly so if the host turns out to be serverless (see deployment note below).

**Step 3 — `/predict` endpoint.**
Add to the existing router (`backend/app/routers/potomac_river/pot_river_dc_little_falls_pump_station.py`), e.g. `GET /potomac/little_falls_pump_station/flood_risk`. No request body needed for v1 — the site's lat/lon is fixed, so the server derives everything from live sources.
- **Response** (typed Pydantic model):
  ```json
  {
    "probability": 0.42,
    "risk_level": "elevated",
    "model_version": "xgboost-v1",
    "generated_at": "2026-08-01T14:32:00Z",
    "gauge_reading_at": "2026-08-01T14:15:00Z",
    "data_freshness": { "gauge_age_minutes": 17, "weather_age_minutes": 55 }
  }
  ```
  `risk_level` is derived from `ALERT_THRESHOLD` (the notebook's `0.716`), not a raw 0.5 cutoff — see open question 5 on whether that value is final.
- **Error handling**, three distinct cases, not one catch-all:
  - Upstream USGS/Open-Meteo unreachable → `503`, retry-able.
  - Feature pipeline can't fill its rolling window yet (e.g. <72h of weather history) → `200` with `"status": "insufficient_data"`, `probability: null` — not a `500`.
  - Gauge reading older than an agreed staleness threshold (open question 3) → still predict, but set `"stale": true` rather than failing closed.
  - No bare `except Exception: return {}` — that's how a real failure turns into a silent blank on the dashboard.

**Step 4 — Frontend consumption.**
Extract the inline `fetchContinuousData` in `page.tsx` into a small shared hook (e.g. `useRiverData`) so `current_conditions` and the new `flood_risk` call share base-URL and error/loading handling instead of duplicating the pattern a second time. Poll every 5–15 min (matched to USGS's ~15-min update cadence — no need for anything faster given the model's own 24h lookahead). Check `node_modules/next/dist/docs/` per `AGENTS.md` before leaning on Next's built-in fetch caching/revalidation, since this project's Next 16 explicitly deviates from familiar Next.js conventions — a plain `setInterval` inside the hook is the safe default if that's not confirmed. Render explicit `insufficient_data` and `stale` states, not just loading/error/success — a stale number should visibly say so, not look current.

**Deployment note (needs an answer before step 2 can be finalized):** no `Dockerfile`/`Procfile`/`render.yaml`/`vercel.json` for the backend was found in-repo, so the actual host is unconfirmed. Whatever it is, it must tolerate XGBoost's compiled-binary footprint — if it turns out to be a constrained serverless runtime, that's a stronger reason to keep the startup-singleton load from step 2 rather than anything that re-initializes per-invocation.

## 4. Risks to flag explicitly

- **Train/serve skew (highest risk).** No live bug exists today — training is correct, and nothing yet feeds live data to the model. But the `temperature_c` / `water_temperature_c` naming+semantics mismatch (see gap table above) is a landmine sitting in the repo's two disconnected code paths, and it's a preview of the general failure mode: whoever writes the feature-pipeline module needs to treat the training notebook's `feature_columns` block as the spec, and either import shared code or diff column-by-column against it — not casually reuse `get_current_data()` and assume the names line up.
- **Frequency-assumption inconsistency in the training pipeline itself.** `pot_river_dc_little_falls_pump_sta.py` computes `precip_3hr`/`24hr`/`72hr` with `.rolling(36)/.rolling(288)/.rolling(864)` — comments say "rolling(3)=3h, rolling(24)=24h" but the actual window sizes (36/288/864) imply ~5-minute row spacing, while the modeling notebook separately declares `FREQ_MINUTES = 15`. Also, `pd.concat([hydraulic_df, water_quality_df, weather_df], axis=1)` naively unions three DataFrames with **different native cadences** (15-min hydraulic, hourly weather, daily water quality) on a shared `DatetimeIndex` — this produces a sparse union index rather than a properly resampled/aligned one, and only the water-quality/weather columns get `ffill()`'d after the fact. Worth resolving (or at least documenting the real cadence) before trusting the rolling windows numerically, since it directly determines what "72 hours of trailing weather" needs to mean at inference time.
- **Model artifact format/versioning.** A `joblib`-pickled sklearn+XGBoost pipeline saved under a `.json` filename is fragile in two ways: (1) pickle deserialization is version-sensitive (sklearn/xgboost/joblib minor-version drift between training env and serving env can break or silently change `predict_proba` behavior) and unlike XGBoost's native format, isn't forward-compatible; (2) the misleading extension will confuse the next person who touches this file (as it should — `file` itself misidentifies it). Recommend re-exporting with a real `.pkl`/`.joblib` extension, and considering `booster.save_model(...)` (native UBJ/JSON) for the XGBoost step specifically if the sklearn wrapper (imputer/scaler) can be kept separately versioned. Loading arbitrary pickles is also a minor supply-chain consideration if this file's provenance ever becomes less trusted than "our own training notebook."
- **No model versioning strategy exists.** There's no naming convention, no metadata (training date, feature list hash, metrics) stored alongside the artifact, and no plan for what happens to in-flight predictions when the file is silently replaced. At minimum, the `/predict` response should echo a `model_version` and the feature list actually used, so a bad retrain is diagnosable from the API response alone.
- **Silent-failure risk in the existing pattern.** The current `current_conditions` endpoint returns whatever `get_current_data()` produces with no validation; if USGS returns partial/empty data, the frontend gets an empty-but-200 response. The same laziness in a `/predict` endpoint is worse — a wrong-but-confident probability is more dangerous than a visible error, especially for a flood-risk number. Explicit `insufficient_data`/`stale` states (proposed above) exist specifically to prevent this.
- **`requirements.txt` currently can't serve this model at all** (no `xgboost`) — this will surface immediately as an import error the moment anyone tries to wire the loader into `app.main`, before any of the feature-pipeline work even gets exercised.

## 5. Open questions before implementation starts

1. Which model actually ships first — the XGBoost pipeline (the only one currently serialized) — or do you want the logistic-regression model trained, saved, and served too/instead? If both, does `/predict` need a way to select or return both, or does the plan settle on XGBoost only for now?
2. What's the actual backend deployment target (Vercel serverless functions, a separate host like Render/Fly/Railway, a VM)? No config was found in-repo, and this materially changes the cold-start/XGBoost-binary-size discussion.
3. What's an acceptable "gauge is stale" threshold for the dashboard to show a warning vs. refuse to predict — 1h? 2h? Tied to USGS's own typical reporting lag?
4. Should Open-Meteo calls at inference time use the forecast API (to also factor in near-term forecast, not just past conditions) or strictly the trailing-72h actuals to match training exactly? These are different design choices with different skew implications.
5. Is `ALERT_THRESHOLD = 0.716` (from the notebook, chosen via a recall-target sweep on one train/test split) the value you want hardcoded into the serving response's `risk_level` mapping, or does it need to be re-derived/reviewed before going live?
6. Who/what triggers retraining, and how often — is there an intended cadence, or is this strictly manual for now? This affects whether `model_version` needs to be more than a static string.

---
*Prepared as a read-only review — no code changes were made. Awaiting confirmation before implementation begins.*
