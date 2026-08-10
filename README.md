# DMV River Intelligence Network


## What we do

The **DMV River Intelligence Network** is a student-led nonprofit dedicated to making Northern Virginia's rivers easier to understand through technology, data science, and environmental education. Rather than collecting new field data or replacing government agencies, the organization brings together publicly available environmental datasets from sources such as stream gauges, weather services, and state monitoring programs into one unified platform (i.e. this website). Rather than presenting users with raw scientific measurements, the platform translates complex environmental data into audience-specific insights. Residents can quickly understand current river conditions, kayakers and anglers can view recreational risk forecasts, educators can access classroom-ready visualizations, nonprofits can explore watershed trends, and researchers can access transparent model outputs alongside the underlying public data. By combining publicly available environmental datasets with statistical and machine learning models, the platform produces forecasts for river level, water quality, and other environmental conditions while also translating technical measurements into clear visualizations and explanations that are accessible to non-technical audiences.

The organization is built around **river chapters**, with each chapter focusing on a single watershed, such as the Potomac, Goose Creek, or the Anacostia River. Within each chapter, students work in specialized teams for data engineering, machine learning and data science, research, and community outreach. Together, they develop predictive models ranging from interpretable statistical baselines to advanced graph neural networks capable of modeling relationships between interconnected tributaries and river segments. These will be presented to schools and local communities. Because every watershed has unique hydrology, tributaries, and environmental challenges, each chapter develops models specifically tailored to its river rather than relying on a one-size-fits-all approach. The organization uses a progression of statistical, machine learning, and graph-based models depending on the prediction task and available data.

Beyond developing technology, the nonprofit seeks to connect students, educators, watershed organizations, and communities through partnerships and outreach. Rather than replacing scientific agencies, the organization focuses on making existing environmental information more understandable and actionable for the public while developing prediction tools for applications that are not typically presented through existing government dashboards. By collaborating with environmental organizations to validate analyses and share findings, the network aims to provide useful, accessible information that complements existing public resources. Through classroom presentations, library workshops, and community demonstrations, the organization teaches students and residents how to interpret environmental data, understand local watershed science, and responsibly use predictive tools when making recreational or educational decisions.

As the network expands, each additional chapter contributes new datasets, research, and predictive models that strengthen the organization's shared technical infrastructure while remaining specialized for the characteristics of its own watershed. Its long-term vision is to become Northern Virginia's leading student-led environmental intelligence network, demonstrating how technology, open data, and community collaboration can help people better understand, monitor, and protect their local rivers.

## Current Progress

A status log of what is built and working in this repository today. One chapter is live in code: **Potomac River near Washington, DC — Little Falls Pump Station (USGS-01646500)**.

### Partnerships

- Official partnership with the **Interstate Commission on the Potomac River Basin (ICPRB)**.

### Flood-threshold model (Little Falls Pump Station)

An XGBoost classifier that predicts whether the gauge will exceed the **5.0 ft flood action stage within the next 24 hours**. Trained in `backend/chapters/potomac_river/pot_river_dc_little_falls_pump_station/models/flood_threshold/flood_threshold_xgboost.ipynb` and shipped as a serialized scikit-learn `Pipeline` (`pot_river_near_little_falls_flood_threshold_xgboost_model.pkl`).

- **Training data:** 624,474 valid 15-minute gauge readings for USGS-01646500 spanning 2010-07-06 through 2026-07-06, joined with hourly Open-Meteo weather.
- **Event structure:** 66,631 readings above action stage, grouped into 123 independent storm events using a 12-hour gap rule.
- **Split:** event-aware chronological holdout — the most recent ~20% of storm events (plus a 3-day buffer before the first test storm) form the test set, so no storm appears in both train and test. Test set: 194,149 rows, 13,087 of them positive.
- **Features:** 14 — gauge height, 1h and 6h gauge-height rate of change, log-transformed 3/24/72-hour precipitation totals, 2m temperature, 10m wind speed, vapour pressure deficit, rain, snowfall, snow depth, specific conductance, and water temperature.
- **Discrimination:** PR-AUC **0.972**, ROC-AUC **0.997** on the held-out events.
- **Operating point:** threshold **0.318**, selected by sweeping the precision–recall curve for a 0.90 recall target. At that threshold the flood class scores **recall 0.90, precision 0.92, F1 0.91** (confusion matrix: 11,779 true positives, 1,308 false negatives, 1,005 false positives, 180,057 true negatives).
- **Lead time:** median **6.8 hours** of warning before flood-stage onset, measured across the 24 flood events in the held-out set as the last distinct rise of predicted probability above 0.5 (requiring a ≥6-hour dip beforehand).

The same threshold (0.318) is the one the API uses to map probability to a `low` / `elevated` risk level.

### Backend API (FastAPI)

`backend/app/` serves the chapter's live endpoints under `/potomac/little_falls_pump_station`:

- `GET /current_conditions` — last 24 hours of USGS continuous readings (discharge, gauge height, water temperature, specific conductance) as a per-parameter snapshot plus chart series, with NaN-safe JSON encoding.
- `GET /flood_risk` — live model inference: probability, risk level, model version, per-source data freshness, and an explicit `stale` flag when the gauge reading is older than 120 minutes. Returns a `200` with `status: "insufficient_data"` when the rolling windows can't be filled, and `503` when an upstream source is unreachable — never a silent blank.
- `GET /historical_context` — today's discharge against a seasonal baseline: ±7 days around today's date across the 5 prior years, returning percentile, percent change, baseline mean/median, and a per-year strip.
- `GET /health`

The model is deserialized once at startup via the FastAPI lifespan hook (path anchored to `__file__`, not the working directory), and the historical baseline cache is warmed at startup so the first visitor of the day doesn't pay for six cold USGS fetches.

**Live inference feature pipeline** (`flood_features_pot_river_dc_little_falls_pump_station.py`) rebuilds the exact 14-column training row from live sources, deliberately matching the training aggregations — daily mean for water temperature and specific conductance, not the instantaneous readings used by the charts — to avoid train/serve skew.

### Data sources in use

- **USGS Water Data** via the `dataretrieval` package, site USGS-01646500 — parameter codes 00060 (discharge), 00065 (gauge height), 00010 (water temperature), 00095 (specific conductance).
- **Open-Meteo** — the archive API for historical training pulls, and the forecast API (`past_days`) for live inference: precipitation, rain, snowfall, snow depth, 2m temperature, 10m wind speed, vapour pressure deficit.

### Frontend (Next.js 16 / React 19)

`frontend/` is a Next.js 16.2.9 App Router site on React 19 and Tailwind v4:

- Public site: home, about, get-involved, and contact sections, plus a `/chapters` locations page.
- Chapter dashboard at `/chapters/pot_river_dc_little_falls_pump_station`, which consumes all three data endpoints and renders `RiverDataChart` (Recharts, four parameters), `FloodRiskCard`, and `HistoricalContextCard`, with distinct loading, error, insufficient-data, and stale states.
- Contact form backed by an `/api/send` route handler that delivers messages through Resend.

### Documentation

`MODEL_WIRING.md` and `HISTORICAL_COMPARER_WIRING.md` record the architecture reviews behind the model-serving and historical-baseline work, including the known risks.

### Hosting

Not yet deployed from this repository: there is no deployment configuration in-tree (no `vercel.json`, `Dockerfile`, `Procfile`, or equivalent), and the backend's CORS allowlist currently covers `localhost:3000` only. Both services run locally.




