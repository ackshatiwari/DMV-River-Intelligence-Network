"""
Seasonal historical baseline for the Little Falls Pump Station (USGS-01646500).

Answers one question: how does today's discharge compare to what this river
normally does at this point in the calendar? Backs the /historical_context
endpoint. See HISTORICAL_COMPARER_WIRING.md for the design rationale.

One small USGS call per year rather than one large one: for each of the last
BASELINE_YEARS + 1 years, ask for exactly the +/-DAY_PAD days around today's date
in that year. Letting USGS select the dates server-side means this module needs no
day-of-year arithmetic and has no calendar-wraparound edge case in late December.

This module is INDEPENDENT of the flood model -- it touches no .pkl and no
FEATURE_COLUMNS. Do not import it from flood_features_*.py: its lookback windows
and aggregations are chosen for display, and silently feeding them to the model
is the train/serve skew failure mode documented in MODEL_WIRING.md section 4.

Discharge only, deliberately. Gage height is measured against a local datum, so a
multi-year stage baseline can drift when the channel scours or the gauge is
re-surveyed -- changes that have nothing to do with how much water is in the
river. Discharge is rating-curve corrected and comparable across years.
"""

import numpy as np
import pandas as pd
from dataretrieval import waterdata

# The same P1D continuous pull the charts already make.
from .flood_prediction_pot_river_dc_little_falls_pump_station import get_current_data

SITE_ID = "USGS-01646500"
DISCHARGE_PARAM = "00060"

DAY_PAD = 7             # +/- days around the anniversary; 15 days fetched per year
BASELINE_YEARS = 15     # historical years in the baseline (current year excluded)
MIN_SAMPLES = 30        # a floor, not a target: 15 full windows yield ~225
MIN_YEAR_SAMPLES = 5    # per-year strip: don't plot a bar from 2 days

CURRENT_WINDOW_LABEL = "24h"


class BaselineUnavailableError(Exception):
    """
    Raised when the baseline can't be built at all (USGS unreachable or returning
    nothing). The router turns this into a 503.

    Distinct from a "not enough samples" outcome, which is NOT an exception -- that
    comes back as a status field inside a 200.
    """


# ── Fetch ────────────────────────────────────────────────────────────────────────

def _fetch_window(start: pd.Timestamp, end: pd.Timestamp) -> pd.Series:
    """Daily mean discharge for one explicit date range."""
    df, _ = waterdata.get_daily(
        monitoring_location_id=SITE_ID,
        parameter_code=[DISCHARGE_PARAM],
        time=f"{start:%Y-%m-%dT00:00:00Z}/{end:%Y-%m-%dT23:59:59Z}",
    )
    if df.empty:
        return pd.Series(dtype="float64")

    df = df[["time", "value"]].copy()
    df["time"] = pd.to_datetime(df["time"], utc=True)
    # USGS sends non-numeric sentinels (e.g. "Ice"); coerce rather than leave a
    # string in a float column.
    df["value"] = pd.to_numeric(df["value"], errors="coerce")

    series = df.dropna(subset=["value"]).sort_values("time").set_index("time")["value"]
    # USGS occasionally repeats a day around provisional-data corrections.
    return series[~series.index.duplicated(keep="first")]


def _fetch_seasonal_windows(target: pd.Timestamp) -> dict[int, pd.Series]:
    """One +/-DAY_PAD window per year, keyed by the anniversary's year."""
    windows: dict[int, pd.Series] = {}

    for years_back in range(0, BASELINE_YEARS + 1):
        anniversary = target - pd.DateOffset(years=years_back)
        start = anniversary - pd.Timedelta(days=DAY_PAD)
        end = anniversary + pd.Timedelta(days=DAY_PAD)

        try:
            series = _fetch_window(start, end)
        except Exception as exc:
            # One bad year shouldn't sink the baseline -- skip it and let
            # MIN_SAMPLES decide whether what's left is still enough.
            print(f"Seasonal window {start:%Y-%m-%d}..{end:%Y-%m-%d} failed: {exc}")
            continue

        if not series.empty:
            windows[anniversary.year] = series

    if not windows:
        raise BaselineUnavailableError("No seasonal windows could be fetched from USGS.")
    return windows


# ── Cache ────────────────────────────────────────────────────────────────────────
#
# Keyed on the target DATE, not a TTL: the windows are only valid for the day they
# were built for, so this refetches exactly when the date rolls over.
#
# Per-worker. Under `uvicorn --workers 4` there are four copies and up to four cold
# fetches. Fine at this traffic level.

_cache: dict = {"windows": None, "for_date": None, "at": None}


