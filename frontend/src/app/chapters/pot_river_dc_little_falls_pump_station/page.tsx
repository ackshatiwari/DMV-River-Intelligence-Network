"use client";

import { useEffect, useState } from "react";
import RiverDataChart, { type RiverMetric, type UnitOption } from "@/src/components/RiverDataChart";
import FloodRiskCard, { type FloodRiskResponse } from "@/src/components/FloodRiskCard";
import HistoricalContextCard, { type HistoricalContextResponse } from "@/src/components/HistoricalContextCard";

type RiverApiData = Record<string, Record<string, string | number | null | undefined>>;

const FLOOD_RISK_POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 min, matched to the gauge's ~15-min update cadence

// Muted grey stroke demotes the two secondary metrics against the coloured
// primaries. Data logic is untouched -- this is the stroke colour only.
const SECONDARY_STROKE = "#59666C";

const PRIMARY_CHART_HEIGHT = 190;
const SECONDARY_CHART_HEIGHT = 95;

// USGS reports water temperature in °C. Converted for display only -- the API
// and the flood model behind it stay in Celsius, since the model was trained on
// °C. Fahrenheit first, so it is the default for a local, non-specialist audience.
const TEMPERATURE_UNITS: UnitOption[] = [
    { unit: "°F", convert: (celsius) => (celsius * 9) / 5 + 32 },
    { unit: "°C", convert: (celsius) => celsius },
];

// ONE array -> one card, one toggler, one observation count. Order matters: the
// grid is two columns, so the first two land in a tall top row and the last two
// in a shorter row beneath. Colours are explicit rather than positional so they
// can't drift if this array is ever reordered.
const riverMetrics: RiverMetric[] = [
    { key: "discharge_cfs", label: "Discharge", description: "Volume of water flowing past this point", unit: "cfs", color: "#477C79", chartHeight: PRIMARY_CHART_HEIGHT },
    { key: "gage_height_ft", label: "Gage Height", description: "Water surface elevation above the gage datum", unit: "ft", color: "#142B3B", chartHeight: PRIMARY_CHART_HEIGHT },
    { key: "specific_conductance_us_cm", label: "Conductivity", description: "Dissolved ion concentration in the water", unit: "μS/cm", color: SECONDARY_STROKE, chartHeight: SECONDARY_CHART_HEIGHT },
    { key: "water_temperature_c", label: "Temperature", description: "Temperature of the river water itself", unit: "°C", unitOptions: TEMPERATURE_UNITS, color: SECONDARY_STROKE, chartHeight: SECONDARY_CHART_HEIGHT },
];

export default function LittleFallsPumpStation() {
    const [riverData, setRiverData] = useState<RiverApiData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [floodRisk, setFloodRisk] = useState<FloodRiskResponse | null>(null);const [floodRiskLoading, setFloodRiskLoading] = useState(true);
    const [floodRiskError, setFloodRiskError] = useState<string | null>(null);

    const [historicalContext, setHistoricalContext] = useState<HistoricalContextResponse | null>(null);
    const [historicalLoading, setHistoricalLoading] = useState(true);
    const [historicalError, setHistoricalError] = useState<string | null>(null);

    useEffect(() => {
        fetchContinuousData();
    }, []);

    // Not polled, unlike flood risk: the baseline is served from a day-keyed cache
    // and the 24h-mean current value barely moves within a session.
    useEffect(() => {
        fetchHistoricalContext();
    }, []);

    // Separate effect from the chart's fetch above -- this one polls, the chart's
    // doesn't. The interval is cleared on unmount so it doesn't keep firing after
    // the user navigates away.
    useEffect(() => {
        fetchFloodRisk();

        const intervalId = setInterval(fetchFloodRisk, FLOOD_RISK_POLL_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, []);


    const fetchContinuousData = async () => {
        setLoading(true);
        setError(null);

        try {
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

            if (!apiBaseUrl) {
                throw new Error("NEXT_PUBLIC_API_URL is not configured.");
            }

            const response = await fetch(`${apiBaseUrl}/potomac/little_falls_pump_station/current_conditions`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data = await response.json();
            setRiverData(data.data);
            console.log("Fetched river data:", data);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Error fetching continuous data');
            setRiverData(null);
        } finally {
            setLoading(false);
        }
    };

    const fetchHistoricalContext = async () => {
        setHistoricalLoading(true);
        setHistoricalError(null);

        try {
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

            if (!apiBaseUrl) {
                throw new Error("NEXT_PUBLIC_API_URL is not configured.");
            }

            const response = await fetch(`${apiBaseUrl}/potomac/little_falls_pump_station/historical_context`);
            if (!response.ok) {
                // 503 means USGS is unreachable and the baseline couldn't be built --
                // worth saying so rather than showing an empty card.
                throw new Error(
                    response.status === 503
                        ? 'Historical baseline is temporarily unavailable.'
                        : 'Network response was not ok',
                );
            }
            const data: HistoricalContextResponse = await response.json();
            setHistoricalContext(data);
        } catch (error) {
            setHistoricalError(error instanceof Error ? error.message : 'Error fetching historical context');
            setHistoricalContext(null);
        } finally {
            setHistoricalLoading(false);
        }
    };

    const fetchFloodRisk = async () => {
        setFloodRiskLoading(true);
        setFloodRiskError(null);

        try {
            const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;

            if (!apiBaseUrl) {
                throw new Error("NEXT_PUBLIC_API_URL is not configured.");
            }

            const response = await fetch(`${apiBaseUrl}/potomac/little_falls_pump_station/flood_risk`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            const data: FloodRiskResponse = await response.json();
            setFloodRisk(data);
        } catch (error) {
            setFloodRiskError(error instanceof Error ? error.message : 'Error fetching flood risk');
            setFloodRisk(null);
        } finally {
            setFloodRiskLoading(false);
        }
    };
 
    return (
        <main className="min-h-screen bg-page px-4 py-8 text-ink sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
                <header className="max-w-3xl">
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">DMV River Intelligence Network - Little Falls Pump Station</h1>
                </header>

                {/* Two columns above ~900px, one below. The right column is a fixed
                    320px so the year-over-year strip keeps a predictable width;
                    minmax(0,1fr) on the left stops the charts' intrinsic width from
                    blowing the grid out wider than its container. */}
                <div className="grid grid-cols-1 gap-6 min-[900px]:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="flex min-w-0 flex-col gap-6">
                        {error ? (
                            <div className="rounded-2xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
                                {error}
                            </div>
                        ) : null}

                        {loading ? (
                            <div className="rounded-2xl border border-line bg-panel px-4 py-6 text-sm text-ink-muted">
                                Loading river data...
                            </div>
                        ) : null}

                        {riverData ? (
                            <RiverDataChart
                                data={riverData}
                                metrics={riverMetrics}
                                title="Potomac River at Little Falls Pump Station"
                            />
                        ) : null}

                        <FloodRiskCard floodRisk={floodRisk} loading={floodRiskLoading} error={floodRiskError} />
                    </div>

                    <div className="h-full min-w-0">
                        <HistoricalContextCard
                            context={historicalContext}
                            loading={historicalLoading}
                            error={historicalError}
                        />
                    </div>
                </div>
            </div>

        </main>

    );
}