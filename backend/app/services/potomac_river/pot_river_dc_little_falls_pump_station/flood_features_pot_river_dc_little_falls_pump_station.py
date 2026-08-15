"""
Feature pipeline for the Little Falls flood-threshold model (LIVE / inference path).

This module rebuilds -- from live USGS + Open-Meteo data -- the exact feature row that
the XGBoost pipeline in flood_threshold_xgboost.ipynb was trained on. It must be kept
in lockstep -- lockstep meaning in perfect synchronization -- with that notebook's
`feature_columns` cell: if a feature there is added, renamed, or transformed differently,
this file needs the matching change. Otherwise the model silently receives features it
was never trained to see (train/serve skew) -- see MODEL_WIRING.md for the full writeup
of that risk.

Two things this module deliberately does NOT reuse from elsewhere in the codebase, on
purpose:
  - get_current_data() (flood_prediction_pot_river_dc_little_falls_pump_station.py),
    which pulls "water_temperature_c" and "specific_conductance_us_cm" as INSTANTANEOUS
    continuous readings.
  - Training instead used the DAILY MEAN for both of those (see DAILY_PARAMS in
    pot_river_dc_little_falls_pump_sta.py) -- a different aggregation of the same USGS
    parameter code. Reusing get_current_data() here would quietly feed the model a
    different quantity than it was trained on for BOTH of those features, not just one.
"""

import math

import numpy as np
import openmeteo_requests
import pandas as pd
import requests_cache
from dataretrieval import waterdata
from retry_requests import retry

# ── Site config  ────────────────────────────
SITE_ID = "USGS-01646500" # Potomac River Near Wash, DC Little Falls Pump Sta - USGS-01646500

LATITUDE = 38.94778
LONGITUDE = -77.12764

# ── USGS parameter codes ────────────────────────────────────────────────────────────
GAGE_HEIGHT_PARAM = "00065"             # continuous (15-min instantaneous)
WATER_TEMPERATURE_PARAM = "00010"       # DAILY mean at training time
SPECIFIC_CONDUCTANCE_PARAM = "00095"    # DAILY mean at training time

# ── Open-Meteo config ────────────────────────────────────────────────────────────────
# Training used the archive-api endpoint (historical only). Live inference needs
# recent-and-current data, which is what the plain "forecast" endpoint provides via
# its `past_days` parameter.
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

# Hourly variables the model was trained on. NOTE: this is a subset of OPEN_METEO_VARS
# in pot_river_dc_little_falls_pump_sta.py -- soil_moisture_* was fetched at training
# time but never made it into feature_columns, so it's intentionally left out here.
OPEN_METEO_HOURLY_VARS = [
    "precipitation",
    "rain",
    "snowfall",
    "snow_depth",
    "temperature_2m",
    "wind_speed_10m",
    "vapour_pressure_deficit",
]

# Longest rolling window the model needs (precip_72hr_log). Padded by a day so the
# 72-hour tail always has a full window even right at the edge of "now".
WEATHER_LOOKBACK_HOURS = 72

# Exact column names AND order the fitted pipeline expects. Copied from
# `feature_columns` in flood_threshold_xgboost.ipynb -- if that cell changes, this
# list must change too.
FEATURE_COLUMNS = [
    "gage_height_ft",
    "gage_height_roc_1h",
    "gage_height_roc_6h",
    "precip_3hr_log",
    "precip_24hr_log",
    "precip_72hr_log",
    "temperature_2m",
    "wind_speed_10m",
    "vapour_pressure_deficit",
    "rain",
    "snowfall",
    "snow_depth",
    "specific_conductance_us_cm",
    "temperature_c",
]

# requests_cache session, same pattern as pot_river_dc_little_falls_pump_sta.py, but a
# much shorter expiry -- this now backs a LIVE prediction, not a one-off historical pull,
# so a 1-hour-old cached response would silently make the model look at stale weather.
_cache_session = requests_cache.CachedSession(".cache", expire_after=300)
_retry_session = retry(_cache_session, retries=5, backoff_factor=0.2)
_openmeteo = openmeteo_requests.Client(session=_retry_session)


