"use client";

import { useEffect, useState } from "react";
import RiverDataChart, { type RiverMetric } from "@/src/components/RiverDataChart";

type RiverApiData = Record<string, Record<string, string | number | null | undefined>>;

const riverMetrics: RiverMetric[] = [
    { key: "discharge_cfs", label: "Discharge", unit: "cfs" },
    { key: "gage_height_ft", label: "Gage Height", unit: "ft" },
    { key: "specific_conductance_us_cm", label: "Conductivity", unit: "μS/cm" },
    { key: "water_temperature_c", label: "Temperature", unit: "°C" },
];

export default function LittleFallsPumpStation() {
    const [riverData, setRiverData] = useState<RiverApiData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchContinuousData();
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

    return (
        <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.12),_transparent_35%),linear-gradient(180deg,_#020617_0%,_#0f172a_100%)] px-4 py-8 text-slate-50 sm:px-6 lg:px-8">
            <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
                <header className="max-w-3xl">
                    <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">DMV River Intelligence Network - Little Falls Pump Station</h1>
                </header>

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
                    <div className="max-w-2xl">
                        <RiverDataChart data={riverData} metrics={riverMetrics} title="Potomac River at Little Falls Pump Station" />
                    </div>
                ) : null}
            </div>

        </main>

    );
}