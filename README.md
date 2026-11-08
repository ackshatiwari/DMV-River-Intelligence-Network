# DMV RIN Dashboard Platform

## Project overview

The **DMV RIN Dashboard Platform** is the dashboard monitoring site for the DMV River Intelligence Network. It
gives each monitored river segment its own **dashboard**, which turns public gauge and weather data
into something a non-specialist can read at a glance. It is a read-only view over public data: the
platform collects no field data of its own and doesn't replace official sources like the USGS or the
National Weather Service.

Each dashboard shows three things:

- **Live conditions.** Charts of the gauge's latest readings: discharge, gage height, water
  temperature, and specific conductance over the last 24 hours, with 7- and 30-day views for discharge
  and gage height.
- **Flood risk.** A machine-learning prediction of whether the river will rise past its flood action
  stage within the next 24 hours, shown as a probability with a low/elevated label. The dashboard
  flags the prediction when the gauge data behind it is out of date.
- **Historical context.** How today's flow compares with the same time of year in past years, as a
  plain-language band ("drier than usual", "about normal", ...) plus a year-by-year strip.

Around the dashboards, the site has a chapter directory, About and Get Involved pages, a contact form,
and a "Start a Dashboard" form where the public can propose a new site.

One dashboard is live today: **Potomac River near Little Falls Pump Station** (USGS site
`USGS-01646500`). The code is organized so each new river segment is added alongside it (see
[File structure](#file-structure)).

Technically, this repo is a two-service monorepo:

- a **FastAPI backend** (`backend/`) that pulls live data from USGS and Open-Meteo, runs each
  segment's trained models on it, and serves the results as JSON over read-only HTTP endpoints;
- a **Next.js frontend** (`frontend/`) that renders the site and the dashboards from those endpoints.

The repo also holds each segment's **offline data-science work** (`backend/chapters/`): the
ingestion scripts that build training data, the notebooks, and the trained models the API loads at
startup.

---

## Deployment


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
parameter codes, model path) is hardcoded in source. No secrets are needed to run
it; USGS and Open-Meteo are both unauthenticated public APIs. The one deployment-time setting that
matters is Render's start command, which must launch `app.main:app` with `backend/` as the working
directory.

---

## File structure

Where things go. Every river chapter follows the same pattern: a folder for the river
(`potomac_river/`), then one folder per river segment (`pot_river_dc_little_falls_pump_station/`).
To add a segment, copy that pattern in each place it appears below.

```
DMV-River-Intelligence-Network/
├── README.md, AGENTS.md, ...           # Project docs and design write-ups
│
├── backend/                            # FastAPI service + offline data-science work
│   ├── requirements.txt                # Runtime dependencies (what Render installs)
│   ├── app/                            # The web service: everything served over HTTP
│   │   ├── main.py                     # App setup: model loading, CORS, startup tasks
│   │   ├── routers/                    # HTTP endpoints: one file per river segment
│   │   │   └── potomac_river/
│   │   │       └── pot_river_dc_little_falls_pump_station.py
│   │   └── services/                   # Data fetching + logic: one folder per river segment
│   │       └── potomac_river/
│   │           └── pot_river_dc_little_falls_pump_station/
│   └── chapters/                       # Offline: ingestion scripts, notebooks, trained models
│       ├── SOURCES_AND_DATASHEETS/     # Generated training CSVs (gitignored)
│       └── potomac_river/
│           └── pot_river_dc_little_falls_pump_station/
│
└── frontend/                           # Next.js site
    ├── public/                         # Static images (logos, river photos)
    └── src/
        ├── app/                        # Routes: one folder per URL path
        │   ├── api/                    # Server-side handlers (e.g. the contact form)
        │   └── chapters/               # Dashboard pages: one folder per river segment
        │       └── pot_river_dc_little_falls_pump_station/
        └── components/                 # Reusable UI 
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

1. **Loads the trained models once, at startup**, inside a `lifespan` async context manager, and
   stashes them on `app.state`. Every model ships as a `.pkl` plus a `.meta.json`, written together
   by the last cell of its notebook (version, alert threshold, feature list, metrics, and the
   `.pkl`'s SHA-256). Startup **fails** if the metadata is missing, doesn't match the `.pkl`, or
   lists different features than the live pipeline builds. Paths are built from `Path(__file__)`,
   so they resolve no matter where `uvicorn` is launched from.
2. **Warms the historical-baseline cache** by calling `warm_baseline_cache()`, so the first visitor
   of the day doesn't pay for the cold USGS fetches. This call is wrapped in a broad `except` on
   purpose: a USGS outage while warming a purely descriptive statistic must not prevent the server
   from starting.
3. **Configures CORS.** An exact allowlist (`localhost:3000`, `127.0.0.1:3000`, the production
   Vercel domain) plus a regex admitting Vercel's per-branch preview hostnames. `allow_credentials`
   is deliberately `False` — nothing here reads cookies, and the preview regex is loose enough that
   a stranger could in principle register a matching hostname.

It also defines two trivial endpoints: `GET /` (the cron keep-alive target) and `GET /api/data`
(a leftover scaffold endpoint).

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



## Local setup

You need **Python 3.13** (`backend/.python-version`) and **Node.js ≥ 20.9.0** (required by
`next@16.2.9`). Two terminals.

### 1. Clone

```bash
git clone <repo-url>
cd DMV-River-Intelligence-Network
```

### 2. Backend

```bash
cd backend
python -m venv venv

# Windows (PowerShell)
venv\Scripts\Activate.ps1
# macOS / Linux
source venv/bin/activate

pip install -r requirements.txt      # pinned runtime dependencies — NOT the root requirements.txt
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

### 4. Optional: retraining a model

Each river segment's ingestion script, notebooks, and trained model live in its folder under
`backend/chapters/`. Training CSVs are **not in the repo** (`*.csv` is gitignored); the segment's
ingestion script regenerates its CSV into `backend/chapters/SOURCES_AND_DATASHEETS/`. Expect a long
run and many API calls.

To retrain: run the segment's ingestion script, then its model notebook top to bottom (Restart → Run
All) using the `backend/venv` kernel. The notebook's last cell writes the `.pkl` and its
`.meta.json` together — **commit both**, or the API won't start.

You do **not** need the CSVs to run the API; serving only needs the committed `.pkl` and
`.meta.json`.

---
