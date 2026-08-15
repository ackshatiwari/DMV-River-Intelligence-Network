"""
USGS data import — uses the official `dataretrieval` package.

`dataretrieval` is maintained by USGS alongside their API, so endpoint and
auth changes are absorbed upstream rather than requiring edits here.

`openmeteo_requests` is used to fetch weather data from Open-Meteo, which is key for 
understanding the root cause behind water data and quality fluctuations and trends. 

Copy this file per river chapter, and edit the three config blocks at the top;
i.e. SITE_ID, CONTINUOUS_PARAMS, DAILY_PARAMS, and the time range (PERIOD or START/END).
"""


from dataretrieval import waterdata
import pandas as pd
import openmeteo_requests
import requests_cache
from retry_requests import retry
from datetime import datetime, timedelta
from pathlib import Path





# ── 1. Site ───────────────────────────────────────────────────────────────────
SITE_ID = "USGS-01646500"  # Potomac River Near Wash, DC Little Falls Pump Sta - USGS-01646500

# ── 2. Parameters ─────────────────────────────────────────────────────────────
# continuous = 15-min instantaneous — hydraulic
CONTINUOUS_PARAMS = {
    "00060": "streamflow_cfs",
    "00065": "gage_height_ft",
}

# daily = midnight-to-midnight mean — water quality
DAILY_PARAMS = {
    "00010": "temperature_c",
    "00095": "specific_conductance_us_cm",
    "00300": "dissolved_oxygen_mg_l",
    "00400": "pH",
    "63680": "turbidity_fnu",
}

# ── 3. Time range ─────────────────────────────────────────────────────────────
# ISO 8601 duration (e.g. "P30D" = last 30 days) OR "YYYY-MM-DD/YYYY-MM-DD".
# Period takes priority when set; set to None to use START/END dates.
PERIOD = None  # last 1100 days
START_DATE = "2010-07-06"
END_DATE = "2026-07-06"

# lat / lng
LATITUDE = 38.94778
LONGITUDE = -77.12764


# ------------------4. OpemMeteo API client-------------------------------------------------
cache_session = requests_cache.CachedSession('.cache', expire_after = 3600)
retry_session = retry(cache_session, retries = 5, backoff_factor = 0.2)
openmeteo = openmeteo_requests.Client(session = retry_session)
# ------------------------------------------------------------------------------------------


OPEN_METEO_VARS = [
    # Core runoff drivers
    "precipitation",
    "rain",
    "snowfall",
    "snow_depth",
    
    # Antecedent moisture
    "soil_moisture_0_to_1cm",
    "soil_moisture_1_to_3cm",
    
    # Temperature and wind
    "temperature_2m",
    "wind_speed_10m",
    "vapour_pressure_deficit",
]


url = "https://archive-api.open-meteo.com/v1/archive"
params = {
	"latitude": LATITUDE,
	"longitude": LONGITUDE,
	"hourly": OPEN_METEO_VARS,
    "timezone": "America/New_York",
}


# ── Helpers ───────────────────────────────────────────────────────────────────
def _time():
    return PERIOD if PERIOD else f"{START_DATE}/{END_DATE}"


def _weather_dates():
    if PERIOD:
        days = int(PERIOD.replace("P", "").replace("D", ""))
        end = datetime.now()
        start = end - timedelta(days=days)
        return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")
    return START_DATE, END_DATE


def _pivot(df, param_map):
    """
    The new waterdata API returns long-format data (one row per observation).
    This pivots to wide format and renames parameter codes to human labels.
    """
    if df.empty:
        return pd.DataFrame()
    
    df = df[df["parameter_code"].isin(param_map.keys())].copy()

    if df.empty:
        return pd.DataFrame()
    
    df["parameter_code"] = df["parameter_code"].map(param_map)
    df["value"] = pd.to_numeric(df["value"], errors="coerce")
    df["time"] = pd.to_datetime(df["time"], utc=True)

    pivot = df.pivot_table(
        index="time", columns="parameter_code", values="value", aggfunc="first"
    )

    pivot.columns.name = None
    pivot.index.name = "datetime"
    return pivot


