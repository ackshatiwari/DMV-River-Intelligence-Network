import Image from "next/image";
import Link from "next/link";
import Logo from "@/src/components/logo/logo";
import Footer from "../footer/footer";

const impactMetrics = [
    { value: "1", label: "Active Dashboard" },
    { value: "10+", label: "Users" }
];

// Frequently asked questions shown below the mission section
const faqs = [
    {
        question: "Where does this data come from?",
        answer: "This data is collected from public gauges, including those operated by the USGS. In other words, none of this data is hallucinated.",
    },
    {
        question: "Should we trust the models?",
        answer: "While the models are surprisingly accurate (for example, the flood prediction model identified 25 out of 25 flood events within 11 hours), they are for informational purposes only and should not be taken at face value. After all, the models are powered by machine learning and can make mistakes.",
    },
];


export default function Home() {
    return (
        <main className="min-h-screen bg-page text-ink">
            <section className="relative overflow-hidden">
                <div className="relative mx-auto grid max-w-[1600px] gap-14 px-6 py-16 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-12 lg:py-24">
                    <div className="flex flex-col justify-center">


                        <h1 className="mt-8 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
                            DMV River Intelligence Network
                            <span className="mt-4 block text-accent">Dashboard Platform</span>
                        </h1>

                        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted sm:text-xl">
                            Powered by open data, we make Northern Virginia's waterways easier to explore and understand
                        </p>

                        <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                            <Link
                                href="/chapters"
                                className="inline-flex items-center justify-center rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-page transition hover:bg-ink"
                            >
                                View Dashboards
                            </Link>
                            <Link
                                href="mailto:dmv.rivernetwork@gmail.com"
                                className="inline-flex items-center justify-center rounded-full border border-line px-6 py-3.5 text-sm font-semibold text-ink transition hover:border-accent hover:bg-panel"
                            >
                                Contact the team
                            </Link>
                        </div>

                        <div className="mt-12 grid gap-4 sm:grid-cols-3">
                            {impactMetrics.map((metric) => (
                                <div
                                    key={metric.label}
                                    className="rounded-3xl border border-line bg-panel p-5"
                                >
                                    <div className="text-4xl font-black text-ink">{metric.value}</div>
                                    <div className="mt-2 text-sm font-medium text-ink-muted">{metric.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center justify-center lg:justify-end">
                        <div className="relative w-full max-w-[620px] overflow-hidden rounded-[2rem] border border-line bg-panel">
                            <div className="relative aspect-[4/5] sm:aspect-[5/4] lg:aspect-[11/12]">
                                <Image
                                    src="/river.png"
                                    alt="Goose Creek - A State-Scenic River in Northern Virginia"
                                    fill
                                    className="object-cover"
                                    priority
                                    sizes="(max-width: 1024px) 100vw, 50vw"
                                />
                                <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
                                    <div className="max-w-md rounded-2xl bg-ink/80 p-5">
                                        <h2 className="mt-2 text-2xl font-bold text-page">Goose Creek</h2>
                                        <p className="mt-2 text-sm leading-6 text-panel">
                                            A State-Scenic River in Northern Virginia
                                        </p>
                                    </div>
                                </div>

                            </div>
                        </div>
                    </div>
                </div>
            </section>

            

            <section id="mission" className="bg-page px-6 py-20 sm:px-10 lg:px-12 lg:py-28">
                <div className="mx-auto grid max-w-[1600px] gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
                            About the platform
                        </p>
                        <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                            One place for every river dashboard, making river information clearer, faster, and more useful.
                        </h2>
                        <p className="mt-6 max-w-3xl text-lg leading-8 text-ink-muted">
                            This platform brings publicly available environmental data together in a collection of
                            interactive dashboards. Each dashboard tracks a local waterway, helping residents,
                            students, and local organizations understand its current conditions and long-term health.
                        </p>
                    </div>

                    <aside className="rounded-[2rem] border border-line bg-panel p-7">
                        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
                            What each dashboard offers
                        </p>
                        <ul className="mt-6 space-y-4 text-ink">
                            <li className="rounded-2xl border border-line bg-page px-4 py-4">
                                Live river conditions from public gauges.
                            </li>
                            <li className="rounded-2xl border border-line bg-page px-4 py-4">
                                Historical context comparing today&apos;s flow with past years.
                            </li>
                            <li className="rounded-2xl border border-line bg-page px-4 py-4">
                                AI-driven flood risk predictions.
                            </li>
                        </ul>
                    </aside>
                </div>
            </section>

            <section id="faq" className="border-t border-line bg-page px-6 py-20 sm:px-10 lg:px-12 lg:py-24">
                <div className="mx-auto max-w-[1600px]">
                    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
                        FAQ
                    </p>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                        Frequently asked questions
                    </h2>

                    <div className="mt-10 grid gap-4 lg:grid-cols-2">
                        {faqs.map((faq) => (
                            <article
                                key={faq.question}
                                className="rounded-3xl border border-line bg-panel p-6"
                            >
                                <h3 className="text-xl font-semibold text-ink">{faq.question}</h3>
                                <p className="mt-3 text-sm leading-7 text-ink-muted">{faq.answer}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="border-t border-line bg-panel px-6 py-12 sm:px-10 lg:px-12">
                <div className="mx-auto max-w-[1600px] rounded-[2rem] border border-line bg-page px-6 py-8 sm:px-8">
                    <Logo />
                </div>
            </section>

            <Footer />

            
        </main>
    );
}
