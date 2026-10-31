"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/src/components/logo/logo";
import Footer from "../footer/footer";
import { useEffect } from "react";
import LittleFallsPumpStation from "@/src/app/chapters/pot_river_dc_little_falls_pump_station/page";

export default function Locations() {
    const router = useRouter();

    useEffect(() => {
        const pot_river_near_little_falls_btn = document.getElementById('potomac-river-near-little-falls-dashboard');

        if (!pot_river_near_little_falls_btn) {
            return;
        }

        const handleClick = () => {
            router.push('/chapters/pot_river_dc_little_falls_pump_station');
        };

        pot_river_near_little_falls_btn.addEventListener('click', handleClick);

        return () => {
            pot_river_near_little_falls_btn.removeEventListener('click', handleClick);
        };
    }, [router]);






    return (
        <main className="min-h-screen bg-page text-ink">
            <section className="relative overflow-hidden">
                <div className="relative mx-auto max-w-[1600px] px-6 py-14 sm:px-10 lg:px-12 lg:py-20">
                    <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent">
                            Dashboards
                        </p>
                        <h1 className="mt-4 text-4xl font-black leading-[0.92] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                            Explore the Dashboards
                        </h1>
                        <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-ink-muted sm:text-lg sm:leading-8">
                            Each dashboard follows a single monitoring site on a local waterway, combining live
                            gauge readings, historical context, and flood risk predictions to help communities
                            understand the health of their rivers and streams.
                        </p>
                    </div>

                    <div className="flex items-center justify-center lg:justify-end">

                    </div>
                </div>
            </section>

            {/* Arranged in a card-style format, each with the image of a river, name, location, and a brief description */}
            <section className="relative overflow-hidden border-t border-line bg-panel">
                <div className="relative mx-auto max-w-[1600px] px-6 py-14 sm:px-10 lg:px-12 lg:py-20">
                    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
                        <div className="rounded-lg border border-line bg-page p-6">
                            <Image src="/pot_river_near_little_falls.png" alt="Potomac River" width={300} height={300} className="rounded-md" />
                            <h2 className="text-xl font-bold text-ink">Potomac River <span className="text-accent">(near Little Falls)</span></h2>
                            <div className="text-ink-muted">
                                <Image src="/marker.png" alt="marker" width={20} height={20} className="inline-block mr-2" />
                                38.9497° N, -77.1278° W
                            </div>
                            <div>
                                <button id="potomac-river-near-little-falls-dashboard" className="mt-2 inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-page transition hover:bg-ink">
                                    View Dashboard
                                </button>
                            </div>

                        </div>
                    </div>
                </div>
            </section>




            <Footer />
        </main>


    )
} 