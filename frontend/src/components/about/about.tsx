export default function About() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-100">
            <section className="relative overflow-hidden py-16 sm:py-24">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.15),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.12),_transparent_35%)]" />

                <div className="relative mx-auto max-w-7xl px-6 sm:px-10 lg:px-12">
                    <div className="mx-auto max-w-2xl text-center">
                        <h1 className="text-5xl font-black leading-tight tracking-tight text-white sm:text-6xl">
                            Meet the Team
                        </h1>
                    </div>

                    <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3">
                        <div className="flex flex-col items-center rounded-lg border border-slate-700/50 bg-slate-900/40 p-8 backdrop-blur-sm transition hover:border-cyan-400/50 hover:shadow-lg hover:shadow-cyan-500/10">
                            <img
                                src="/Ackshat_Founder.png"
                                alt="Ackshat Tiwari"
                                className="h-48 w-48 rounded-lg object-cover"
                            />
                            <h2 className="mt-6 text-2xl font-bold text-white">Ackshat Tiwari</h2>
                            <p className="mt-4 text-center text-slate-300 leading-relaxed">
                                Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                                Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </main>
    )
}