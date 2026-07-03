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
PERIOD = "P30D"
START_DATE = "2026-06-01"
END_DATE = "2026-06-30"

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


def fill_csv_dataset(hydraulic_df, water_quality_df, weather_df):
    """
    Merge the three datasets into a single DataFrame and save to CSV.
    """
    df = pd.concat([hydraulic_df, water_quality_df, weather_df], axis=1)

    sparse_cols = [
        "dissolved_oxygen_mg_l", "pH", "specific_conductance_us_cm",
        "temperature_c", "turbidity_fnu",
        "soil_moisture_0_to_1cm", "soil_moisture_1_to_3cm",
        "precipitation", "rain", "snowfall", "snow_depth",
        "temperature_2m", "wind_speed_10m", "vapour_pressure_deficit"
    ]
    df[sparse_cols] = df[sparse_cols].ffill()

    # Derived precipitation features
    # rolling(3) = 3 hours, rolling(24) = 24 hours
    df["precip_3hr"]  = df["precipitation"].rolling(36).sum()
    df["precip_24hr"] = df["precipitation"].rolling(288).sum()
    df["precip_72hr"] = df["precipitation"].rolling(864).sum()

    df.to_csv(f"backend/SOURCES_AND_DATASHEETS/usgs_data_{SITE_ID}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")
    print(f"\nData saved to CSV: usgs_data_{SITE_ID}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")

# ── Fetch ─────────────────────────────────────────────────────────────────────

# Fetch 15-min hydraulic data (streamflow, gage height) for the site and time range.
def fetch_hydraulic():
    df, _ = waterdata.get_continuous(
        monitoring_location_id=SITE_ID,
        parameter_code=list(CONTINUOUS_PARAMS.keys()),
        time=_time(),
    )
    return _pivot(df, CONTINUOUS_PARAMS)

# Fetch daily water quality data (temperature, conductivity, DO, pH, turbidity) for the site and time range.
def fetch_water_quality():
    df, _ = waterdata.get_daily(
        monitoring_location_id=SITE_ID,
        parameter_code=list(DAILY_PARAMS.keys()),
        time=_time(),
    )
    return _pivot(df, DAILY_PARAMS)


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
