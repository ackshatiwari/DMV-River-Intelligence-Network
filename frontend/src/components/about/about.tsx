export default function About() {
    return (
        <main className="min-h-screen bg-page text-ink">
            <section className="relative overflow-hidden py-16 sm:py-24">
                <div className="relative mx-auto max-w-[1600px] px-6 sm:px-10 lg:px-12">
                    <div className="mx-auto max-w-2xl text-center">
                        <h1 className="text-5xl font-black leading-tight tracking-tight text-ink sm:text-6xl">
                            Meet the Team
                        </h1>
                    </div>

                    <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">

                        <div className="flex flex-col items-center rounded-lg border border-line bg-panel p-8 transition hover:border-accent">
                            <img
                                src="/Ackshat_Founder.png"
                                alt="Ackshat Tiwari"
                                className="h-48 w-48 rounded-lg object-cover"
                            />
                            <h2 className="mt-6 text-2xl font-bold text-ink">Ackshat Tiwari</h2>
                            <p className="mt-2 text-center text-ink-muted">
                               <strong>Founder & CEO</strong><br />
                               I am a high school sophomore in the Academies of Loudoun, and I am passionate about applying
                               technology and ML to solve real-world problems. I build and maintain this platform,
                               and am the lead ML Engineer behind the Potomac River near Little Falls dashboard.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}