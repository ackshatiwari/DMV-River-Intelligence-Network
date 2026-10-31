"use client";

// Purely presentational, same split as FloodRiskCard.tsx -- the page component
// owns fetching/state, this renders whatever it's given. Mirrors the FastAPI
// HistoricalContextResponse / BaselineComparison / PerYearStat pydantic models in
// backend/app/routers/potomac_river/pot_river_dc_little_falls_pump_station.py --
// keep these in sync if that response shape changes.

export type BaselineComparison = {
    status: "ok" | "insufficient_data" | "undefined";
    sample_size: number;
    percentile: number | null;
    percent_change: number | null;
    baseline_mean: number | null;
    baseline_median: number | null;
};

export type PerYearStat = {
    mean: number;
    n: number;
};

export type HistoricalContextResponse = {
    site_id: string;
    parameter: string;
    generated_at: string;
    baseline_as_of: string;
    current: number;
    current_window: string;
    observed_at: string;
    comparison: BaselineComparison;
    per_year: Record<string, PerYearStat>;
};

type HistoricalContextCardProps = {
    context: HistoricalContextResponse | null;
    loading: boolean;
    error: string | null;
};

// ── Percentile bands ──────────────────────────────────────────────────────────
//
// DIVERGING, not sequential. Percentile has two notable ends -- drought at the
// bottom, high water at the top -- so a green-to-red ramp would have to declare
// one of them "good", and on a flood-monitoring page neither is. Warm = dry,
// cool = wet, neutral gray in the middle so "normal" doesn't draw the eye.
//
// Every hex is dark enough to clear 4.5:1 against the light card surface
// (#EAEDE8), since the label is drawn in it. Only ONE band renders at a time,
// so these never need to be mutually distinguishable -- and the color never
// carries the meaning alone, the label beside it always does.

type Band = {
    label: string;
    color: string;
    /** Fill for the pill behind the label -- the band hue at low alpha. */
    tint: string;
};

function bandFor(percentile: number): Band {
    if (percentile >= 90) return { label: "Much wetter than usual", color: "#2A5680", tint: "rgba(42,86,128,0.12)" };
    if (percentile >= 75) return { label: "Wetter than usual", color: "#426F96", tint: "rgba(66,111,150,0.12)" };
    if (percentile >= 25) return { label: "About normal", color: "#636965", tint: "rgba(99,105,101,0.12)" };
    if (percentile >= 10) return { label: "Drier than usual", color: "#A0524B", tint: "rgba(160,82,75,0.12)" };
    return { label: "Much drier than usual", color: "#8E322C", tint: "rgba(142,50,44,0.12)" };
}

/**
 * "early August" -- the third of the month the baseline window straddles.
 * Thirds, because the window is +/-7 days: calling Aug 5 simply "August" would
 * overclaim, and naming the exact date would underclaim.
 */
function seasonLabel(isoDate: string): string {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return "this time of year";

    const month = date.toLocaleString(undefined, { month: "long" });
    const day = date.getDate();
    const third = day <= 10 ? "early" : day <= 20 ? "mid" : "late";
    return `${third} ${month}`;
}

/** Plural form for the headline's second line: "early Augusts". */
function seasonPlural(isoDate: string): string {
    return `${seasonLabel(isoDate)}s`;
}

