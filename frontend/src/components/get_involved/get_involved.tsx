import Footer from "../footer/footer";

export default function GetInvolved() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.14),_transparent_28%),linear-gradient(180deg,_#06111f_0%,_#081726_55%,_#0b1220_100%)]" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

                <div className="relative mx-auto max-w-7xl px-6 py-14 sm:px-10 lg:px-12 lg:py-20">
                    <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-200/80">
                            Get Involved
                        </p>
                        <h1 className="mt-4 text-4xl font-black leading-[0.92] tracking-tight text-white sm:text-5xl lg:text-6xl">
                            Built by the Community, for the Community
                        </h1>
                        <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-slate-300 sm:text-lg sm:leading-8">
                            Below are some ways you can get involved with the DMV River Intelligence Network. Whether you
                            are a student, researcher, or just someone who cares about the health of our rivers, there is
                            a place for you.
                        </p>
                    </div>
                </div>
            </section>

            <section className="relative overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(34,197,94,0.14),_transparent_28%),linear-gradient(180deg,_#06111f_0%,_#081726_55%,_#0b1220_100%)]" />
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/40 to-transparent" />

                <div className="relative mx-auto max-w-7xl px-6 py-14 sm:px-10 lg:px-12 lg:py-20">
                    <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
                        <h2 className="text-2xl font-bold leading-[0.92] tracking-tight text-white sm:text-3xl lg:text-4xl">
                            Resources
                        </h2>
                        <a
                            href="https://forms.gle/jV11BTfcm3iUUmbG6"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-8 inline-flex items-center justify-center rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
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