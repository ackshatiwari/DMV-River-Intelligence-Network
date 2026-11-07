import Link from "next/link";

type FooterProps = {
    /**
     * Background of the footer, so it can alternate with whatever section sits
     * above it. Defaults to the page background used on most pages.
     */
    tone?: "page" | "panel";
};

export default function Footer({ tone = "page" }: FooterProps) {
    const background = tone === "panel" ? "bg-panel" : "bg-page";

    return (

        <footer className={`border-t border-line ${background} px-6 py-8 sm:px-10 lg:px-12`}>
                <div className="mx-auto flex max-w-[1600px] flex-col gap-3 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between">
                    <p>© {new Date().getFullYear()} DMV River Intelligence Network. All rights reserved.</p>
                    <Link href="mailto:dmv.rivernetwork@gmail.com" className="transition hover:text-ink">
                        Contact us
                    </Link>
                </div>
            </footer>
    )

}
