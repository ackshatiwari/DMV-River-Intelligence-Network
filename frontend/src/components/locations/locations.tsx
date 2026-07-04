import Image from "next/image";
import Link from "next/link";
import Logo from "@/src/components/logo/logo";
import Footer from "../footer/footer";

export default function Locations() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.14),_transparent_28%),linear-gradient(180deg,_#06111f_0%,_#081726_55%,_#0b1220_100%)]" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

                <div className="relative mx-auto max-w-7xl px-6 py-14 sm:px-10 lg:px-12 lg:py-20">
                    <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                            Chapters
                        </p>
                        <h1 className="mt-4 text-4xl font-black leading-[0.92] tracking-tight text-white sm:text-5xl lg:text-6xl">
                            Local Chapters, Shared Vision
                        </h1>
                        <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-slate-300 sm:text-lg sm:leading-8">
                            Each chapter of the DMV River Intelligence Network is a student-led team that
                            collects and analyzes environmental data from local waterways. Chapters create
                            datasets, build dashboards, and publish reports to help communities understand the
                            health of their rivers and streams.
                        </p>
                    </div>

                    <div className="flex items-center justify-center lg:justify-end">

                    </div>
                </div>
            </section>

            {/* Arranged in a card-style format, each with the image of a river, name, location, and a brief description */}
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.14),_transparent_28%),linear-gradient(180deg,_#06111f_0%,_#081726_55%,_#0b1220_100%)]" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />
                <div className="relative mx-auto max-w-7xl px-6 py-14 sm:px-10 lg:px-12 lg:py-20">
                    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
                        <div className="rounded-lg border border-white/10 bg-slate-950/55 p-6 backdrop-blur-md">
                            <Image src="/pot_river_near_little_falls.png" alt="Potomac River" width={300} height={300} className="rounded-md" />
                            <h2 className="text-xl font-bold text-white">Potomac River <span className="text-cyan-300">(near Little Falls)</span></h2>
                                <div>
                                    <Image src="/marker.png" alt="marker" width={20} height={20} className="inline-block mr-2" />
                                    38.9497° N, -77.1278° W
                                </div>
                                <div>
                                    <button className="mt-2 inline-flex items-center justify-center rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
                                        Contact Chapter
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