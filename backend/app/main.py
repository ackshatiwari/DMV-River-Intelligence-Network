from contextlib import asynccontextmanager
from pathlib import Path

import joblib
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.potomac_river import pot_river_dc_little_falls_pump_station


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

    yield  # server runs and handles requests while paused here



app = FastAPI(lifespan=lifespan)

app.include_router(pot_river_dc_little_falls_pump_station.router)

origins = [
    "http://localhost:3000", 
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

@app.get("/api/data")
def read_data():
    return {"message": "Hello from FastAPI backend!"}