def _add_precip_windows(weather_df):
    """
    Trailing precipitation totals over 3h / 24h / 72h.

    Computed on the HOURLY weather frame at its native resolution, which is the
    only place these can be computed correctly -- see the note in
    fill_csv_dataset() for what went wrong when they were computed after the merge.

    The windows are TIME-based ("3h") rather than row-count-based (36). That
    distinction is the whole fix: a row count only means a fixed duration if the
    index has a fixed spacing, and this project's merged index does not.

    min_periods is pinned to the exact number of hourly readings each window
    needs, so a window that isn't fully covered comes back as NaN instead of a
    quietly-too-small partial sum. That mirrors the live inference path, which
    raises InsufficientDataError rather than emitting a partial window.
    """
    if weather_df.empty or "precipitation" not in weather_df.columns:
        return weather_df

    weather_df = weather_df.sort_index()

    for column, window, hours in (
        ("precip_3hr", "3h", 3),
        ("precip_24hr", "24h", 24),
        ("precip_72hr", "72h", 72),
    ):
        weather_df[column] = (
            weather_df["precipitation"].rolling(window, min_periods=hours).sum()
        )

    return weather_df


def fill_csv_dataset(hydraulic_df, water_quality_df, weather_df):
    """
    Merge the three datasets into a single DataFrame and save to CSV.
    """
    # CHANGED: the precip_3hr / precip_24hr / precip_72hr columns are now built
    # HERE, on the hourly weather frame, BEFORE the merge below. They used to be
    # built after the merge, on the concatenated + forward-filled frame, which was
    # wrong in two compounding ways:
    #
    #   1. Row counts, not durations. The old code used .rolling(36) / (288) /
    #      (864) and a comment claiming those meant 3h / 24h / 72h. They only mean
    #      that at 5-minute spacing. The merged index below is mostly 15-minute
    #      (and this site's archive actually mixes 5-minute and 15-minute eras), so
    #      a fixed row count spanned a different amount of time in different parts
    #      of the same dataset. There is no row count that is correct here.
    #
    #   2. Forward-filled rain was summed repeatedly. `precipitation` is hourly and
    #      is ffill'd onto the finer hydraulic grid below, so each hourly reading
    #      appears ~4x in a row. Summing over those rows counted the same rain
    #      several times over.
    #
    # Net effect: the trained columns ran ~7-12x larger than the identically-named
    # values that flood_features_pot_river_dc_little_falls_pump_station.py computes
    # at prediction time, so the model was served rain totals far outside the range
    # it learned on. Computing them here, on the hourly data, makes the two paths
    # agree by construction.
    weather_df = _add_precip_windows(weather_df)

    df = pd.concat([hydraulic_df, water_quality_df, weather_df], axis=1)

    sparse_cols = [
        "dissolved_oxygen_mg_l", "pH", "specific_conductance_us_cm",
        "temperature_c", "turbidity_fnu",
        "soil_moisture_0_to_1cm", "soil_moisture_1_to_3cm",
        "precipitation", "rain", "snowfall", "snow_depth",
        "temperature_2m", "wind_speed_10m", "vapour_pressure_deficit",
        # CHANGED: added to this list. Now that the three precip windows arrive
        # from the hourly weather frame, they land on only 1 in every ~4 rows of
        # the merged index and are NaN elsewhere. Forward-filling them here keeps
        # every row usable -- without this, the training notebook's
        # dropna(subset=feature_columns) would discard ~75% of the dataset.
        # This is the same treatment the other hourly weather columns above
        # already get, so it introduces no new assumption.
        "precip_3hr", "precip_24hr", "precip_72hr",
    ]
    df[sparse_cols] = df[sparse_cols].ffill()

    output_dir = Path(__file__).resolve().parents[2] / "SOURCES_AND_DATASHEETS"
    output_dir.mkdir(parents=True, exist_ok=True)

    output_file = output_dir / f"usgs_data_{SITE_ID}.csv"
    df.to_csv(output_file)
    print(f"\nData saved to CSV: {output_file}")

# ── Fetch ─────────────────────────────────────────────────────────────────────

