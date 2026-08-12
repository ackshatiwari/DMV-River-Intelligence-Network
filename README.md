# DMV River Intelligence Network

## Project overview

The **DMV River Intelligence Network (DMV RIN)** is a student-led nonprofit that makes river data
for the DC–Maryland–Virginia region easier to understand. **This repository is the organization's
website and prediction service** — it is not the organization itself, and it does not collect any
field data.

Technically, this repo is a two-service monorepo:

- a **FastAPI backend** (`backend/`) that pulls live public data from USGS and Open-Meteo, reshapes
  it into JSON, runs a trained XGBoost flood-risk classifier on it, and serves the results over a
  handful of read-only HTTP endpoints;
- a **Next.js frontend** (`frontend/`) that renders the public marketing site plus a per-chapter
  river dashboard that calls those endpoints.

The repo also carries the **offline data-science work** (`backend/chapters/`) — the ingestion script
that builds the training CSV, the exploratory notebooks, and the serialized model artifact the API
loads at startup.

The organization is structured around **river chapters**, one per watershed. Exactly one chapter is
implemented in code today: **Potomac River near Washington, DC — Little Falls Pump Station
(USGS site `USGS-01646500`)**. Everything under `potomac_river/` in both the backend and the
frontend is that one chapter; the folder layout anticipates more.

---

## What the organization does

The **DMV River Intelligence Network** is a student-led nonprofit dedicated to making Northern Virginia's rivers easier to understand through technology, data science, and environmental education. Rather than collecting new field data or replacing government agencies, the organization brings together publicly available environmental datasets from sources such as stream gauges, weather services, and state monitoring programs into one unified platform (i.e. this website). Rather than presenting users with raw scientific measurements, the platform translates complex environmental data into audience-specific insights. Residents can quickly understand current river conditions, kayakers and anglers can view recreational risk forecasts, educators can access classroom-ready visualizations, nonprofits can explore watershed trends, and researchers can access transparent model outputs alongside the underlying public data.

The organization is built around **river chapters**, with each chapter focusing on a single watershed, such as the Potomac, Goose Creek, or the Anacostia River. Within each chapter, students work in specialized teams for data engineering, machine learning and data science, research, and community outreach. Because every watershed has unique hydrology, tributaries, and environmental challenges, each chapter develops models specifically tailored to its river rather than relying on a one-size-fits-all approach.

Beyond developing technology, the nonprofit seeks to connect students, educators, watershed organizations, and communities through partnerships and outreach. Through classroom presentations, library workshops, and community demonstrations, the organization teaches students and residents how to interpret environmental data, understand local watershed science, and responsibly use predictive tools when making recreational or educational decisions.

### Partnerships

- Unofficial partnership with the **Interstate Commission on the Potomac River Basin (ICPRB)**.

---

## Deployment

Both services are deployed and live.

| Service | Platform | URL | Source directory |
| --- | --- | --- | --- |
| Frontend | Vercel | <https://dmv-river-intelligence-network.vercel.app/> | `frontend/` |
| Backend | Render | <https://dmv-river-intelligence-network.onrender.com/> | `backend/` |

**There is no deployment configuration checked into this repo** — no `vercel.json`, `render.yaml`,
`Dockerfile`, or `Procfile`. Build commands, start commands, root directories, and environment
variables are all configured in the Vercel and Render dashboards. If you need to change how either
service boots, the dashboard is the only place to do it.

### Keep-alive cron ping

Render's free tier **spins a web service down after ~15 minutes with no inbound traffic**. Waking it
back up is a cold start: the container restarts, Python re-imports, the ~346 KB model is
deserialized from disk, and the historical-baseline cache re-warms with six USGS calls. A visitor
who lands during that window waits many seconds for the dashboard to fill in.

To avoid that, an external **cron-job.org** job pings the Render backend **every 10 minutes**, which
keeps the service inside the 15-minute idle window and therefore permanently warm. The cheap
endpoint that exists for this purpose is the API root:

```
GET https://dmv-river-intelligence-network.onrender.com/
→ {"status": "DMV RIN API is running"}
```

It touches no upstream API and does no work. The cron job itself is configured on cron-job.org, not
in this repo, so it is invisible from a `git clone` — that is why it is documented here.

### Environment variables

Names only; values live in Vercel/Render and in an untracked local `frontend/.env.local`
(`.env*` is gitignored).

**Frontend (`frontend/`)**

| Variable | Required | Used by | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | **Yes** | [page.tsx](frontend/src/app/chapters/pot_river_dc_little_falls_pump_station/page.tsx), [page.tsx](frontend/src/app/page.tsx) | Base URL of the FastAPI backend, no trailing slash. `NEXT_PUBLIC_` means it is inlined into the browser bundle at build time — a Vercel redeploy is required after changing it. The dashboard throws a visible error if it is unset. |
| `NEXT_RESEND_API_CREDENTIALS` | For the contact form | [route.ts](frontend/src/app/api/send/route.ts) | Resend API key used to deliver contact-form messages. Defaults to `''`, so the form fails at send time rather than at build time if it is missing. |
| `CONTACT_TO_EMAIL` | No | [route.ts](frontend/src/app/api/send/route.ts) | Destination inbox for contact-form mail. Falls back to a hardcoded address. |

