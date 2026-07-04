import Link from "next/link";

export default function Footer() {
    return (

        <footer className="border-t border-white/10 bg-slate-950 px-6 py-8 sm:px-10 lg:px-12">
                <div className="mx-auto flex max-w-7xl flex-col gap-3 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                    <p>© {new Date().getFullYear()} DMV River Intelligence Network. All rights reserved.</p>
                    <Link href="mailto:dmv.rivernetwork@gmail.com" className="transition hover:text-white">
                        Contact us
                    </Link>
                </div>
            </footer>
    )

}