def _date_chunks(start_date, end_date, max_days=1000):
    """Split a date range into chunks no longer than max_days (margin under the 1100-day API cap)."""
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    chunks = []
    current = start

    while current < end:
        chunk_end = min(current + timedelta(days=max_days), end)
        chunks.append((current.strftime("%Y-%m-%d"), chunk_end.strftime("%Y-%m-%d")))
        current = chunk_end + timedelta(days=1)
    return chunks


def fetch_hydraulic():
    start, end = _weather_dates()
    dfs = []

    for chunk_start, chunk_end in _date_chunks(start, end):
        print(f"  fetching hydraulic {chunk_start} to {chunk_end}...")
        df, _ = waterdata.get_continuous(
            monitoring_location_id=SITE_ID,
            parameter_code=list(CONTINUOUS_PARAMS.keys()),
            time=f"{chunk_start}/{chunk_end}",
        )
        if not df.empty:
            dfs.append(df)
    if not dfs:
        return pd.DataFrame()
    return _pivot(pd.concat(dfs, ignore_index=True), CONTINUOUS_PARAMS)


def fetch_water_quality():
    start, end = _weather_dates()
    dfs = []
    
    for chunk_start, chunk_end in _date_chunks(start, end):
        print(f"  fetching water quality {chunk_start} to {chunk_end}...")
        df, _ = waterdata.get_daily(
            monitoring_location_id=SITE_ID,
            parameter_code=list(DAILY_PARAMS.keys()),
            time=f"{chunk_start}/{chunk_end}",
        )
        if not df.empty:
            dfs.append(df)
    if not dfs:
        return pd.DataFrame()
    return _pivot(pd.concat(dfs, ignore_index=True), DAILY_PARAMS)

def fetch_weather():
    start, end = _weather_dates()
    
    params["start_date"] = start
    params["end_date"]   = end

    responses = openmeteo.weather_api(url, params=params)
    response  = responses[0]
    hourly    = response.Hourly()

    df = pd.DataFrame({
        "timestamp":               pd.date_range(
            start     = pd.to_datetime(hourly.Time(),    unit="s", utc=True),
            end       = pd.to_datetime(hourly.TimeEnd(), unit="s", utc=True),
            freq      = pd.Timedelta(seconds=hourly.Interval()),
            inclusive = "left",
        ),
        "precipitation":           hourly.Variables(0).ValuesAsNumpy(),
        "rain":                    hourly.Variables(1).ValuesAsNumpy(),
        "snowfall":                hourly.Variables(2).ValuesAsNumpy(),
        "snow_depth":              hourly.Variables(3).ValuesAsNumpy(),
        "soil_moisture_0_to_1cm":  hourly.Variables(4).ValuesAsNumpy(),
        "soil_moisture_1_to_3cm":  hourly.Variables(5).ValuesAsNumpy(),
        "temperature_2m":          hourly.Variables(6).ValuesAsNumpy(),
        "wind_speed_10m":          hourly.Variables(7).ValuesAsNumpy(),
        "vapour_pressure_deficit": hourly.Variables(8).ValuesAsNumpy(),
    }).set_index("timestamp")

    return df



        

# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    hydraulic = fetch_hydraulic()
    weather = fetch_weather()
    wq = fetch_water_quality()

    print("── Hydraulic (15-min) ──")
    if hydraulic.empty:
        print("  no data")
    else:
        print(f"  {len(hydraulic)} rows, columns: {list(hydraulic.columns)}")
        print(hydraulic.head())

    print("\n── Water quality (daily) ──")
    if wq.empty:
        print("  no data")
    else:
        print(f"  {len(wq)} rows, columns: {list(wq.columns)}")
        print(wq.head())
    
    print("\n── Weather (hourly) ──")
    if weather.empty:
        print("  no data")
    else:
        print(f"  {len(weather)} rows, columns: {list(weather.columns)}")
        print(weather.head())
    
    # if there is data, group them into ONE large DataFrame and save to CSV for later use
    if not hydraulic.empty or not wq.empty or not weather.empty:
        fill_csv_dataset(hydraulic, wq, weather)
    else:
        print("\nNo data to save to CSV.")


