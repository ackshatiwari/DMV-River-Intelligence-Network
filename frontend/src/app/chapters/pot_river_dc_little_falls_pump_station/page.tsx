"use client";

import { useEffect, useState } from "react";
import RiverDataChart, { type RiverMetric } from "@/src/components/RiverDataChart";
import FloodRiskCard, { type FloodRiskResponse } from "@/src/components/FloodRiskCard";

type RiverApiData = Record<string, Record<string, string | number | null | undefined>>;

const FLOOD_RISK_POLL_INTERVAL_MS = 10 * 60 * 1000; // 10 min, matched to the gauge's ~15-min update cadence

const riverMetrics: RiverMetric[] = [
    { key: "discharge_cfs", label: "Discharge", description: "Volume of water flowing past this point", unit: "cfs" },
    { key: "gage_height_ft", label: "Gage Height", description: "Water surface elevation above the gage datum", unit: "ft" },
    { key: "specific_conductance_us_cm", label: "Conductivity", description: "Dissolved ion concentration in the water", unit: "μS/cm" },
    { key: "water_temperature_c", label: "Temperature", description: "Temperature of the river water itself", unit: "°C" },
];

export default function LittleFallsPumpStation() {
    const [riverData, setRiverData] = useState<RiverApiData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [floodRisk, setFloodRisk] = useState<FloodRiskResponse | null>(null);
    const [floodRiskLoading, setFloodRiskLoading] = useState(true);
    const [floodRiskError, setFloodRiskError] = useState<string | null>(null);

    useEffect(() => {
        fetchContinuousData();
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
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-4 py-8 text-slate-50 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
                <header className="max-w-3xl">
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">DMV River Intelligence Network - Little Falls Pump Station</h1>
                </header>

                <FloodRiskCard floodRisk={floodRisk} loading={floodRiskLoading} error={floodRiskError} />

                {error ? (
                    <div className="rounded-2xl border border-rose-500/30 bg-rose-950/60 px-4 py-3 text-sm text-rose-100">
                        {error}
                    </div>
                ) : null}

                {loading ? (
                    <div className="rounded-2xl border border-slate-700/70 bg-slate-950/70 px-4 py-6 text-sm text-slate-300 shadow-2xl shadow-slate-950/40 backdrop-blur">
                        Loading river data...
                    </div>
                ) : null}

                {riverData ? (
                    <RiverDataChart data={riverData} metrics={riverMetrics} title="Potomac River at Little Falls Pump Station" />
                ) : null}
            </div>

        </main>

    );
}