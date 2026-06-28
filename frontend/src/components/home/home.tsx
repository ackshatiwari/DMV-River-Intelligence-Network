import Image from "next/image";
import Logo from "@/src/components/logo/logo";

export default function Home() {
    return (
        <main className="flex flex-col min-h-screen">

            {/* Hero */}
            <section className="flex flex-row items-center justify-between gap-12 px-20 py-28 bg-white">
                <div className="max-w-lg">
                    <h1 className="text-7xl font-black leading-tight tracking-tight text-gray-900">
                        Know Your River.
                    </h1>
                    <p className="mt-6 text-xl text-gray-500 leading-relaxed">
                        Open data, student research, and technology — making Northern Virginia's waterways understandable for everyone.
                    </p>
                </div>
                <div className="relative w-[540px] h-[420px] rounded-2xl overflow-hidden shadow-2xl flex-shrink-0">
                    <Image
                        src="/river.png"
                        alt="Goose Creek - A State-Scenic River in Northern Virginia"
                        fill
                        className="object-cover"
                        priority // Resolves the LCP warning (replaces loading="eager")
                        sizes="(max-width: 768px) 100vw, 50vw" // Resolves the sizes warning
                    />
                </div>
            </section>

            {/* Stats */}
            <section className="bg-gray-50 border-t border-gray-200 px-20 py-16">
                <div className="flex gap-20 items-start">
                    <div>
                        <span className="text-8xl font-black text-blue-600">1</span>
                        <p className="mt-2 text-lg font-semibold text-gray-800">Active Chapter</p>
                    </div>
                    <div className="border-l border-gray-300 pl-20">
                        <span className="text-8xl font-black text-blue-600">4</span>
                        <p className="mt-2 text-lg font-semibold text-gray-800">Specialized Teams</p>
                        <p className="text-gray-500">Data · Software · Research · Outreach</p>
                    </div>
                </div>
            </section>

            {/* Mission */}
            <section className="bg-white px-20 py-20">
                <h2 className="text-4xl font-bold text-gray-900 mb-6">Our Mission</h2>
                <p className="text-xl text-gray-600 max-w-3xl leading-relaxed">
                    The DMV River Intelligence Network is a student-led nonprofit dedicated to making
                    Northern Virginia's rivers more understandable through open data, technology, and
                    environmental research. We bring together publicly available environmental information
                    into one accessible platform — helping students, communities, and local organizations
                    better understand the health of their local waterways through clear analysis,
                    interactive dashboards, and educational resources.
                </p>
            </section>

            {/* Pre-footer logo */}
            <section className="bg-gray-100 border-t border-gray-200 px-20 py-12">
                <Logo />
            </section>

            {/* Footer */}
            <footer className="bg-black px-20 py-8">
                <div className="flex gap-8 mb-4">
                    <p className="text-gray-500 text-sm">
                        © {new Date().getFullYear()} DMV River Intelligence Network. All rights reserved.
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                        <a href="mailto:dmv.rivernetwork@gmail.com" className="hover:underline">
                            Contact us
                        </a>
                    </p>
                </div>

            </footer>

        </main>
    );
}
