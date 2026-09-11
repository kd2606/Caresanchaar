import Image from "next/image";

interface CareSanchaarLogoProps {
    /** Pixel size of the square logo. Default: 32 */
    size?: number;
    /** Show the wordmark ("CareSanchaar") beside the icon. Default: true */
    showWordmark?: boolean;
    className?: string;
}

export function CareSanchaarLogo({ size = 32, showWordmark = true, className = "" }: CareSanchaarLogoProps) {
    return (
        <div className={`flex items-center gap-2.5 ${className}`}>
            <Image
                src="/caresanchaar-logo.svg"
                alt="CareSanchaar Logo"
                width={size}
                height={size}
                priority
                className="shrink-0"
            />
            {showWordmark && (
                <div className="flex flex-col leading-none">
                    <span className="text-sm font-bold tracking-tight">CareSanchaar</span>
                </div>
            )}
        </div>
    );
}