class InsufficientDataError(Exception):
    """
    Raised when a live source doesn't yet have enough history to fill one of the
    model's rolling-window features (e.g. fewer than 72h of weather data available).

    Callers (the future /predict endpoint) should turn this into a
    200 {"status": "insufficient_data"} response, not a 500 -- see Step 3 in
    MODEL_WIRING.md.
    """


# ── Gage height (USGS continuous) ───────────────────────────────────────────────────

def _fetch_gage_height_history() -> pd.Series:
    """Trailing continuous gage-height readings as a Series -- a series meaning a list of values indexed by time -- ( oldest first )."""

    df, _ = waterdata.get_continuous(
        monitoring_location_id=SITE_ID,
        parameter_code=[GAGE_HEIGHT_PARAM],
        # "P1D" matches the pattern already used in get_current_data() elsewhere in
        # this codebase, and comfortably covers the <=6h of history the
        # rate-of-change features below need.
        time="P1D",
    )
    if df.empty:
        raise InsufficientDataError("USGS returned no continuous gage-height data.")

    df = df[["time", "value"]].copy()
    df["time"] = pd.to_datetime(df["time"], utc=True) # Coordinated Universal time, around 5 hours before EST
    df["value"] = pd.to_numeric(df["value"], errors="coerce") # coerce meaning convert invalid parsing to NaN

    # Drop any rows with NaN values in the 'value' column, then sort by time and set time as the index
    series = df.dropna(subset=["value"]).sort_values("time").set_index("time")["value"]
    if series.empty:
        raise InsufficientDataError("No valid gage-height readings in the lookback window.")
    return series


def _diff_by_elapsed_time(series: pd.Series, hours: float) -> float:
    """
    Current value minus the value closest to `hours` ago.

    The training notebook computes this as `gage_height_ft.diff(n_rows)`, which
    assumes perfectly even 15-minute spacing (true for the historical CSV). Live USGS
    data occasionally skips a reading, so instead of counting a fixed number of rows
    back, we look up "the most recent reading at or before the target time" -- same
    intent, more tolerant of real-world gaps.
    """
    now_time = series.index[-1]
    now_value = series.iloc[-1]
    target_time = now_time - pd.Timedelta(hours=hours)

    # Find the most recent reading at or before the target time. If there isn't one, raise an error.
    earlier_readings = series.loc[:target_time]
    if earlier_readings.empty:
        raise InsufficientDataError(
            f"Need a gage-height reading from ~{hours}h before {now_time}, but "
            f"history only goes back to {series.index[0]}."
        )

    reference_value = earlier_readings.iloc[-1]
    return float(now_value - reference_value)


def _compute_gage_features(gage_height: pd.Series) -> tuple[dict, pd.Timestamp]:
    """Turns the raw gage-height history into the three gage-related model features."""
    gauge_reading_at = gage_height.index[-1]
    current_value = float(gage_height.iloc[-1])

    features = {
        "gage_height_ft": current_value,
        "gage_height_roc_1h": _diff_by_elapsed_time(gage_height, hours=1),
        "gage_height_roc_6h": _diff_by_elapsed_time(gage_height, hours=6),
    }
    return features, gauge_reading_at


# ── Water quality: temperature_c + specific_conductance_us_cm (USGS DAILY) ─────────

def _fetch_daily_water_quality(lookback_days: int = 3) -> pd.DataFrame:
    """
    Both `temperature_c` and `specific_conductance_us_cm` were trained on the DAILY
    MEAN (get_daily) -- see the module docstring above for why this matters. Returns
    a DataFrame indexed by day, with one column per parameter.
    """

    # The training notebook used a 3-day lookback window for these two features, so we
    # do the same here. The model only uses the most recent value, but we need
    # enough history to compute the daily mean for the last day.
    df, _ = waterdata.get_daily(
        monitoring_location_id=SITE_ID,
        parameter_code=[WATER_TEMPERATURE_PARAM, SPECIFIC_CONDUCTANCE_PARAM],
        time=f"P{lookback_days}D",
    )
    if df.empty:
        raise InsufficientDataError("USGS returned no daily water-quality data.")

    
    df = df[["time", "parameter_code", "value"]].copy()
    df["parameter_code"] = df["parameter_code"].replace(
        {
            WATER_TEMPERATURE_PARAM: "temperature_c",
            SPECIFIC_CONDUCTANCE_PARAM: "specific_conductance_us_cm",
        }
    )
    df["time"] = pd.to_datetime(df["time"], utc=True)
    df["value"] = pd.to_numeric(df["value"], errors="coerce")

    return df.pivot_table(
        index="time", columns="parameter_code", values="value", aggfunc="first"
    ).sort_index()


