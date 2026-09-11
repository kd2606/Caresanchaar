"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import { getOfflineSkinScans } from "@/lib/offlineSkinScans";
import { CareSanchaarLogo } from "@/components/caresanchaar-logo";
import {
    LayoutDashboard,
    Eye,
    Mic,
    Scan,
    Brain,
    TrendingUp,
    Users,
    Stethoscope,
    Landmark,
    BellRing,
    ClipboardList,
    Lock,
    ShieldCheck,
    Info,
    Smartphone,
    HelpCircle,
    HeartPulse
} from "lucide-react";
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useIsDemo } from "@/hooks/useIsDemo";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

/* Features demo users cannot fully use — clicking will still navigate but the page should handle it */
const DEMO_LOCKED = new Set(["/health-records", "/people"]);

const APK_URL = "https://expo.dev/artifacts/eas/a4cyVYKBAo1t1yKs552SYf4.apk";

export function AppSidebar({ locale }: { locale: string }) {
    const t = useTranslations("nav");
    const pathname = usePathname();
    const isDemo = useIsDemo();
    const router = useRouter();
    const [pendingSyncs, setPendingSyncs] = useState(0);

    useEffect(() => {
        const checkSyncs = async () => {
            try {
                const scans = await getOfflineSkinScans();
                setPendingSyncs(scans.length);
            } catch(e) {}
        };
        checkSyncs();
        // Setup an interval to re-check
        const intv = setInterval(checkSyncs, 5000);
        return () => clearInterval(intv);
    }, []);

    const navItems = [
        { title: t("dashboard"), url: `/${locale}/dashboard`, icon: LayoutDashboard },
        { title: t("symptomChecker"), url: `/${locale}/symptom-checker`, icon: Stethoscope },
        { title: t("visionScan"), url: `/${locale}/vision-scan`, icon: Eye },
        { title: t("coughAnalysis"), url: `/${locale}/cough-analysis`, icon: Mic },
        { title: t("skinScan"), url: `/${locale}/skin-scan`, icon: Scan },
        { title: t("mentalHealth"), url: `/${locale}/mental-health-screen`, icon: Brain },
        { title: t("cardioCheck"), url: `/${locale}/cardio-check`, icon: HeartPulse },
        { title: t("trends"), url: `/${locale}/health-trends`, icon: TrendingUp },
        { title: "Health Records", url: `/${locale}/health-records`, icon: ClipboardList },
        { title: "Govt Schemes", url: `/${locale}/govt-schemes`, icon: Landmark },
        { title: "Reminders", url: `/${locale}/reminders`, icon: BellRing },
        { title: t("nearbyHospitals"), url: `/${locale}/nearby-hospitals`, icon: Stethoscope },
        { title: t("people"), url: `/${locale}/people`, icon: Users },
        { title: "Privacy Policy", url: `/${locale}/privacy-policy`, icon: ShieldCheck },
        { title: "About", url: `/${locale}/about`, icon: Info },
    ];

    return (
        <TooltipProvider delayDuration={200}>
            <Sidebar className="!bg-[#0B1120] dark:!bg-[#0B1120] !border-r !border-slate-200 dark:!border-slate-800 animate-in fade-in duration-500 ease-in-out transition-all duration-300 data-[state=closed]:opacity-0 data-[state=open]:opacity-100">
                <SidebarHeader className="border-b border-slate-200 dark:border-slate-800 p-4">
                    <Link href={`/${locale}/dashboard`}>
                        <CareSanchaarLogo size={40} />
                    </Link>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {navItems.map((item) => {
                                    const routeSuffix = item.url.replace(`/${locale}`, "");
                                    const locked = isDemo && DEMO_LOCKED.has(routeSuffix);

                                    const inner = (
                                        <SidebarMenuButton
                                            asChild={!locked}
                                            isActive={pathname === item.url}
                                            className={`rounded-lg transition-all ${locked ? "opacity-60 cursor-pointer" : ""} ${pathname === item.url ? "!bg-teal-50 !text-[#0D9488] font-bold dark:!bg-teal-900/20 dark:!text-[#14B8A6] hover:!bg-teal-50 hover:!text-[#0D9488]" : "text-slate-500 hover:text-slate-800 hover:bg-slate-50 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-800"}`}
                                            onClick={
                                                locked
                                                    ? (e) => {
                                                        e.preventDefault();
                                                        router.push(`/${locale}/signup`);
                                                    }
                                                    : undefined
                                            }
                                        >
                                            {locked ? (
                                                <div className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md">
                                                    <item.icon className="h-4 w-4 shrink-0" />
                                                    <span className="flex-1 truncate">{item.title}</span>
                                                    <Lock className="h-3 w-3 text-yellow-500 shrink-0" />
                                                </div>
                                            ) : (
                                                <Link href={item.url}>
                                                    <item.icon className="h-4 w-4" />
                                                    <span>{item.title}</span>
                                                </Link>
                                            )}
                                        </SidebarMenuButton>
                                    );

                                    return (
                                        <SidebarMenuItem key={item.title}>
                                            {locked ? (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <div className="w-full">{inner}</div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right">
                                                        <p>Sign up to unlock</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            ) : inner}
                                        </SidebarMenuItem>
                                    );
                                })}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>

                    {/* Sync Status Indicator */}
                    <div className="mt-auto p-4 pb-2">
                        {pendingSyncs > 0 && (
                            <div className="mb-2 w-full text-center bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold rounded-lg py-2 px-3 animate-pulse">
                                ⏳ Pending Sync: {pendingSyncs}
                            </div>
                        )}
                    {isDemo && (
                        <Link
                            href={`/${locale}/signup`}
                            className="block w-full text-center bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs font-semibold rounded-lg py-2 px-3 hover:bg-yellow-500/20 transition-colors"
                        >
                            🔓 Sign up to save data
                        </Link>
                    )}
                    </div>
                    
                </SidebarContent>
            </Sidebar>
        </TooltipProvider>
    );
}
