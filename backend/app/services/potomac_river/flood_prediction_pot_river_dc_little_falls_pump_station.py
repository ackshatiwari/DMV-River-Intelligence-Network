"""
Live "current conditions" feed for the Little Falls Pump Station (USGS-01646500).

This backs the /current_conditions endpoint -- the four charts on the chapter page
plus the headline number above each one. It is NOT the model's input path; that is
flood_features_pot_river_dc_little_falls_pump_station.py, which deliberately pulls
some of these same parameter codes at a different aggregation (see that module's
docstring for why).

A note on NaN, since it is the whole reason this module has more than one function:
the four parameters below report on DIFFERENT cadences at USGS (discharge and gage
height every ~15 min, water temperature and specific conductance far less often).
Pivoting them onto a shared `time` index therefore produces a deliberately SPARSE
grid -- most cells have no reading and come back as NaN. That is expected, not a
data error. But JSON has no NaN literal, so handing that frame straight to FastAPI
raises "Out of range float values are not JSON compliant". Everything below exists
to convert that sparse frame into something JSON can actually represent.
"""

from typing import Any, Optional

import pandas as pd
from dataretrieval import waterdata

SITE_ID = "USGS-01646500"

PARAMETER_NAMES = {
    "00060": "discharge_cfs",
    "00065": "gage_height_ft",
    "00010": "water_temperature_c",
    "00095": "specific_conductance_us_cm",
}


def get_current_data() -> pd.DataFrame:
    """
    Last 24h of continuous readings, one column per parameter, oldest first.

    The returned frame is sparse by design (see the module docstring) -- callers
    that intend to serialize it must go through get_current_conditions() rather
    than encoding it directly.
    """
    df_continuous, metadata = waterdata.get_continuous(
        monitoring_location_id=SITE_ID,
        parameter_code=list(PARAMETER_NAMES.keys()),
        time="P1D",
    )

    if df_continuous.empty:
        # An empty frame with the right columns keeps every downstream caller on
        # the same code path -- the snapshot just comes back all-null.
        return pd.DataFrame(columns=["time", *PARAMETER_NAMES.values()])

    df = df_continuous[["time", "parameter_code", "value"]].copy()

    # Rename parameter codes to readable names
    df["parameter_code"] = df["parameter_code"].replace(PARAMETER_NAMES)

    df["time"] = pd.to_datetime(df["time"], utc=True)
    # errors="coerce" turns any non-numeric sentinel USGS sends (e.g. "Ice") into
    # NaN rather than leaving a string in a float column.
    df["value"] = pd.to_numeric(df["value"], errors="coerce")

    # pivot_table with aggfunc="first" rather than plain pivot: pivot RAISES if the
    # feed ever repeats a (time, parameter) pair, which does happen around
    # provisional-data corrections. Same output otherwise.
    df = (
        df.pivot_table(
            index="time",
            columns="parameter_code",
            values="value",
            aggfunc="first",
        )
        .sort_index()
        .reset_index()
    )

    df.columns.name = None
    return df


def _to_iso(timestamp: Any) -> Optional[str]:
    """Timestamp -> ISO-8601 string, or None if it isn't a real timestamp."""
    if timestamp is None or pd.isna(timestamp):
        return None
    return pd.Timestamp(timestamp).isoformat()


def _latest_reading(df: pd.DataFrame, column: str) -> dict:
    """
    Most recent non-null value for one parameter, with the time it was observed.

    Each parameter gets its OWN timestamp on purpose. They report on different
    cadences, so a single shared "as of" time across all four would be wrong for
    at least three of them.
    """
    if column not in df.columns:
        return {"value": None, "observed_at": None}

    series = df.set_index("time")[column].dropna()
    if series.empty:
        # Sensor offline, or nothing reported in the last 24h. A legitimate null,
        # which the frontend renders as "—".
        return {"value": None, "observed_at": None}

    return {
        "value": float(series.iloc[-1]),
        "observed_at": _to_iso(series.index[-1]),
    }


def _series_to_json_safe(df: pd.DataFrame) -> dict:
    """
    Frame -> {column: {row_index: value}}, with NaN replaced by None.

    That nested shape is pandas' default `.to_dict()` orientation and is what
    RiverDataChart.tsx already reads, so it is kept as-is. The .astype(object)
    dance is what actually kills the NaN: on a float64 column, assigning None
    silently turns straight back into NaN, so the column has to leave float dtype
    first.

    Row indices are stringified because `.to_dict()` hands back pandas' INTEGER
    index as the inner key, and a JSON object key can only be a string. The
    frontend reads these via Object.entries(), which yields strings regardless.
    """
    if df.empty:
        return {}

    safe = df.copy()
    safe["time"] = safe["time"].map(_to_iso)
    safe = safe.astype(object).where(pd.notna(safe), None)

    return {
        str(column): {str(index): value for index, value in values.items()}
        for column, values in safe.to_dict().items()
    }


def get_current_conditions() -> dict:
    """
    JSON-safe payload for the /current_conditions endpoint.

    Returns:
        {
          "site_id": str,
          "snapshot": {parameter: {"value": float|None, "observed_at": str|None}},
          "data":     {column: {row_index: value|None}}   # 24h series for the charts
        }
    """
    df = get_current_data()

    snapshot = {name: _latest_reading(df, name) for name in PARAMETER_NAMES.values()}

    return {
        "site_id": SITE_ID,
        "snapshot": snapshot,
        "data": _series_to_json_safe(df),
    }
