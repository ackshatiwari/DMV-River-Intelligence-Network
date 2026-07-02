"""
USGS data import template — uses the official `dataretrieval` package.

`dataretrieval` is maintained by USGS alongside their API, so endpoint and
auth changes are absorbed upstream rather than requiring edits here.

Copy this file per river chapter; edit the three config blocks at the top.
"""

from dataretrieval import waterdata
import pandas as pd


# ── 1. Site ───────────────────────────────────────────────────────────────────
SITE_ID = "USGS-01646500"  # must include the USGS- prefix

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


# ── Helpers ───────────────────────────────────────────────────────────────────
def _time():
    return PERIOD if PERIOD else f"{START_DATE}/{END_DATE}"


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


# ── Fetch ─────────────────────────────────────────────────────────────────────
def fetch_hydraulic():
    df, _ = waterdata.get_continuous(
        monitoring_location_id=SITE_ID,
        parameter_code=list(CONTINUOUS_PARAMS.keys()),
        time=_time(),
    )
    return _pivot(df, CONTINUOUS_PARAMS)


def fetch_water_quality():
    df, _ = waterdata.get_daily(
        monitoring_location_id=SITE_ID,
        parameter_code=list(DAILY_PARAMS.keys()),
        time=_time(),
    )
    return _pivot(df, DAILY_PARAMS)


# ── Main ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    hydraulic = fetch_hydraulic()
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