def _latest_value(df: pd.DataFrame, column: str, description: str) -> tuple[float, pd.Timestamp]:
    """Most recent non-null value (and its timestamp) for one column of a DataFrame."""
    if column not in df.columns or df[column].dropna().empty:
        raise InsufficientDataError(f"No {description} readings in the lookback window.")

    series = df[column].dropna()
    return float(series.iloc[-1]), series.index[-1]


# ── Weather (Open-Meteo hourly) ─────────────────────────────────────────────────────

def _fetch_weather_history() -> pd.DataFrame:
    """Trailing hourly Open-Meteo readings, oldest first, forward-filled like training."""
    # Open-Meteo's `past_days` is whole days, so round up and pad by one extra day --
    # guarantees the 72-row rolling window below always has 72 full hourly rows even
    # if "now" falls near the start of today's data.
    past_days = math.ceil(WEATHER_LOOKBACK_HOURS / 24) + 1

    params = {
        "latitude": LATITUDE,
        "longitude": LONGITUDE,
        "hourly": OPEN_METEO_HOURLY_VARS,
        "past_days": past_days,
        "forecast_days": 1,   # we only need "now", not the outlook -- keep it light
        "timezone": "America/New_York",  # matches pot_river_dc_little_falls_pump_sta.py
    }

    responses = _openmeteo.weather_api(OPEN_METEO_FORECAST_URL, params=params)
    response = responses[0]
    hourly = response.Hourly()

    timestamps = pd.date_range(
        start=pd.to_datetime(hourly.Time(), unit="s", utc=True),
        end=pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
        freq=pd.Timedelta(seconds=hourly.Interval()),
        inclusive="left",
    )

    # Pull each hourly variable out of the SDK response, in the same order they were
    # requested in `params["hourly"]` above -- Open-Meteo returns them positionally.
    weather_data = {}
    for index, variable_name in enumerate(OPEN_METEO_HOURLY_VARS):
        weather_data[variable_name] = hourly.Variables(index).ValuesAsNumpy()

    weather_df = pd.DataFrame(weather_data, index=timestamps)

    # Training forward-fills these exact columns before computing rolling sums (see
    # `sparse_cols` in pot_river_dc_little_falls_pump_sta.py) -- match that here so a
    # single missing hour doesn't turn into a NaN rolling sum.
    weather_df = weather_df.ffill()

    # `forecast_days=1` can include a few hours past "now" (Open-Meteo issues
    # forecasts in blocks). Drop those so we never feed the model a value from the
    # future.
    now = pd.Timestamp.now(tz="UTC")
    weather_df = weather_df.loc[weather_df.index <= now]

    return weather_df


