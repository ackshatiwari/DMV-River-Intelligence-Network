import Locations from "../../../src/components/locations/locations";
import Logo from "@/src/components/logo/logo";
export default function ChapterPage() {

    return (
        <>
            <div className="w-full p-4 flex items-center" id="navbar">
                <Logo />
                <nav className="flex-1 flex justify-evenly ml-8">

                </nav>
            </div>
            <Locations />
        </>
    )
}