function formatFlow(value: number): string {
    return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatAge(isoDate: string): string | null {
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return null;

    const minutes = Math.round((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
}

// ── Per-year strip ────────────────────────────────────────────────────────────

type PerYearStripProps = {
    perYear: Record<string, PerYearStat>;
    currentYear: string;
};

function PerYearStrip({ perYear, currentYear }: PerYearStripProps) {
    const years = Object.keys(perYear).sort();
    if (years.length === 0) return null;

    // SQUARE-ROOT scale, not linear. Across 15 years the strip is dominated by
    // flood years -- one 15,000 cfs September pins a linear scale and flattens
    // every other year onto the 2% floor, so the bars stop encoding anything.
    // Sqrt compresses that range and keeps the ordering intact. Bar length is
    // therefore NOT proportional to flow, which is why the exact value is
    // labelled beside every bar and the scale is named beneath the strip.
    const maxRoot = Math.sqrt(Math.max(...years.map((year) => perYear[year].mean), 0));

    return (
        <div className="mt-5 flex flex-1 flex-col">
            <p className="text-xs text-ink-muted">15-day window around this date, each year</p>

            {/* HORIZONTAL rows -- year label, bar, value -- so the strip fills a
                tall narrow column and every year label reads left-to-right.

                ONE series (discharge by year), so one hue. The current year is
                distinguished by weight and opacity, not by a different colour.

                Each bar sits in its own TRACK with an explicit width. Without the
                track the bar is a flex item competing with the labels for space,
                and flex-shrink squashes the long ones until every bar is nearly
                equal regardless of its value. */}
            <div className="mt-3 flex flex-1 flex-col justify-between gap-2">
                {years.map((year) => {
                    const stat = perYear[year];
                    const isCurrent = year === currentYear;
                    // Floor the width so a very dry year is still a visible mark
                    // rather than an invisible sliver.
                    const widthPercent =
                        maxRoot > 0
                            ? Math.max((Math.sqrt(Math.max(stat.mean, 0)) / maxRoot) * 100, 2)
                            : 2;

                    return (
                        <div key={year} className="flex items-center gap-2">
                            <span
                                className={`w-9 shrink-0 text-[11px] tabular-nums ${
                                    isCurrent ? "font-semibold text-ink" : "text-ink-muted"
                                }`}
                            >
                                {year}
                            </span>

                            <div
                                className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-line"
                                title={`${year}: ${formatFlow(stat.mean)} cfs mean, ${stat.n} daily readings`}
                            >
                                <div
                                    className="h-full rounded-full"
                                    style={{
                                        width: `${widthPercent}%`,
                                        backgroundColor: "var(--color-accent)",
                                        opacity: isCurrent ? 1 : 0.45,
                                    }}
                                />
                            </div>

                            <span
                                className={`w-12 shrink-0 text-right text-[11px] tabular-nums ${
                                    isCurrent ? "text-ink" : "text-ink-muted"
                                }`}
                            >
                                {formatFlow(stat.mean)}
                            </span>
                        </div>
                    );
                })}
            </div>

            
        </div>
    );
}

// ── Card ──────────────────────────────────────────────────────────────────────

export default function HistoricalContextCard({ context, loading, error }: HistoricalContextCardProps) {
    const comparison = context?.comparison;
    const percentile = comparison?.status === "ok" ? comparison.percentile : null;
    const band = percentile !== null && percentile !== undefined ? bandFor(percentile) : null;

    // Secondary number is measured against the MEDIAN, not the API's
    // percent_change (which uses the mean). Discharge is right-skewed -- a couple
    // of flood years pull the mean well above typical conditions, so the
    // mean-based figure reads far more dramatic than the percentile it sits
    // beside. Both fields stay in the API; only this one reaches the UI.
    const median = comparison?.baseline_median ?? null;
    const vsTypical =
        context && median !== null && median !== 0 ? ((context.current - median) / median) * 100 : null;

    const currentYear = context ? String(new Date(context.generated_at).getFullYear()) : null;

    // Counted from per_year rather than derived from sample_size: USGS records have
    // gaps, so sample_size / 15 rounds a full 15-year baseline down to 14. per_year
    // carries every fetched window, and the current year is in the strip but not in
    // the baseline -- hence the filter.
    const baselineYears = context
        ? Object.keys(context.per_year).filter((year) => year !== currentYear).length
        : 0;

    return (
        // flex column + h-full so the card fills the grid row's height and the
        // per-year strip below can spread into it.
        <section className="flex h-full flex-col rounded-2xl border border-line bg-panel p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <h2 className="text-xl font-semibold text-ink md:text-2xl">Compared to this time of year</h2>

                {band ? (
                    <span
                        className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold"
                        style={{ backgroundColor: band.tint, color: band.color }}
                    >
                        <span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ backgroundColor: band.color }} />
                        {band.label}
                    </span>
                ) : null}
            </div>

            {loading && !context ? (
                <p className="mt-2 text-sm text-ink-muted">Loading historical context...</p>
            ) : null}

            {error ? (
                <div className="mt-2 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
                    {error}
                </div>
            ) : null}

            {context ? (
                <>
                    <div className="mt-4 flex flex-wrap items-end gap-x-8 gap-y-4">
                        <div>
                            <div className="flex items-baseline gap-1.5">
                                <span className="text-3xl font-semibold tabular-nums text-ink">
                                    {formatFlow(context.current)}
                                </span>
                                <span className="text-sm text-ink-muted">cfs</span>
                            </div>
                            <p className="mt-0.5 text-xs text-ink-muted">
                                {context.current_window} average
                                {formatAge(context.observed_at) ? ` · ${formatAge(context.observed_at)}` : null}
                            </p>
                        </div>

                        {comparison?.status === "ok" && percentile !== null ? (
                            <div className="min-w-[16rem] flex-1">
                                {/* B: the plain claim leads. A: the number backs it. */}
                                
                                <p className="mt-1 text-sm text-ink-muted">
                                    {Math.round(100 - percentile)}% of past {seasonPlural(context.generated_at)} had higher flow
                                </p>
                            </div>
                        ) : null}
                    </div>

                    {comparison?.status === "ok" ? (
                        <p className="mt-3 text-sm text-ink-muted">
                            Based on readings from the past{" "}
                            <span className="font-medium text-ink">{baselineYears} years</span>
                        </p>
                    ) : null}

                    {comparison?.status === "insufficient_data" ? (
                        <p className="mt-3 text-sm text-ink-muted">
                            Not enough history for a comparison yet -- only {comparison.sample_size} past readings
                            available for {seasonLabel(context.generated_at)}.
                        </p>
                    ) : null}

                    {comparison?.status === "undefined" ? (
                        <p className="mt-3 text-sm text-ink-muted">
                            No meaningful comparison available
                        </p>
                    ) : null}

                    {/* Renders in every status, including the two above: the year-to-year
                        spread is useful even when the headline comparison isn't available. */}
                    <PerYearStrip perYear={context.per_year} currentYear={currentYear ?? ""} />
                </>
            ) : null}
        </section>
    );
}
