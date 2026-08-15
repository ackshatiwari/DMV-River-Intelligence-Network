"""This file serves the Little Falls Pump Station API endpoints, which are a subset of the
 Potomac River API. The endpoints here are mounted at /potomac/little_falls_pump_station.
 """

from datetime import datetime, timezone
from typing import Dict, Literal, Optional, Union

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

# import the service module for the Little Falls Pump Station
from ...services.potomac_river.pot_river_dc_little_falls_pump_station.flood_prediction_pot_river_dc_little_falls_pump_station import (
    get_current_conditions as fetch_current_conditions,
)

from ...services.potomac_river.pot_river_dc_little_falls_pump_station.flood_features_pot_river_dc_little_falls_pump_station import (
    InsufficientDataError,
    build_feature_row,
)

from ...services.potomac_river.pot_river_dc_little_falls_pump_station.historical_baseline_pot_river_dc_little_falls_pump_station import (
    BaselineUnavailableError,
    get_historical_context,
)

router = APIRouter(prefix="/potomac/little_falls_pump_station", tags=["little_falls_pump_station"])


ALERT_THRESHOLD = 0.318 # see cell 10 of the xgboost nb

# How old a gauge reading can be before we still return a prediction but flag it
# as stale rather than presenting it as current. Also an open question (#3) --
# 2 hours is a reasonable placeholder given USGS's typical reporting lag, not a
# value pulled from any requirement.
STALE_AFTER_MINUTES = 120

class ParameterReading(BaseModel):
    """The latest value for a single USGS parameter, and when it was observed."""
    value: Optional[float] = None
    observed_at: Optional[datetime] = None


class CurrentConditionsResponse(BaseModel):
    """
    Typed contract for /current_conditions. This is the structural guard against
    the bug this replaced: a raw DataFrame used to be handed to FastAPI, which
    encoded its NaN cells as bare `NaN` -- not valid JSON, so the response blew
    up at serialization time. A declared response_model can't ship a numpy float.
    """
    site_id: str
    retrieved_at: datetime

    # Headline number per parameter -- each with its own timestamp, because the
    # four parameters report on different cadences.
    snapshot: Dict[str, ParameterReading]

    # 24h series for the charts, in pandas' {column: {row_index: value}} shape --
    # which is exactly what RiverDataChart.tsx already reads, so the key stays
    # "data" and the frontend is unchanged. `time` values are ISO strings, every
    # other column is float-or-null (null where that parameter didn't report at
    # that timestamp).
    data: Dict[str, Dict[str, Optional[Union[str, float]]]]


class DataFreshness(BaseModel):
    """How old each live data source was when this prediction was made."""
    gauge_age_minutes: float
    weather_age_minutes: float
    water_quality_age_minutes: float


class FloodRiskResponse(BaseModel):
    """
    Pydantic model = FastAPI validates and documents this shape automatically
    (shows up in /docs), and it's impossible to accidentally return a response
    missing a field the frontend expects.
    """
    status: Literal["ok", "insufficient_data"]
    probability: Optional[float] = None
    risk_level: Optional[Literal["low", "elevated"]] = None
    model_version: str = "xgboost-v1"
    generated_at: datetime
    gauge_reading_at: Optional[datetime] = None
    data_freshness: Optional[DataFreshness] = None
    stale: bool = False
    detail: Optional[str] = None  # human-readable reason, set when status != "ok"


class BaselineComparison(BaseModel):
    """
    Where today's discharge sits against the seasonal baseline.

    Everything below `status` is Optional because the two non-ok paths in the
    service's compare() return ONLY status + sample_size -- there is deliberately
    no number to report when the sample is too small or the baseline mean is
    ~zero. Defaulting them to None rather than 0.0 is the point: a missing
    comparison must never render as a confident zero (HISTORICAL_COMPARER_WIRING.md
    section 9).
    """
    status: Literal["ok", "insufficient_data", "undefined"]
    sample_size: int

    # percentile is the headline; percent_change is secondary and must not lead the
    # UI -- it's unbounded upward but floored at -100%, so the two directions aren't
    # visually comparable (see section 2 of the design doc).
    percentile: Optional[float] = None
    percent_change: Optional[float] = None
    baseline_mean: Optional[float] = None
    # Returned but not displayed -- discharge is right-skewed, so a large
    # mean/median divergence is worth being able to diagnose without a re-fetch.
    baseline_median: Optional[float] = None


class PerYearStat(BaseModel):
    """One bar of the per-year context strip."""
    mean: float
    n: int


