import Footer from "../footer/footer";

export default function GetInvolved() {
    return (
        <main className="min-h-screen bg-page text-ink">
            <section className="relative overflow-hidden">
                <div className="relative mx-auto max-w-[1600px] px-6 py-14 sm:px-10 lg:px-12 lg:py-20">
                    <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-accent">
                            Get Involved
                        </p>
                        <h1 className="mt-4 text-4xl font-black leading-[0.92] tracking-tight text-ink sm:text-5xl lg:text-6xl">
                            Stay Up to Date
                        </h1>
                        <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-ink-muted sm:text-lg sm:leading-8">
                            Below are some ways to keep up with the platform as new dashboards are added. Whether you
                            are a student, researcher, or just someone who cares about the health of our rivers, these
                            resources are for you.
                        </p>
                    </div>
                </div>
            </section>

            <section className="relative overflow-hidden border-t border-line bg-panel">
                <div className="relative mx-auto max-w-[1600px] px-6 py-14 sm:px-10 lg:px-12 lg:py-20">
                    <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
                        <h2 className="text-2xl font-bold leading-[0.92] tracking-tight text-ink sm:text-3xl lg:text-4xl">
                            Resources
                        </h2>
                        <a
                            href="https://forms.gle/jV11BTfcm3iUUmbG6"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-8 inline-flex items-center justify-center rounded-full bg-accent px-4 py-2 text-sm font-semibold text-page transition hover:bg-ink"
                        >
                            Newsletter
                        </a>
                    </div>
                </div>
            </section>




            <Footer />
        </main>
    )
}