**Backend (`backend/`)**

The backend reads **no environment variables at all** — every constant (site ID, coordinates,
parameter codes, alert threshold, model path) is hardcoded in source. No secrets are needed to run
it; USGS and Open-Meteo are both unauthenticated public APIs. The one deployment-time setting that
matters is Render's start command, which must launch `app.main:app` with `backend/` as the working
directory.

---

## File structure

```
River_Network_Nonprofit/
├── AGENTS.md                       # Instructions for AI coding agents (Next.js version warning)
├── CLAUDE.md                       # One-line include of AGENTS.md
├── README.md                       # This file
├── MODEL_WIRING.md                 # Architecture review: how the ML model was wired into the API
├── HISTORICAL_COMPARER_WIRING.md   # Architecture review: the seasonal-baseline feature
├── requirements.txt                # Full pip freeze of a dev machine (UTF-16). NOT the deploy manifest
├── .cache.sqlite                   # Committed requests-cache DB — an accident, see Known issues
├── .gitignore
│
├── backend/                        # FastAPI service + all offline data-science work
│   ├── .python-version             # 3.13
│   ├── requirements.txt            # ← the real, pinned runtime manifest (13 packages)
│   ├── requirements-dev.txt        # Full pip freeze (UTF-16), notebooks/plotting included
│   ├── SOURCES_AND_DATASHEETS/     # Empty (.gitkeep); local CSV dumps land here, gitignored
│   │
│   ├── app/                        # The web service — everything served over HTTP
│   │   ├── main.py                 # FastAPI app: model load, CORS, cache warm, root endpoint
│   │   ├── routers/                # HTTP layer: URL paths, response schemas, status codes
│   │   │   └── potomac_river/
│   │   │       └── pot_river_dc_little_falls_pump_station.py
│   │   └── services/               # Business logic: data fetching, feature building, statistics
│   │       └── potomac_river/
│   │           ├── flood_prediction_pot_river_dc_little_falls_pump_station.py
│   │           ├── flood_features_pot_river_dc_little_falls_pump_station.py
│   │           ├── historical_baseline_pot_river_dc_little_falls_pump_station.py
│   │           └── test.py         # Scratch script, not a test suite
│   │
│   └── chapters/                   # Offline: ingestion, notebooks, trained model artifacts
│       ├── SOURCES_AND_DATASHEETS/ # Where the ingestion script writes its CSV (gitignored)
│       └── potomac_river/
│           └── pot_river_dc_little_falls_pump_station/
│               ├── pot_river_dc_little_falls_pump_sta.py   # Training-data ingestion script
│               ├── data_visualization.py                   # Ad-hoc matplotlib/seaborn plots
│               ├── baseline_random_forest.ipynb            # Early streamflow-regression experiment
│               └── models/
│                   └── flood_threshold/
│                       ├── flood_threshold_xgboost.ipynb        # ← the SHIPPING model's notebook
│                       ├── flood_threshold_rf.ipynb             # Random-forest attempt
│                       ├── flood_threshold_log_regression.ipynb # Logistic-regression baseline
│                       ├── flood_threshold.py                   # Broken load script, see Known issues
│                       └── pot_river_near_little_falls_flood_threshold_xgboost_model.pkl
│
└── frontend/                       # Next.js 16 App Router site
    ├── package.json                # next 16.2.9, react 19.2.4, recharts, resend
    ├── next.config.ts              # Minimal; dev indicators off
    ├── tsconfig.json               # "@/*" path alias resolves from the frontend/ root
    ├── eslint.config.mjs
    ├── postcss.config.mjs          # Tailwind v4 via @tailwindcss/postcss
    ├── components/
    │   └── RiverDataChart.tsx      # Re-export shim pointing at src/components/RiverDataChart.tsx
    ├── public/                     # Static images: logo, favicon, river photos, map marker
    └── src/
        ├── app/                    # App Router: routes, layout, global CSS
        │   ├── layout.tsx          # Root layout, fonts, dark page background
        │   ├── globals.css
        │   ├── page.tsx            # "/" — single-page site with client-side tab switching
        │   ├── api/send/route.ts   # POST /api/send — contact form → Resend
        │   └── chapters/
        │       ├── page.tsx        # "/chapters" — chapter directory
        │       └── pot_river_dc_little_falls_pump_station/
        │           └── page.tsx    # The live dashboard; owns ALL backend fetching
        └── components/
            ├── RiverDataChart.tsx        # Recharts line charts, one card per parameter
            ├── FloodRiskCard.tsx         # Renders /flood_risk
            ├── HistoricalContextCard.tsx # Renders /historical_context
            ├── email-template.tsx        # React Email body for contact messages
            ├── about/ contact/ footer/ get_involved/ home/ locations/ logo/
            └── trends/ meet_the_team/    # Both empty files, see Known issues
```

