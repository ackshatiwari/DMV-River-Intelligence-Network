from contextlib import asynccontextmanager
from pathlib import Path

import joblib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.potomac_river import pot_river_dc_little_falls_pump_station
from .services.potomac_river.pot_river_dc_little_falls_pump_station.historical_baseline_pot_river_dc_little_falls_pump_station import (
    warm_baseline_cache,
)


# Path to the trained flood-threshold model, built from THIS file's own location
# (backend/app/main.py) rather than the current working directory. `Path(__file__)`
# is where main.py physically lives on disk; `.resolve()` makes it absolute.
# `.parent` strips "main.py" -> backend/app/. `.parent` again -> backend/. From there
# we walk back down into the model's actual folder. This means the path resolves
# correctly no matter where `uvicorn` is launched from (repo root, backend/, a Docker
# container, etc.) -- unlike flood_threshold.py's hardcoded "backend/chapters/..."
# string, which only works if the process cwd happens to be the repo root.
MODEL_PATH = (
    Path(__file__).resolve().parent.parent
    / "chapters"
    / "potomac_river"
    / "pot_river_dc_little_falls_pump_station"
    / "models"
    / "flood_threshold"
    / "pot_river_near_little_falls_flood_threshold_xgboost_model.pkl"
)



@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Run this block once
    """
    
    app.state.flood_model = joblib.load(MODEL_PATH)
    print(f"Loaded flood model from {MODEL_PATH} -> {type(app.state.flood_model)}")

    # Pay the six cold USGS fetches here rather than making the day's first
    # visitor wait for them.
    try:
        warm_baseline_cache()
    except Exception as exc:
        # The broad catch is load-bearing, not politeness: an upstream outage
        # while warming a DESCRIPTIVE STATISTIC must not take down /flood_risk and
        # /current_conditions with it. The cache lazy-loads on first request
        # instead, and /historical_context answers 503 until USGS recovers.
        print(f"Baseline warm failed, will lazy-load on first request: {exc}")

    yield  # server runs and handles requests while paused here



app = FastAPI(lifespan=lifespan)

app.include_router(pot_river_dc_little_falls_pump_station.router)

# Exact hosts we trust: local dev plus the production Vercel deployment. A CORS
# origin is scheme + host only -- no trailing slash -- because that is literally
# what the browser puts in the `Origin` header, and Starlette string-compares it.
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://dmv-river-intelligence-network.vercel.app",
]

# Vercel builds every non-production branch at its own throwaway hostname
# (dmv-river-intelligence-network-git-<branch>-<team>.vercel.app, and a
# commit-hash variant), so no fixed list can cover them. The regex admits the
# whole family. It is deliberately loose, and Vercel project names are not
# reserved, so a stranger could in principle claim a matching hostname -- which
# is exactly why allow_credentials stays False below.
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://dmv-river-intelligence-network-[a-z0-9-]+\.vercel\.app",
    # Nothing here reads cookies or sessions; every endpoint is public
    # read-only data. Keeping credentials off means a spoofed preview-lookalike
    # origin gains nothing. Revisit if student logins ever land.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "DMV RIN API is running"}

@app.get("/api/data")
def read_data():
    return {"message": "Hello from FastAPI backend!"}