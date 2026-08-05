"""
Seasonal historical baseline for the Little Falls Pump Station (USGS-01646500).

Answers one question: how does today's discharge compare to what this river
normally does at this point in the calendar? Backs the /historical_context
endpoint. See HISTORICAL_COMPARER_WIRING.md for the design rationale and the
empirical validation behind the choices below.

The approach is six small USGS calls rather than one large one: for each of the
last six years, ask for exactly the +/-7 days around today's date in that year.
Selecting the dates server-side means this module needs no day-of-year
arithmetic, has no calendar-wraparound edge case in late December, and fetches
~90 rows instead of ~2,200.

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

# Reused for the "current" value -- this is the same P1D continuous pull the
# charts already make, so asking for it here costs nothing extra.
from .flood_prediction_pot_river_dc_little_falls_pump_station import get_current_data

SITE_ID = "USGS-01646500"
DISCHARGE_PARAM = "00060"

DAY_PAD = 7             # +/- days around the anniversary; 15 days fetched per year
BASELINE_YEARS = 5      # historical years in the baseline (current year excluded)
MIN_SAMPLES = 30        # ~75 available from 5 full windows
MIN_YEAR_SAMPLES = 5    # per-year strip: don't plot a bar from 2 days

CURRENT_WINDOW_LABEL = "24h"


class BaselineUnavailableError(Exception):
    """
    Raised when the historical baseline can't be built at all (USGS unreachable or
    returning nothing). The router turns this into a 503.

    Distinct from a per-comparison "not enough samples" outcome, which is NOT an
    exception -- that comes back as a status field inside a 200, the same way
    /flood_risk handles insufficient_data.
    """


# ── Fetch ────────────────────────────────────────────────────────────────────────

def _fetch_window(start: pd.Timestamp, end: pd.Timestamp) -> pd.Series:
    """Daily mean discharge for one explicit date range."""
    df, _ = waterdata.get_daily(
        monitoring_location_id=SITE_ID,
        parameter_code=[DISCHARGE_PARAM],
        # RFC 3339 bounded interval -- USGS does the date selection server-side,
        # which is what lets this module skip all day-of-year arithmetic.
        time=f"{start:%Y-%m-%dT00:00:00Z}/{end:%Y-%m-%dT23:59:59Z}",
    )
    if df.empty:
        return pd.Series(dtype="float64")

    df = df[["time", "value"]].copy()
    df["time"] = pd.to_datetime(df["time"], utc=True)
    # errors="coerce" turns any non-numeric sentinel USGS sends (e.g. "Ice") into
    # NaN rather than leaving a string in a float column.
    df["value"] = pd.to_numeric(df["value"], errors="coerce")

    series = df.dropna(subset=["value"]).sort_values("time").set_index("time")["value"]
    # USGS occasionally repeats a day around provisional-data corrections.
    return series[~series.index.duplicated(keep="first")]


def _fetch_seasonal_windows(target: pd.Timestamp) -> dict[int, pd.Series]:
    """
    One +/-DAY_PAD window per year, keyed by the anniversary's year.

    Six separate calls rather than one big pull, on purpose: asking USGS for the
    exact 15 days around each anniversary means no day-of-year math here, and no
    calendar-wraparound edge case in late December.
    """
    windows: dict[int, pd.Series] = {}

    for years_back in range(0, BASELINE_YEARS + 1):
        anniversary = target - pd.DateOffset(years=years_back)
        start = anniversary - pd.Timedelta(days=DAY_PAD)
        end = anniversary + pd.Timedelta(days=DAY_PAD)

        try:
            series = _fetch_window(start, end)
        except Exception as exc:
            # One bad year shouldn't sink the whole baseline -- skip it and let
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
# were built for, and this refetches exactly when the date rolls over.
#
# Known limitation: per-worker. Under `uvicorn --workers 4` there are four copies
# and up to four cold fetches. Fine at this traffic level.

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
    """Called once from main.py's lifespan so the first user of the day isn't the
    one who pays for the six cold fetches."""
    windows, _ = _history(pd.Timestamp.now(tz="UTC"))
    print(f"Historical baseline warmed: {len(windows)} seasonal windows, "
          f"{sum(len(s) for s in windows.values())} daily values.")


# ── Comparison ───────────────────────────────────────────────────────────────────

def compare(current: float, baseline: pd.Series) -> dict:
    """
    Where `current` sits among past readings from this time of year.

    `baseline` already excludes the current year -- see _split_windows(). That
    matters: if today were inside its own baseline, a real drought would drag the
    baseline toward current conditions and under-report itself, worst exactly when
    it matters most.

    percentile is the headline, percent_change is secondary -- percent_change is
    unbounded upward (4x normal reads "+300%") but floored at -100%, so the two
    directions aren't visually comparable. See HISTORICAL_COMPARER_WIRING.md
    section 2 for the measured day-over-day volatility behind that choice.
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
        # Returned but not displayed: discharge is right-skewed, so a couple of
        # flood days pull the mean above typical conditions. Having the median here
        # makes that divergence diagnosable without a re-fetch.
        "baseline_median": round(float(baseline.median()), 1),
        "sample_size": int(baseline.count()),
    }


def _split_windows(windows: dict[int, pd.Series], target: pd.Timestamp) -> tuple[pd.Series, dict]:
    """
    Windows -> (baseline series, per-year strip).

    The current year is in the strip but NOT in the baseline. That asymmetry is the
    whole point: this year is a legitimate bar on the chart, and must not be part of
    the average it's being measured against.
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

    A mean, not the latest 15-minute value, for two reasons: a single instantaneous
    reading against a multi-year baseline makes the headline flip between "30% up"
    and "15% down" on page refresh, and a 24h mean matches the baseline's own
    aggregation (USGS daily values are daily means too).
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
    # Smoke test: python -m app.services.potomac_river.historical_baseline_pot_river_dc_little_falls_pump_station
    # (run from backend/, so the relative import above resolves)
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