def _compute_weather_features(weather_df: pd.DataFrame) -> tuple[dict, pd.Timestamp]:
    """Turns the raw hourly weather history into the model's weather-related features."""
    if weather_df.empty:
        raise InsufficientDataError("No Open-Meteo weather data returned.")

    latest_row = weather_df.iloc[-1]
    weather_reading_at = weather_df.index[-1]

    # ── About these 3/24/72-hour windows ──
    # The offline training ingestion script (pot_river_dc_little_falls_pump_sta.py)
    # computes these as `.rolling(36)`, `.rolling(288)`, `.rolling(864)` on a
    # DataFrame built by concatenating 15-min hydraulic data with hourly weather data
    # BY INDEX, without resampling either to a common frequency first. That means
    # those row counts don't cleanly equal "3/24/72 hours" the way the code's own
    # comments claim -- flagged as an open data-engineering risk in MODEL_WIRING.md.
    #
    # Here we compute the literal, documented intent instead: a true 3/24/72-HOUR
    # sum, directly on Open-Meteo's native hourly series, where rolling(3) really
    # does mean 3 hours. Before trusting this in production, diff a handful of
    # live-computed rows against the training CSV's precip_*_log columns for
    # matching timestamps -- if the ingestion script's misalignment shifted what the
    # model actually learned, this implementation and the trained model will
    # disagree on what "72h of rain" means.
    rolling_windows_hours = {
        "precip_3hr_log": 3,
        "precip_24hr_log": 24,
        "precip_72hr_log": 72,
    }

    features = {}
    for feature_name, window_hours in rolling_windows_hours.items():
        if len(weather_df) < window_hours:
            raise InsufficientDataError(
                f"Need {window_hours}h of trailing weather history for "
                f"{feature_name}, only have {len(weather_df)}h."
            )
        rolling_sum = weather_df["precipitation"].tail(window_hours).sum()
        # clip(lower=0) in training guards against stray negative values before the
        # log transform -- log1p of a negative number is undefined.
        features[feature_name] = float(np.log1p(max(rolling_sum, 0.0)))

    # These features use the single most recent hourly reading, not a rolling
    # aggregate -- just pass them through as-is.
    passthrough_columns = [
        "temperature_2m",
        "wind_speed_10m",
        "vapour_pressure_deficit",
        "rain",
        "snowfall",
        "snow_depth",
    ]
    for column in passthrough_columns:
        features[column] = float(latest_row[column])

    return features, weather_reading_at


# ── Public entry point ──────────────────────────────────────────────────────────────

def build_feature_row() -> tuple[pd.DataFrame, dict]:
    """
    Build one model-ready feature row from live USGS + Open-Meteo data.

    Returns:
        (features_df, metadata)
          - features_df: a single-row DataFrame with columns == FEATURE_COLUMNS, in
            order, ready to hand straight to `model.predict_proba(features_df)`.
          - metadata: the observation timestamp behind each source, so a future
            /predict endpoint can report data freshness / flag stale readings
            without recomputing anything (see Step 3 in MODEL_WIRING.md).

    Raises:
        InsufficientDataError if any live source doesn't yet have enough history to
        fill one of the model's features.
    """
    gage_height = _fetch_gage_height_history()
    gage_features, gauge_reading_at = _compute_gage_features(gage_height)

    weather_df = _fetch_weather_history()
    weather_features, weather_reading_at = _compute_weather_features(weather_df)

    water_quality_df = _fetch_daily_water_quality()
    temperature_c, temperature_reading_at = _latest_value(
        water_quality_df, "temperature_c", "daily water temperature"
    )
    specific_conductance_us_cm, conductance_reading_at = _latest_value(
        water_quality_df, "specific_conductance_us_cm", "daily specific conductance"
    )

    row = {
        **gage_features,
        **weather_features,
        "specific_conductance_us_cm": specific_conductance_us_cm,
        "temperature_c": temperature_c,
    }

    # Selecting by FEATURE_COLUMNS (rather than trusting dict insertion order) is
    # what actually guarantees the model sees its columns in the order it expects.
    features_df = pd.DataFrame([row], columns=FEATURE_COLUMNS)

    metadata = {
        "gauge_reading_at": gauge_reading_at,
        "weather_reading_at": weather_reading_at,
        "water_temperature_reading_at": temperature_reading_at,
        "specific_conductance_reading_at": conductance_reading_at,
    }
    return features_df, metadata


if __name__ == "__main__":
    # Manual smoke test: `python flood_features_pot_river_dc_little_falls_pump_station.py`
    # Per MODEL_WIRING.md Step 1, the real verification is diffing this output against
    # a matching row from the training CSV -- this just confirms the pipeline runs and
    # shows what it produced.
    try:
        result_df, result_metadata = build_feature_row()
        print("Feature row (column order matches the trained pipeline's feature_columns):")
        print(result_df.to_string(index=False))
        print("\nSource timestamps:")
        for key, value in result_metadata.items():
            print(f"  {key}: {value}")
    except InsufficientDataError as exc:
        print(f"Not enough live data to build a feature row yet: {exc}")