---

## Anatomy: backend

### The service layer vs. the router layer

The split is strict and worth internalizing before you edit anything:

- **`app/routers/`** owns HTTP. URL paths, Pydantic response models, and the choice of status code
  live here. It contains no data logic.
- **`app/services/`** owns data. Fetching, reshaping, feature engineering, and statistics live here.
  These modules know nothing about HTTP and can be run standalone (`python -m ...`) for debugging.

### `app/main.py`

The FastAPI application object. Three responsibilities:

1. **Loads the model once, at startup**, inside a `lifespan` async context manager, and stashes it on
   `app.state.flood_model`. The path is built from `Path(__file__).resolve()` rather than the current
   working directory, so it resolves correctly regardless of where `uvicorn` is launched from.
2. **Warms the historical-baseline cache** by calling `warm_baseline_cache()`, so the first visitor
   of the day doesn't pay for six cold USGS fetches. This call is wrapped in a broad `except` on
   purpose: a USGS outage while warming a purely descriptive statistic must not prevent the server
   from starting and serving `/flood_risk`.
3. **Configures CORS.** An exact allowlist (`localhost:3000`, `127.0.0.1:3000`, the production
   Vercel domain) plus a regex admitting Vercel's per-branch preview hostnames. `allow_credentials`
   is deliberately `False` — nothing here reads cookies, and the preview regex is loose enough that
   a stranger could in principle register a matching hostname.

It also defines two trivial endpoints: `GET /` (the cron keep-alive target) and `GET /api/data`
(a leftover scaffold endpoint).

### `app/routers/potomac_river/pot_river_dc_little_falls_pump_station.py`

Every chapter endpoint, mounted under the prefix **`/potomac/little_falls_pump_station`**.

| Endpoint | What it returns | Error behavior |
| --- | --- | --- |
| `GET /health` | `{"status": "..."}` | — |
| `GET /current_conditions` | Last 24 h of USGS continuous readings: a per-parameter `snapshot` plus a `data` series for the charts | `503` if USGS is unreachable |
| `GET /flood_risk` | Model probability, `risk_level`, `model_version`, per-source data freshness, `stale` flag | `200` with `status: "insufficient_data"` when rolling windows can't be filled; `503` when an upstream source is down |
| `GET /historical_context` | Today's discharge vs. a 5-year seasonal baseline: percentile, percent change, baseline mean/median, per-year strip | `503` if the baseline can't be built at all; a too-small sample is **not** an error — it comes back as `comparison.status` inside a `200` |

The two-tier error model is the design point: *"we can't answer yet"* is a `200` the UI renders
calmly, while *"the internet is broken"* is a `503` the UI retries. Neither is ever a silent blank.

This file also defines the Pydantic response models (`CurrentConditionsResponse`,
`FloodRiskResponse`, `HistoricalContextResponse`, …). Those models are the contract — the frontend's
TypeScript types are hand-mirrored from them, so **changing one means changing the other**.

Two constants live here:
- `ALERT_THRESHOLD = 0.318` — probability at or above which `risk_level` becomes `"elevated"`.
  Taken from cell 10 of the XGBoost notebook.
- `STALE_AFTER_MINUTES = 120` — how old the gauge reading may be before the response sets
  `stale: true`. A placeholder, not a value derived from any requirement.

### `app/services/.../flood_prediction_...py` — live conditions

Backs `/current_conditions`. Pulls the last 24 h of four USGS continuous parameters (`00060`
discharge, `00065` gauge height, `00010` water temperature, `00095` specific conductance) and pivots
them onto a shared time index.

The four parameters report on **different cadences**, so that pivot is deliberately sparse — most
cells are `NaN`. JSON has no `NaN` literal, so the module converts the frame to
`{column: {row_index: value | null}}` with an `.astype(object)` step that actually sticks (assigning
`None` into a float64 column silently reverts to `NaN`). This is the entire reason the module has
more than one function.

`historical_baseline_...py` imports `get_current_data()` from here for its "current" value, since
it's the same 24 h pull the charts already make.

### `app/services/.../flood_features_...py` — the inference feature pipeline

Backs `/flood_risk`. This is the most delicate file in the repo: it rebuilds, from live data, the
exact 14-column row the model was trained on.

It **deliberately does not reuse** `get_current_data()`. Training used the **daily mean** for water
temperature and specific conductance; the charts use **instantaneous** readings of the same
parameter codes. Reusing the chart path would quietly feed the model a different quantity than it
learned on — classic train/serve skew. Same reason `historical_baseline_...py` must never be
imported here.

`FEATURE_COLUMNS` is copied verbatim from the notebook's `feature_columns` cell, and the final
DataFrame is constructed by **selecting on that list** rather than trusting dict insertion order.
Anything that changes in the notebook must change here too.