def _history(target: pd.Timestamp) -> tuple[dict[int, pd.Series], pd.Timestamp]:
    """Returns ({year: window series}, when it was fetched)."""
    if _cache["windows"] is not None and _cache["for_date"] == target.date():
        return _cache["windows"], _cache["at"]

    windows = _fetch_seasonal_windows(target)
    now = pd.Timestamp.now(tz="UTC")
    _cache.update({"windows": windows, "for_date": target.date(), "at": now})
    return windows, now


def warm_baseline_cache() -> None:
    """Called once from main.py's lifespan so the day's first visitor isn't the one
    who pays for the cold fetches."""
    windows, _ = _history(pd.Timestamp.now(tz="UTC"))
    print(f"Historical baseline warmed: {len(windows)} seasonal windows, "
          f"{sum(len(s) for s in windows.values())} daily values.")


# ── Comparison ───────────────────────────────────────────────────────────────────

def compare(current: float, baseline: pd.Series) -> dict:
    """
    Where `current` sits among past readings from this time of year.

    `baseline` already excludes the current year (see _split_windows). That matters:
    if today were inside its own baseline, a real drought would drag the baseline
    toward current conditions and under-report itself, worst exactly when it
    matters most.
    """
    baseline = baseline.dropna()

    if baseline.count() < MIN_SAMPLES:
        return {"status": "insufficient_data", "sample_size": int(baseline.count())}

    mean = float(baseline.mean())
    # Guard the divide BEFORE it happens -- a near-zero denominator turns a
    # rounding artifact into a "+40,000% above average" headline.
    if not np.isfinite(mean) or abs(mean) < 1e-9:
        return {"status": "undefined", "sample_size": int(baseline.count())}

    return {
        "status": "ok",
        "percentile": round(float((baseline < current).mean() * 100), 1),
        "percent_change": round((current - mean) / mean * 100, 1),
        "baseline_mean": round(mean, 1),
        # Not displayed. Discharge is right-skewed, so having the median here makes
        # a mean/median divergence diagnosable without a re-fetch.
        "baseline_median": round(float(baseline.median()), 1),
        "sample_size": int(baseline.count()),
    }


def _split_windows(windows: dict[int, pd.Series], target: pd.Timestamp) -> tuple[pd.Series, dict]:
    """
    Windows -> (baseline series, per-year strip).

    The current year is in the strip but NOT in the baseline: this year is a
    legitimate bar on the chart, and must not be part of the average it is being
    measured against.
    """
    historical = [s for year, s in windows.items() if year != target.year]
    baseline = pd.concat(historical) if historical else pd.Series(dtype="float64")

    per_year = {
        str(year): {"mean": round(float(s.mean()), 1), "n": int(s.count())}
        for year, s in sorted(windows.items())
        if s.count() >= MIN_YEAR_SAMPLES
    }
    return baseline, per_year


# ── Current value ────────────────────────────────────────────────────────────────

def _current_discharge() -> tuple[float, pd.Timestamp]:
    """
    Trailing 24h MEAN discharge, plus the timestamp of the most recent reading.

    A mean rather than the latest 15-minute value: a single instantaneous reading
    against a multi-year baseline makes the headline flip on page refresh, and a
    24h mean matches the baseline's own aggregation (USGS daily values are means).
    """
    df = get_current_data()
    if "discharge_cfs" not in df.columns:
        raise BaselineUnavailableError("No discharge column in the live 24h pull.")

    series = df.set_index("time")["discharge_cfs"].dropna()
    if series.empty:
        raise BaselineUnavailableError("No discharge readings in the last 24h.")

    return float(series.mean()), series.index[-1]


# ── Public entry point ───────────────────────────────────────────────────────────

def get_historical_context() -> dict:
    """Payload for the /historical_context endpoint."""
    now = pd.Timestamp.now(tz="UTC")
    windows, fetched_at = _history(now)
    baseline, per_year = _split_windows(windows, now)
    current, observed_at = _current_discharge()

    return {
        "site_id": SITE_ID,
        "parameter": "discharge_cfs",
        "generated_at": now,
        "baseline_as_of": fetched_at,
        "current": round(current, 1),
        "current_window": CURRENT_WINDOW_LABEL,
        "observed_at": observed_at,
        "comparison": compare(current, baseline),
        "per_year": per_year,
    }


if __name__ == "__main__":
    # Smoke test, run from backend/:
    #   python -m app.services.potomac_river.pot_river_dc_little_falls_pump_station.past_year_comparision_pot_river_dc_little_falls_pump_station
    try:
        result = get_historical_context()
        print(f"current ({result['current_window']}): {result['current']} cfs "
              f"@ {result['observed_at']}")
        print(f"comparison: {result['comparison']}")
        print("per year:")
        for year, stats in sorted(result["per_year"].items()):
            print(f"  {year}: mean={stats['mean']:>9.1f} cfs  n={stats['n']}")
    except BaselineUnavailableError as exc:
        print(f"Baseline unavailable: {exc}")
