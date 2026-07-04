import Image from "next/image";
import Link from "next/link";
import Logo from "@/src/components/logo/logo";

const impactMetrics = [
    { value: "1", label: "Active Chapter" },
    { value: "4", label: "Specialized Teams per Chapter" },
    { value: "24/7", label: "Open access to river data" },
];

// Pillars of the DMV River Intelligence Network Home Page
const pillars = [
    {
        title: "Open, Accurate Data",
        description: "We turn online jargon into clear, AI-driven insight about local rivers and streams.",
    },
    {
        title: "Student Research",
        description: "Each chapter team creates datasets, builds dashboards, and publishes reports",
    },
    {
        title: "Community Impact",
        description: "Dashboards and AI-driven insight help residents, students, and local organizations understand stream health and environmental conditions.",
    },
];

export default function Home() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.14),_transparent_28%),linear-gradient(180deg,_#06111f_0%,_#081726_55%,_#0b1220_100%)]" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

                <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-16 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-12 lg:py-24">
                    <div className="flex flex-col justify-center">


                        <h1 className="mt-8 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl">
                            Know your river.
                            <span className="mt-4 block text-cyan-200">Understand the data behind it.</span>
                        </h1>

                        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300 sm:text-xl">
                            Open data, student research, and technology working together to make Northern
                            Virginia's waterways easier to explore, explain, and protect.
                        </p>

                        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                            <Link
                                href="#mission"
                                className="inline-flex items-center justify-center rounded-full bg-cyan-400 px-6 py-3.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                            >
                                Explore our mission
                            </Link>
                            <Link
                                href="mailto:dmv.rivernetwork@gmail.com"
                                className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
                            >
                                Contact the team
                            </Link>
                        </div>

                        <div className="mt-12 grid gap-4 sm:grid-cols-3">
                            {impactMetrics.map((metric) => (
                                <div
                                    key={metric.label}
                                    className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_12px_40px_rgba(2,6,23,0.25)] backdrop-blur"
                                >
                                    <div className="text-4xl font-black text-white">{metric.value}</div>
                                    <div className="mt-2 text-sm font-medium text-slate-300">{metric.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-center lg:justify-end">
                        <div className="relative w-full max-w-[620px] overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/40 shadow-[0_24px_80px_rgba(15,23,42,0.55)] backdrop-blur">
                            <div className="relative aspect-[4/5] sm:aspect-[5/4] lg:aspect-[11/12]">
                                <Image
                                    src="/river.png"
                                    alt="Goose Creek - A State-Scenic River in Northern Virginia"
                                    fill
                                    className="object-cover"
                                    priority
                                    sizes="(max-width: 1024px) 100vw, 50vw"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent" />

                                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                                    <div className="max-w-md rounded-2xl border border-white/10 bg-slate-950/55 p-5 backdrop-blur-md">
                                        <h2 className="mt-2 text-2xl font-bold text-white">Goose Creek</h2>
                                        <p className="mt-2 text-sm leading-6 text-slate-300">
                                            A State-Scenic River in Northern Virginia
                                        </p>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="border-t border-white/10 bg-slate-900/85">
                <div className="mx-auto grid max-w-7xl gap-4 px-6 py-12 sm:px-10 lg:grid-cols-3 lg:px-12">
                    {pillars.map((pillar) => (
                        <article
                            key={pillar.title}
                            className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_16px_48px_rgba(2,6,23,0.2)]"
                        >
                            <div className="mb-4 h-1.5 w-16 rounded-full bg-cyan-300" />
                            <h3 className="text-xl font-semibold text-white">{pillar.title}</h3>
                            <p className="mt-3 text-sm leading-7 text-slate-300">{pillar.description}</p>
                        </article>
                    ))}
                </div>
            </section>

            <section id="mission" className="bg-slate-950 px-6 py-20 sm:px-10 lg:px-12 lg:py-28">
                <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                            Our mission
                        </p>
                        <h2 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                            A student-led nonprofit making river information clearer, faster, and more useful.
                        </h2>
                        <p className="mt-6 max-w-3xl text-lg leading-8 text-slate-300">
                            The DMV River Intelligence Network brings publicly available environmental data into
                            one accessible platform. We help students, communities, and local organizations
                            understand the health of their waterways through analysis, interactive dashboards,
                            and educational resources.
                        </p>
                    </div>

                    <aside className="rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/8 to-white/4 p-7 shadow-[0_20px_60px_rgba(2,6,23,0.35)] backdrop-blur">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                            What we focus on
                        </p>
                        <ul className="mt-6 space-y-4 text-slate-200">
                            <li className="rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-4">
                                Environmental data translated into readable insight.
                            </li>
                            <li className="rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-4">
                                Research that supports local understanding and decision-making.
                            </li>
                            <li className="rounded-2xl border border-white/10 bg-slate-900/45 px-4 py-4">
                                Tools designed to help the public engage with river conditions.
                            </li>
                        </ul>
                    </aside>
                </div>
            </section>

            <section className="border-t border-white/10 bg-slate-900/80 px-6 py-12 sm:px-10 lg:px-12">
                <div className="mx-auto max-w-7xl rounded-[2rem] border border-white/10 bg-white/5 px-6 py-8 shadow-[0_20px_60px_rgba(2,6,23,0.25)] sm:px-8">
                    <Logo />
                </div>
            </section>

            <footer className="border-t border-white/10 bg-slate-950 px-6 py-8 sm:px-10 lg:px-12">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                    <p>© {new Date().getFullYear()} DMV River Intelligence Network. All rights reserved.</p>
                    <Link href="mailto:dmv.rivernetwork@gmail.com" className="transition hover:text-white">
                        Contact us
                    </Link>
                </div>
            </footer>
        </main>
    );
}