Sources and windows:
- **Gauge height** (USGS continuous, `P1D`) → current value plus 1 h and 6 h rate of change. Live
  USGS occasionally skips a reading, so rate of change is computed as *"most recent value at or
  before T minus N hours"* rather than the notebook's fixed row-offset `.diff(n)`.
- **Weather** (Open-Meteo *forecast* API with `past_days`, since the archive API used for training
  has no recent data) → 3/24/72-hour precipitation sums, log1p-transformed, plus six passthrough
  variables from the latest hour. Future-dated forecast hours are trimmed so the model never sees
  a value from the future.
- **Water quality** (USGS daily, `P3D`) → latest daily-mean temperature and specific conductance.

Any source lacking enough history raises `InsufficientDataError`, which the router turns into the
`200 insufficient_data` response.

### `app/services/.../historical_baseline_...py` — seasonal comparison

Backs `/historical_context`. Answers *"is this a dry August?"*, not *"is this a flood"* — it is
completely independent of the model and touches no `.pkl`.

For each of the last 6 years it makes one small USGS `get_daily` call for the ±7 days around today's
date in that year, letting USGS do the date selection server-side (no day-of-year math, no December
wraparound bug, ~90 rows instead of ~2,200). The **current year is included in the per-year strip
but excluded from the baseline** — otherwise a real drought would drag the baseline toward itself
and under-report exactly when it matters most.

**Discharge only, on purpose.** Gauge height is measured against a local datum that can shift when
the channel scours or the gauge is re-surveyed; discharge is rating-curve corrected and comparable
across years.

The result is cached **keyed on the target date**, not on a TTL, so it refetches precisely when the
date rolls over. The cache is a module-level dict, therefore per-process: under
`uvicorn --workers N` you get N copies and up to N cold fetches.

### `chapters/` — offline work

