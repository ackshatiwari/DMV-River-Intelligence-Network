import Image from "next/image";
import Link from "next/link";
import Logo from "@/src/components/logo/logo";
import Footer from "../footer/footer";



// Dashboard cards shown directly below the hero -- add a new entry here for each new dashboard
const dashboards = [
    {
        name: "Potomac River",
        qualifier: "(near Little Falls)",
        image: "/pot_river_near_little_falls.png",
        coordinates: "38.9497° N, -77.1278° W",
        href: "/chapters/pot_river_dc_little_falls_pump_station",
    },
];

// Steps shown in the "How it works" section, left to right
const steps = [
    { title: "Collect", description: "Retrieve observations from public data sources." },
    { title: "Process", description: "Clean and organize the data for analysis." },
    { title: "Analyze", description: "Apply models to identify trends and potential risks." },
    { title: "Visualize", description: "Explore the results in interactive dashboards." },
];

// Figures shown in the "Our impact in numbers" section
const impactStats = [
    { value: "1+", label: "Dashboard" },
    { value: "200+", label: "Followers" },
    { value: "15+", label: "Active members" },
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


type HomeProps = {
    /** Switches the main page to the About section (owned by app/page.tsx). */
    onAboutClick: () => void;
};

export default function Home({ onAboutClick }: HomeProps) {
    return (
        <main className="min-h-screen bg-page text-ink">
            <section className="relative overflow-hidden">
                <div className="relative mx-auto grid max-w-[1600px] gap-14 px-6 py-16 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:px-12 lg:py-24">
                    <div className="flex flex-col justify-center">


                        <h1 className="mt-8 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-ink sm:text-6xl lg:text-7xl">
                            Environmental Data 

                            <span className="mt-4 block text-accent">Made Easier to Understand</span>
                        </h1>

                        <p className="mt-6 max-w-2xl text-lg leading-8 text-ink-muted sm:text-xl">
                            This platform, designed by the DMV River Intelligence Network, brings together historical
                            public data, turning them into simple visualizations and powering predictive models, 
                            allowing you to easily explore the waterways of Maryland and Virginia. 
                        </p>

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

            <section id="dashboards" className="border-t border-line bg-panel px-6 py-16 sm:px-10 lg:px-12 lg:py-20">
                <div className="mx-auto max-w-[1600px]">
                    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
                        Dashboards
                    </p>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                        Explore the dashboards
                    </h2>

                    <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                        {dashboards.map((dashboard) => (
                            <Link
                                key={dashboard.href}
                                href={dashboard.href}
                                className="group block overflow-hidden rounded-3xl border border-line bg-page transition hover:border-accent"
                            >
                                <div className="relative aspect-[5/2]">
                                    <Image
                                        src={dashboard.image}
                                        alt={`${dashboard.name} ${dashboard.qualifier}`}
                                        fill
                                        className="object-cover"
                                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                                    />
                                </div>
                                <div className="p-6">
                                    <h3 className="text-xl font-bold text-ink">
                                        {dashboard.name} <span className="text-accent">{dashboard.qualifier}</span>
                                    </h3>
                                    <p className="mt-2 flex items-center text-sm text-ink-muted">
                                        <Image src="/marker.png" alt="" width={20} height={20} className="mr-2" />
                                        {dashboard.coordinates}
                                    </p>
                                    <span className="mt-5 inline-flex items-center justify-center rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-page transition group-hover:bg-ink">
                                        View Dashboard
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            </section>

            <section id="how-it-works" className="bg-page px-6 py-20 sm:px-10 lg:px-12 lg:py-28">
                <div className="mx-auto max-w-[1600px]">
                    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
                        How it works
                    </p>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                        From monitoring stations to meaningful insights.
                    </h2>

                    {/* On wide screens: a line runs through the numbered circles (the ol's
                        ::before), and a thin divider sits between each step's text (each
                        li's ::before, skipped on the first). Both drop away when the steps
                        wrap onto multiple rows. */}
                    <ol className="relative mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:before:absolute lg:before:left-[12.5%] lg:before:right-[12.5%] lg:before:top-4 lg:before:h-px lg:before:bg-line">
                        {steps.map((step, index) => (
                            <li
                                key={step.title}
                                className="relative flex flex-col items-center px-6 text-center lg:not-first:before:absolute lg:not-first:before:bottom-0 lg:not-first:before:left-0 lg:not-first:before:top-14 lg:not-first:before:w-px lg:not-first:before:bg-line"
                            >
                                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-page">
                                    {index + 1}
                                </span>
                                <h3 className="mt-5 text-lg font-semibold text-ink">{step.title}</h3>
                                <p className="mt-2 max-w-[16rem] text-sm leading-6 text-ink-muted">{step.description}</p>
                            </li>
                        ))}
                    </ol>
                </div>
            </section>

            <section id="impact" className="border-t border-line bg-panel px-6 py-20 sm:px-10 lg:px-12 lg:py-24">
                <div className="mx-auto max-w-[1600px]">
                    <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
                        Impact
                    </p>
                    <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                        Our impact in numbers
                    </h2>

                    <div className="mt-10 grid gap-4 sm:grid-cols-3">
                        {impactStats.map((stat) => (
                            <div
                                key={stat.label}
                                className="rounded-3xl border border-line bg-page p-6"
                            >
                                <div className="text-5xl font-black text-ink">{stat.value}</div>
                                <div className="mt-2 text-sm font-medium text-ink-muted">{stat.label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Compact call-to-action strip: copy on the left, a thin divider, then
                the form button. Stacks (and drops the divider) on narrow screens. */}
            <section id="start-a-dashboard" className="border-t border-line bg-page px-6 py-20 sm:px-10 lg:px-12 lg:py-24">
                <div className="mx-auto flex max-w-[1600px] flex-col gap-6 sm:flex-row sm:items-center sm:gap-0">
                    <div className="min-w-0 flex-1 sm:pr-8">
                        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-accent">
                            Start A Dashboard
                        </p>
                        <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink sm:text-4xl">
                            Bring a dashboard to your local waterway
                        </h2>
                        <p className="mt-4 max-w-3xl text-sm leading-6 text-ink-muted">
                            Recognize any problems with your local waterway that a dashboard could help address?
                            Fill out the form and tell us about the site, and we will reach out about building it together. 
                            You would be recognized in the credits section of the dashboard for your contributions.

                        </p>
                    </div>

                    <div className="flex shrink-0 items-center sm:self-stretch sm:border-l sm:border-line sm:pl-8 lg:pl-12">
                        <a
                            href="https://docs.google.com/forms/d/e/1FAIpQLSdFtdKmVT25GAiPFtvf1vnVMfYiEcWQybVUBURLLkGX7DV9UA/viewform?usp=dialog"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-page transition hover:bg-ink"
                        >
                            Start a Dashboard
                            <span aria-hidden="true" className="transition group-hover:translate-x-0.5">→</span>
                        </a>
                    </div>
                </div>
            </section>

            <section id="faq" className="border-t border-line bg-panel px-6 py-20 sm:px-10 lg:px-12 lg:py-24">
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
                                className="rounded-3xl border border-line bg-page p-6"
                            >
                                <h3 className="text-xl font-semibold text-ink">{faq.question}</h3>
                                <p className="mt-3 text-sm leading-7 text-ink-muted">{faq.answer}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="border-t border-line bg-page px-6 py-12 sm:px-10 lg:px-12">
                <div className="mx-auto max-w-[1600px] rounded-[2rem] border border-line bg-panel px-6 py-8 sm:px-8">
                    <Logo />
                </div>
            </section>

            <Footer tone="panel" />

            
        </main>
    );
}