class HistoricalContextResponse(BaseModel):
    """
    Contract for /historical_context. Numbers, not sentences -- the frontend
    composes "lower than 89% of early Augusts on record" so copy edits don't
    need a backend deploy.
    """
    site_id: str
    parameter: str
    generated_at: datetime
    # When the cached seasonal windows were fetched, as distinct from when this
    # response was generated -- the baseline is a day-keyed cache, so these
    # legitimately differ by hours.
    baseline_as_of: datetime

    current: float
    current_window: str
    observed_at: datetime

    comparison: BaselineComparison
    # Keyed by year-as-string. Includes the CURRENT year, which is intentionally
    # absent from the baseline it's compared against.
    per_year: Dict[str, PerYearStat]


@router.get("/health")
def health_check():
    return {"status": "Little Falls Pump Station API is healthy!"}


@router.get("/current_conditions", response_model=CurrentConditionsResponse)
def get_current_conditions():
    try:
        conditions = fetch_current_conditions()
    except Exception as exc:
        # USGS unreachable or malformed -- an upstream problem, same as /flood_risk
        # treats it. 503 tells the frontend "retry later" instead of surfacing a
        # raw 500 traceback.
        raise HTTPException(
            status_code=503,
            detail=f"Upstream data source unavailable: {exc}",
        )

    return CurrentConditionsResponse(
        site_id=conditions["site_id"],
        retrieved_at=datetime.now(timezone.utc),
        snapshot=conditions["snapshot"],
        data=conditions["data"],
    )


@router.get("/flood_risk", response_model=FloodRiskResponse)
def get_flood_risk(request: Request):
    now = datetime.now(timezone.utc)

    # --- Build the model's input row from live data ---
    try:
        features_df, metadata = build_feature_row()
    except InsufficientDataError as exc:
        # Not enough trailing history yet (e.g. <72h of weather) -- this is an
        # EXPECTED, recoverable state, not a server error. 200, not 500, so the
        # frontend can render "not enough data yet" instead of a scary red error.
        return FloodRiskResponse(
            status="insufficient_data",
            generated_at=now,
            detail=str(exc),
        )
    except Exception as exc:
        # USGS or Open-Meteo unreachable/timed out -- genuinely an upstream
        # problem. 503 tells the frontend "retry later", distinct from the
        # insufficient_data case above.
        raise HTTPException(
            status_code=503,
            detail=f"Upstream data source unavailable: {exc}",
        )

    # --- Run the model (loaded once at startup -- see main.py's lifespan) ---
    model = request.app.state.flood_model
    probability = float(model.predict_proba(features_df)[:, 1][0])
    risk_level = "elevated" if probability >= ALERT_THRESHOLD else "low"

    # --- Data freshness bookkeeping ---
    gauge_age_minutes = (now - metadata["gauge_reading_at"]).total_seconds() / 60
    weather_age_minutes = (now - metadata["weather_reading_at"]).total_seconds() / 60
    oldest_water_quality_reading = min(
        metadata["water_temperature_reading_at"],
        metadata["specific_conductance_reading_at"],
    )
    water_quality_age_minutes = (now - oldest_water_quality_reading).total_seconds() / 60

    # Gauge age is the one that matters most for "is this still trustworthy" --
    # a stale gauge reading means the whole prediction is built on an old snapshot.
    stale = gauge_age_minutes > STALE_AFTER_MINUTES

    return FloodRiskResponse(
        status="ok",
        probability=probability,
        risk_level=risk_level,
        generated_at=now,
        gauge_reading_at=metadata["gauge_reading_at"],
        data_freshness=DataFreshness(
            gauge_age_minutes=round(gauge_age_minutes, 1),
            weather_age_minutes=round(weather_age_minutes, 1),
            water_quality_age_minutes=round(water_quality_age_minutes, 1),
        ),
        stale=stale,
    )


@router.get("/historical_context", response_model=HistoricalContextResponse)
def historical_context():
    """
    Today's discharge against a multi-year seasonal baseline -- "is this August
    dry?", not "is this a flood". Independent of the model: no .pkl, no
    FEATURE_COLUMNS.

    Served from a day-keyed cache warmed at startup (see main.py's lifespan), so
    the usual path here does no network I/O at all.
    """
    try:
        context = get_historical_context()
    except BaselineUnavailableError as exc:
        # USGS unreachable or empty -- retry-able, and distinct from a
        # too-few-samples outcome, which is NOT an exception: that comes back as a
        # 200 with comparison.status set, so the per-year strip still renders.
        #
        # Deliberately narrow: no `except Exception` here. An unexpected bug
        # should surface as a 500, not be laundered into "upstream unavailable"
        # and quietly retried forever by the frontend.
        raise HTTPException(
            status_code=503,
            detail=f"Historical baseline unavailable: {exc}",
        )

    return HistoricalContextResponse(**context)