- **`pot_river_dc_little_falls_pump_sta.py`** — the training-data ingestion script. Fetches
  15-minute hydraulic data, daily water quality, and hourly Open-Meteo weather for 2010-07-06 →
  2026-07-06 (chunked to stay under the API's ~1100-day cap), concatenates them, forward-fills the
  sparse columns, adds rolling precipitation sums, and writes
  `backend/chapters/SOURCES_AND_DATASHEETS/usgs_data_USGS-01646500.csv`. Designed to be **copied
  per chapter** — edit the three config blocks at the top.
- **`models/flood_threshold/flood_threshold_xgboost.ipynb`** — the notebook that produced the
  shipping model. The other two notebooks in that folder are earlier attempts and are not served.

### The model artifact

**Location:**
[`backend/chapters/potomac_river/pot_river_dc_little_falls_pump_station/models/flood_threshold/pot_river_near_little_falls_flood_threshold_xgboost_model.pkl`](backend/chapters/potomac_river/pot_river_dc_little_falls_pump_station/models/flood_threshold/pot_river_near_little_falls_flood_threshold_xgboost_model.pkl)
(~346 KB, committed to git).

**What it is:** a `joblib`-pickled scikit-learn `Pipeline` with a single step, an `XGBClassifier`
(300 trees, `learning_rate=0.05`, `max_depth=3`, `subsample=0.8`, `colsample_bytree=0.8`,
`random_state=42`).

**How it's loaded:** once, in `main.py`'s `lifespan` hook, via `joblib.load(MODEL_PATH)`, then held
on `app.state.flood_model`. The router reads it off `request.app.state`. It is never reloaded per
request.

**Input shape:** a single-row pandas DataFrame with exactly these 14 columns, in this order:

```
gage_height_ft, gage_height_roc_1h, gage_height_roc_6h,
precip_3hr_log, precip_24hr_log, precip_72hr_log,
temperature_2m, wind_speed_10m, vapour_pressure_deficit,
rain, snowfall, snow_depth,
specific_conductance_us_cm, temperature_c
```

**Output shape:** `model.predict_proba(df)` returns a `(1, 2)` array; the service takes `[:, 1][0]`,
the probability of the positive class. The positive class means *"gauge height will exceed the 5.0 ft
flood action stage at some point in the next 24 hours."*

**Training summary** (all figures from the notebook's own outputs):

- 624,474 valid 15-minute gauge readings, 2010-07-06 → 2026-07-06, joined with hourly Open-Meteo
  weather.
- 66,631 readings above action stage, grouped into 123 independent storm events by a 12-hour gap
  rule.
- Event-aware chronological holdout: the most recent ~20% of storm events, plus a 3-day buffer
  before the first test storm, form the test set, so no storm appears in both splits. Test set is
  194,149 rows, 13,087 positive.
- **PR-AUC 0.972, ROC-AUC 0.997** on held-out events.
- Operating threshold **0.318**, chosen by sweeping the precision–recall curve for a 0.90 recall
  target. At that threshold: flood-class **recall 0.90, precision 0.92, F1 0.91**; confusion matrix
  `[[180057, 1005], [1308, 11779]]`.
- **Median lead time 6.8 hours** before flood-stage onset across the 24 flood events in the holdout.

---

## Anatomy: frontend

Next.js **16.2.9**, App Router, React **19.2.4**, Tailwind **v4**, Recharts **3.x**.

> ⚠️ This is a newer Next.js than most tutorials (and most LLM training data) assume. `AGENTS.md`
> points at `node_modules/next/dist/docs/` — read the shipped docs before writing routing or
> data-fetching code.

### Routes

| Route | File | Notes |
| --- | --- | --- |
| `/` | [page.tsx](frontend/src/app/page.tsx) | The whole marketing site. Not real routing — five `useState` booleans swap between `<Home>`, `<About>`, `<Contact>`, and `<GetInvolved>`. "Locations" is the exception: it `router.push`es to `/chapters`. |
| `/chapters` | [page.tsx](frontend/src/app/chapters/page.tsx) | Renders `<Locations>`, a card grid of chapters (one card today). Its "View Dashboard" button navigates to the dashboard. |
| `/chapters/pot_river_dc_little_falls_pump_station` | [page.tsx](frontend/src/app/chapters/pot_river_dc_little_falls_pump_station/page.tsx) | The live dashboard. |
| `POST /api/send` | [route.ts](frontend/src/app/api/send/route.ts) | Contact form handler. Validates all four fields, then sends via Resend with `replyTo` set to the submitter. Returns `400` on missing fields, `500` on send failure. |

### The dashboard page

A `"use client"` component that owns **all** backend communication. Three separate fetches, three
separate loading/error state triples:

| Call | Backend route | Refresh |
| --- | --- | --- |
| `fetchContinuousData()` | `GET {API}/potomac/little_falls_pump_station/current_conditions` | Once on mount |
| `fetchFloodRisk()` | `GET {API}/potomac/little_falls_pump_station/flood_risk` | On mount, then **every 10 minutes** via `setInterval`, cleared on unmount |
| `fetchHistoricalContext()` | `GET {API}/potomac/little_falls_pump_station/historical_context` | Once on mount |

The 10-minute poll is matched to the gauge's ~15-minute reporting cadence. The other two aren't
polled: the baseline is served from a day-keyed cache and its 24 h-mean current value barely moves
within a session.

The page also owns the `riverMetrics` array — one entry per chart, with its key, label, unit, color,
and height. It is the single source of truth for what the chart card renders; order matters, because
the two-column grid puts the first two metrics in a tall row and the last two in a shorter one.

### Presentational components

All three are pure — the page fetches, they render whatever they're handed.

- **`RiverDataChart.tsx`** — takes the raw `{column: {row_index: value}}` object and transposes it
  into Recharts' row format via `toChartRows()`. Renders one `MetricChartCard` per visible metric,
  each with its own headline number (the latest non-null value) and a toggle pill.
- **`FloodRiskCard.tsx`** — renders the risk pill, probability, gauge timestamp, an amber banner when
  `stale` is true, and the AI/informational-use disclaimer. Its exported TypeScript types mirror the
  backend's `FloodRiskResponse` / `DataFreshness`.
- **`HistoricalContextCard.tsx`** — maps percentile onto five named bands with a **diverging** color
  scale (warm = dry, cool = wet, neutral gray = normal), because on a flood page neither end of the
  scale is "good". The label always carries the meaning; color never carries it alone. Notably, the
  "% above/below typical" figure is computed **against the baseline median, not the API's
  mean-based `percent_change`** — discharge is right-skewed, so the mean-based number reads far more
  dramatic than the percentile beside it. Both fields stay in the API; only the median-based one
  reaches the UI.

`frontend/components/RiverDataChart.tsx` (outside `src/`) is a two-line re-export shim, not a second
copy.

---

## Data pipeline narrative

### The offline story: how the model came to exist

It starts with a script, run by hand, on somebody's laptop.
`pot_river_dc_little_falls_pump_sta.py` asks USGS for sixteen years of readings at Little Falls Pump
Station — gauge height and streamflow every 15 minutes, water-quality means once a day — chunking
the requests because the API refuses ranges longer than about 1,100 days. In parallel it asks
Open-Meteo's archive for hourly weather at the gauge's coordinates: precipitation, rain, snowfall,
snow depth, air temperature, wind, vapour pressure deficit, soil moisture.

Three tables with three different heartbeats get stapled together on a shared timestamp index. Most
cells are empty — a daily water-quality value has nothing to say about 95 of the 96 fifteen-minute
slots it spans — so the sparse columns are forward-filled, carrying the last known reading forward.
Rolling precipitation sums are added, and the whole thing is written to
`backend/chapters/SOURCES_AND_DATASHEETS/usgs_data_USGS-01646500.csv`. **That CSV is gitignored and
therefore absent from a clean clone.**

The XGBoost notebook picks the CSV up. It defines what a flood is (gauge height above the 5.0 ft
action stage), and defines the thing to predict: for each row, will the gauge cross that line at any
point in the next 24 hours? It groups the 66,631 above-stage readings into 123 storm events using a
12-hour gap rule, then splits chronologically **by event** rather than by row, holding out the most
recent 20% of storms with a 3-day buffer — because splitting mid-storm would let the model see the
answer. It builds 14 features, log-transforms the skewed precipitation sums, trains, and sweeps the
precision–recall curve for the highest threshold that still catches 90% of floods. That threshold is
0.318. The fitted pipeline is pickled next to the notebook and committed.

### The live story: what happens when someone opens the dashboard

A visitor loads `/chapters/pot_river_dc_little_falls_pump_station`. The page mounts and fires three
requests at the Render backend, whose model has already been sitting in memory since startup.

**Request one** asks for current conditions. The backend calls USGS for the last 24 hours of four
parameters, pivots the long-format response into a wide table, converts every `NaN` into `null`,
and returns a snapshot plus a chart series. The frontend transposes that series into rows and draws
four line charts.

**Request two** asks for flood risk, and this is where the model runs. The backend does three
independent fetches. From USGS gauge height it takes the current reading and looks backward to find
what the gauge read one hour and six hours ago, subtracting to get rate of change — because a river
at 4 ft and rising fast is a different situation than a river at 4 ft and falling. From Open-Meteo's
forecast endpoint (with `past_days`, since the archive used in training has no recent data) it pulls
the trailing hourly weather, forward-fills gaps, trims any hours dated in the future, sums
precipitation over the last 3, 24, and 72 hours, and applies `log1p` to each. From USGS daily values
it takes the most recent daily-mean water temperature and specific conductance — **the daily mean
specifically**, matching training, even though the charts on the same page show the instantaneous
version of the same measurements.

Those 14 numbers are assembled into a one-row DataFrame, ordered by selecting on `FEATURE_COLUMNS`.
`predict_proba` returns a probability; anything at or above 0.318 is `"elevated"`. Alongside it the
backend records how old each source was, and flags `stale: true` if the gauge reading is more than
120 minutes old. If any source lacked enough history the whole thing short-circuits to a `200` with
`status: "insufficient_data"` and a human-readable reason instead. The card renders one of those
outcomes.

**Request three** asks for historical context and usually touches no network at all — the six
seasonal windows were fetched when the server started and are cached until the calendar date
changes. The backend averages today's discharge over 24 hours, ranks it against ~75 daily means from
the same two-week window in the five prior years, and returns the percentile plus a per-year bar
strip. The card turns "percentile 11" into "Much drier than usual for early August."

Ten minutes later the flood-risk poll fires again. The other two do not.

### Request/response envelope shapes

`GET /potomac/little_falls_pump_station/current_conditions`:

```jsonc
{
  "site_id": "USGS-01646500",
  "retrieved_at": "2026-08-11T14:02:11.481Z",
  "snapshot": {
    "discharge_cfs":              { "value": 1980.0, "observed_at": "2026-08-11T13:45:00+00:00" },
    "gage_height_ft":             { "value": 2.82,   "observed_at": "2026-08-11T13:45:00+00:00" },
    "water_temperature_c":        { "value": null,   "observed_at": null },
    "specific_conductance_us_cm": { "value": 310.0,  "observed_at": "2026-08-11T13:30:00+00:00" }
  },
  "data": {
    "time":           { "0": "2026-08-10T14:00:00+00:00", "1": "..." },
    "discharge_cfs":  { "0": 1990.0, "1": null },
    "gage_height_ft": { "0": 2.83,   "1": 2.83 }
  }
}
```

`data` is pandas' native `{column: {row_index: value}}` orientation. Row indices are strings because
JSON object keys must be; the frontend reads them with `Object.entries()`, which yields strings
regardless.

`GET /potomac/little_falls_pump_station/flood_risk`:

```jsonc
{
  "status": "ok",                       // or "insufficient_data"
  "probability": 0.0412,
  "risk_level": "low",                  // "elevated" when probability >= 0.318
  "model_version": "xgboost-v1",
  "generated_at": "2026-08-11T14:02:11.481Z",
  "gauge_reading_at": "2026-08-11T13:45:00+00:00",
  "data_freshness": { "gauge_age_minutes": 17.2, "weather_age_minutes": 62.0, "water_quality_age_minutes": 840.5 },
  "stale": false,
  "detail": null                        // human-readable reason when status != "ok"
}
```

`GET /potomac/little_falls_pump_station/historical_context`:

```jsonc
{
  "site_id": "USGS-01646500",
  "parameter": "discharge_cfs",
  "generated_at": "...", "baseline_as_of": "...", "observed_at": "...",
  "current": 1984.3,
  "current_window": "24h",
  "comparison": {
    "status": "ok",                     // or "insufficient_data" | "undefined"
    "sample_size": 73,
    "percentile": 11.0,
    "percent_change": -62.4,
    "baseline_mean": 5271.9,
    "baseline_median": 3140.0
  },
  "per_year": { "2021": { "mean": 4820.1, "n": 15 }, "2026": { "mean": 1984.3, "n": 15 } }
}
```

Note the deliberate asymmetry: everything below `status` in `comparison` is nullable, because the
two non-ok paths return **only** `status` and `sample_size`. A missing comparison must never render
as a confident zero.

### The `data` vs `data.data` question — resolved

**It is not a bug in the current code.** The endpoint returns an *envelope* whose `data` key holds
the chart series. The page does:

```ts
const data = await response.json();   // the whole envelope
setRiverData(data.data);              // just the series
```

and passes `riverData` to `<RiverDataChart data={riverData} />`, which reads `data.time`,
`data.discharge_cfs`, etc. The two levels line up correctly
([page.tsx:78-79](frontend/src/app/chapters/pot_river_dc_little_falls_pump_station/page.tsx#L78-L79)
and
[RiverDataChart.tsx:53](frontend/src/components/RiverDataChart.tsx#L53)).

The mismatch trap still exists structurally, though: `/flood_risk` and `/historical_context` are
consumed as the **whole** response body (`const data: FloodRiskResponse = await response.json()`),
while `/current_conditions` is consumed one level **down**. Three fetches in one file, two
conventions. Worth knowing before you copy-paste a fetch block.

---

## Local setup

You need **Python 3.13** (`backend/.python-version`) and **Node.js ≥ 20.9.0** (required by
`next@16.2.9`). Two terminals.

### 1. Clone

```bash
git clone <repo-url>
cd River_Network_Nonprofit
```

### 2. Backend

```bash
cd backend
python -m venv venv

# Windows (PowerShell)
venv\Scripts\Activate.ps1
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt      # 13 pinned packages — NOT the root requirements.txt
uvicorn app.main:app --reload
```

Run this **from `backend/`**, not the repo root — `app.main` must be importable.

On startup you should see two lines confirming the model deserialized and the baseline cache warmed.
The warm makes six USGS calls and takes a few seconds; if it fails you'll see a message saying it
will lazy-load instead, and that is non-fatal.

The API is now at `http://localhost:8000`. Verify:

```bash
curl http://localhost:8000/
curl http://localhost:8000/potomac/little_falls_pump_station/health
curl http://localhost:8000/potomac/little_falls_pump_station/flood_risk
```

Interactive docs, generated from the Pydantic models, are at <http://localhost:8000/docs>.

No API keys are needed — USGS and Open-Meteo are both public and unauthenticated.

### 3. Frontend

In a second terminal:

```bash
cd frontend
npm install
```

Create `frontend/.env.local` (gitignored):

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_RESEND_API_CREDENTIALS=<your Resend API key>   # only needed to test the contact form
CONTACT_TO_EMAIL=<your email>                       # optional
```

No trailing slash on `NEXT_PUBLIC_API_URL` — the code concatenates paths directly onto it. Then:

```bash
npm run dev
```

Open <http://localhost:3000>, then the dashboard at
<http://localhost:3000/chapters/pot_river_dc_little_falls_pump_station>.

The backend's CORS allowlist already includes `http://localhost:3000` and `http://127.0.0.1:3000`.
If you run the frontend on a different port, add it to `origins` in
[main.py](backend/app/main.py#L65-L69) or the browser will block every request.

### 4. Optional: the offline data-science work

The training CSV is **not in the repo** (`*.csv` is gitignored). To regenerate it — expect a long
run and many API calls:

```bash
cd backend
pip install -r requirements-dev.txt   # adds jupyter, matplotlib, seaborn, etc.
python chapters/potomac_river/pot_river_dc_little_falls_pump_station/pot_river_dc_little_falls_pump_sta.py
```

This writes `backend/chapters/SOURCES_AND_DATASHEETS/usgs_data_USGS-01646500.csv`, which is where
`flood_threshold_xgboost.ipynb` looks for it. You do **not** need the CSV to run the API — the
serving path only needs the committed `.pkl`.

---

## Known issues / TODOs

Found during the audit. Ordered roughly by how likely they are to waste your time.

### Broken or wrong

1. **`models/flood_threshold/flood_threshold.py` is broken.** It calls `joblib.load()` on a path
   ending in `.json`; the artifact on disk is `.pkl`. It also uses a hardcoded relative path that
   only resolves if the process CWD happens to be the repo root. It is a leftover scratch script and
   nothing imports it — `main.py` has the correct loading logic. Delete or fix it, but don't trust it.
2. **`ALERT_THRESHOLD = 0.716` in the XGBoost notebook (cell 9) is dead code.** It's assigned but
   never used — the lead-time function it sits beside is called with its default `threshold=0.5`.
   The value the API actually serves is **0.318**, from cell 10. `MODEL_WIRING.md` open question 5
   still asks about 0.716 and is stale on this point.
3. **`MODEL_WIRING.md` and `HISTORICAL_COMPARER_WIRING.md` predate deployment.** Both state that no
   deployment target could be found in-repo (`MODEL_WIRING.md` §2, §3, open question 2). That is
   now answered: Render for the backend, Vercel for the frontend. Everything else in those documents
   still reads correctly as design rationale.
4. **A 0-byte file with a mojibake filename is committed at the repo root** (it renders as a
   garbled box character). Almost certainly a shell-redirect accident. Safe to delete.
5. **`.cache.sqlite` (6.7 MB) is committed at the repo root** even though `.gitignore` lists
   `*.sqlite` — it was added before the ignore rule. It's a `requests-cache` database, pure build
   residue. Should be `git rm --cached`'d.
6. **`layout.tsx` metadata description is still `"Generated by create next app"`.** It's the
   production site's meta description.
7. **The contact form sends from `Acme <onboarding@resend.dev>`**, Resend's placeholder sender.
   Should be a verified domain sender before it's treated as a real inbox.

### Unfinished

8. **`trends/trends.tsx` and `meet_the_team/meet_the_team.tsx` are empty files (0 bytes).** Nothing
   imports them. They're placeholders for planned sections.
9. **`locations.tsx` imports `LittleFallsPumpStation` and never uses it.** A dead import that drags
   the dashboard component into the chapters-page bundle for no reason.
10. **`GET /api/data` returns `"Hello from FastAPI backend!"`** — a create-app scaffold endpoint. The
    home page fetches it on mount and only `console.log`s the result. Both sides can go.
11. **`app/services/potomac_river/test.py` is not a test.** It's a scratch script named misleadingly,
    and its `pivot()` (not `pivot_table()`) will raise on duplicate `(time, parameter)` pairs — the
    exact bug the production module documents avoiding. There is **no test suite in this repo at
    all**, for either service.
12. **Compiled `__pycache__/*.pyc` files are committed** under `app/routers/` and `app/services/`.
    `.gitignore` only covers `backend/app/__pycache__/`, not the nested package directories.

### Data / modeling risks (documented, not yet resolved)

13. **Training-vs-serving precipitation windows may not mean the same thing.** The ingestion script
    computes `precip_3hr`/`24hr`/`72hr` as `.rolling(36)`, `.rolling(288)`, `.rolling(864)` — row
    counts that imply ~5-minute spacing, while the notebook declares `FREQ_MINUTES = 15`. Worse,
    the three source frames (15-min hydraulic, hourly weather, daily water quality) are joined with
    `pd.concat(axis=1)` **without resampling to a common frequency first**, producing a sparse union
    index. The live pipeline instead computes literal 3/24/72-hour sums on Open-Meteo's native
    hourly series. Both files carry comments admitting this. **Before trusting the live probability
    in production, diff a handful of live-computed feature rows against the training CSV's
    `precip_*_log` columns at matching timestamps.** This is the single highest-value open task in
    the repo.
14. **No model versioning beyond a hardcoded string.** `model_version: "xgboost-v1"` is a literal in
    the router. Nothing records training date, feature-list hash, or metrics alongside the `.pkl`,
    and replacing the file silently changes predictions with no way to tell from the API response.
15. **Pickle deserialization is version-sensitive.** The `.pkl` was written by a specific
    scikit-learn/XGBoost/joblib combination. Minor-version drift between the training environment
    and Render's can break the load or silently alter `predict_proba`. This is why
    `backend/requirements.txt` pins exact versions — **don't loosen those pins casually.**
16. **`STALE_AFTER_MINUTES = 120` is a placeholder**, not a value derived from USGS's actual
    reporting SLA.
17. **The historical-baseline cache is per-process.** Under `uvicorn --workers N` you get N copies
    and up to N cold-fetch storms. Harmless at current traffic.
18. **`requests-cache` writes a `.cache` SQLite file into the process working directory.** On
    Render's ephemeral filesystem this is wiped on every deploy and restart, so the cache is
    effectively cold after each one. Not broken, but it means the cache does less than it looks like
    it does in production.

### Repo hygiene

19. **Three files named `requirements.txt`-ish, only one of which is the manifest.**
    `backend/requirements.txt` (13 pinned packages) is what deploys. The root `requirements.txt` and
    `backend/requirements-dev.txt` are both **UTF-16-encoded full `pip freeze` dumps** of a dev
    machine — 80 lines each, including Jupyter and matplotlib. The UTF-16 encoding alone will
    confuse tools that assume UTF-8. Installing the root one on a server would be a mistake.
20. **The training CSV isn't in the repo and isn't reproducible quickly.** `*.csv` is gitignored, so
    a clean clone cannot re-run any notebook without first re-running the multi-hour ingestion
    script. Fine for serving; a real barrier for anyone joining the modeling work.
21. **No CI, no linting in CI, no pre-commit hooks.** `npm run lint` exists; nothing enforces it.
22. **The marketing site isn't really routed.** `/` swaps between four components with `useState`
    booleans, so About/Contact/Get-Involved have no URLs, no deep links, no browser back button, and
    no SEO. Converting them to App Router routes is a self-contained first task for a new
    contributor.
