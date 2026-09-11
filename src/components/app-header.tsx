"use client";

import { useTheme } from "next-themes";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Sun, Moon, Globe, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useUser } from "@/firebase/auth/useUser";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const LOCALES = [
    { code: "en", label: "English" },
    { code: "hi", label: "हिन्दी" },
];

export function AppHeader({ locale }: { locale: string }) {
    const { setTheme, theme } = useTheme();
    const t = useTranslations("common");
    const router = useRouter();
    const pathname = usePathname();
    const { user, signOut } = useUser();

    const switchLocale = (newLocale: string) => {
        const segments = pathname.split("/");
        segments[1] = newLocale;
        router.push(segments.join("/"));
    };

    return (
        <header className="sticky top-0 z-50 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <SidebarTrigger />

            <div className="flex-1" />

            {/* Language Switcher */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                        <Globe className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    {LOCALES.map((loc) => (
                        <DropdownMenuItem
                            key={loc.code}
                            onClick={() => switchLocale(loc.code)}
                            className={locale === loc.code ? "bg-accent" : ""}
                        >
                            {loc.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Theme Toggle */}
            <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
            </Button>

            {/* User Menu */}
            {user && (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="rounded-full">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={user.photoURL || undefined} />
                                <AvatarFallback>
                                    {user.displayName?.[0] || user.email?.[0] || "U"}
                                </AvatarFallback>
                            </Avatar>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={signOut}>
                            <LogOut className="mr-2 h-4 w-4" />
                            {t("signOut")}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </header>
    );
}
