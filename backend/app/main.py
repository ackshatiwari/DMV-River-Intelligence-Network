import hashlib
import json
from contextlib import asynccontextmanager
from pathlib import Path

import joblib
import sklearn
import xgboost
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.potomac_river import pot_river_dc_little_falls_pump_station
from .services.potomac_river.pot_river_dc_little_falls_pump_station.flood_features_pot_river_dc_little_falls_pump_station import (
    FEATURE_COLUMNS,
)
from .services.potomac_river.pot_river_dc_little_falls_pump_station.past_year_comparision_pot_river_dc_little_falls_pump_station import (
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

# Written next to the .pkl by the last cell of flood_threshold_xgboost.ipynb.
# Holds the alert threshold, model_version, feature list and training metrics.
MODEL_META_PATH = MODEL_PATH.with_suffix(".meta.json")


def load_model_meta(model_path: Path, meta_path: Path) -> dict:
    """
    Read the model's metadata and check that it actually describes this model.

    Fails loudly (and stops startup) rather than serving a prediction whose
    threshold or features belong to a different model.
    """
    if not meta_path.exists():
        raise RuntimeError(
            f"Model metadata not found at {meta_path}. Re-run the last cell of "
            "flood_threshold_xgboost.ipynb, which writes it next to the .pkl."
        )

    meta = json.loads(meta_path.read_text(encoding="utf-8"))

    actual_sha256 = hashlib.sha256(model_path.read_bytes()).hexdigest()
    if actual_sha256 != meta["model_sha256"]:
        raise RuntimeError(
            f"{model_path.name} does not match {meta_path.name} (SHA-256 differs) -- the "
            "model was re-saved without its metadata. Re-run the last cell of "
            "flood_threshold_xgboost.ipynb so both are written together."
        )

    if meta["feature_columns"] != FEATURE_COLUMNS:
        raise RuntimeError(
            "The model was trained on different features than the live pipeline builds.\n"
            f"  model:    {meta['feature_columns']}\n"
            f"  pipeline: {FEATURE_COLUMNS}\n"
            "Update FEATURE_COLUMNS in flood_features_pot_river_dc_little_falls_pump_station.py."
        )

    # A version mismatch doesn't stop startup -- the pickle may still load fine --
    # but it's the first thing to suspect if predictions look off.
    trained_with = meta.get("library_versions", {})
    for library, running in (("scikit-learn", sklearn.__version__), ("xgboost", xgboost.__version__)):
        if trained_with.get(library) and trained_with[library] != running:
            print(
                f"WARNING: model was trained with {library} {trained_with[library]}, "
                f"server is running {running}."
            )

    return meta



@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Run this block once
    """

    app.state.flood_model_meta = load_model_meta(MODEL_PATH, MODEL_META_PATH)
    app.state.flood_model = joblib.load(MODEL_PATH)
    print(
        f"Loaded flood model {app.state.flood_model_meta['model_version']} from {MODEL_PATH} "
        f"(alert threshold {app.state.flood_model_meta['alert_threshold']:.3f})"
    )

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
    "https://dmvrin-dashboards.vercel.app",
]

# Vercel builds every non-production branch at its own throwaway hostname
# (<project>-git-<branch>-<team>.vercel.app, and a <project>-<hash>-<team>
# variant), so no fixed list can cover them. The regex admits the
# whole family. It is deliberately loose, and Vercel project names are not
# reserved, so a stranger could in principle claim a matching hostname -- which
# is exactly why allow_credentials stays False below.
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https://dmvrin-dashboards-[a-z0-9-]+\.vercel\.app",
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