from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.potomac_river import pot_river_dc_little_falls_pump_station


app = FastAPI()

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