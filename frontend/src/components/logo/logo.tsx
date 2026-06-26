// render the image of logo.svg
import Image from "next/image";

export default function Logo() {
    return (
        <>
            <div className="flex items-center space-x-4">
                <Image src="/logo.svg" alt="Logo" width={100} height={100} />
                <h2 className="ml-4 font-bold text-2xl">DMV River Intelligence Network</h2>
            </div>
        </>
    );
}