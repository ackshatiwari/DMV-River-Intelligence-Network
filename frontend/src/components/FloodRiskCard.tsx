"use client";

// Purely presentational, same split as RiverDataChart.tsx -- the page component
// owns fetching/polling/state, this component just renders whatever it's given.
// Mirrors the FastAPI FloodRiskResponse / DataFreshness pydantic models in
// backend/app/routers/potomac_river/pot_river_dc_little_falls_pump_station.py --
// keep these two in sync if that response shape changes.

export type DataFreshness = {
    gauge_age_minutes: number;
    weather_age_minutes: number;
    water_quality_age_minutes: number;
};

export type FloodRiskResponse = {
    status: "ok" | "insufficient_data";
    probability: number | null;
    risk_level: "low" | "elevated" | null;
    model_version: string;
    generated_at: string;
    gauge_reading_at: string | null;
    data_freshness: DataFreshness | null;
    stale: boolean;
    detail: string | null;
};

type FloodRiskCardProps = {
    floodRisk: FloodRiskResponse | null;
    loading: boolean;
    error: string | null;
};

export default function FloodRiskCard({ floodRisk, loading, error }: FloodRiskCardProps) {
    return (
        <section className="rounded-2xl border border-line bg-panel p-4 md:p-6">
            <h2 className="text-xl font-semibold text-ink md:text-2xl">Flood Risk</h2>

            {loading && !floodRisk ? (
                <p className="mt-2 text-sm text-ink-muted">Loading flood risk...</p>
            ) : null}

            {error ? (
                <div className="mt-2 rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
                    {error}
                </div>
            ) : null}

            {floodRisk?.status === "insufficient_data" ? (
                <p className="mt-2 text-sm text-ink-muted">
                    Not enough data yet to predict flood risk.
                    {floodRisk.detail ? ` (${floodRisk.detail})` : null}
                </p>
            ) : null}

            {floodRisk?.status === "ok" ? (
                <div className="mt-2 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-3">
                        <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${floodRisk.risk_level === "elevated"
                                    ? "bg-danger-soft text-danger"
                                    : "bg-success-soft text-success"
                                }`}
                        >
                            {floodRisk.risk_level === "elevated" ? "Elevated risk" : "Low risk"} *
                        </span>
                        {floodRisk.probability !== null ? (
                            <span className="text-sm text-ink-muted">
                               ({(floodRisk.probability * 100).toFixed(1)}% probability)
                            </span>
                        ) : null}
                    </div>

                    {floodRisk.gauge_reading_at ? (
                        <p className="text-xs text-ink-muted">
                            Based on readings at {new Date(floodRisk.gauge_reading_at).toLocaleString()}
                        </p>
                    ) : null}

                    {floodRisk.stale ? (
                        <div className="rounded-2xl border border-warning/30 bg-warning-soft px-4 py-2 text-sm text-warning">
                            Data may be outdated -- the latest gauge reading is older than expected.
                        </div>
                    ) : null}

                    <p className="text-xs text-ink-muted">
                        * This is for informational purposes only. For emergency situations, please contact local authorities. AI predictions may include mistakes.
                    </p>
                </div>
            ) : null}
        </section>
    );
}
