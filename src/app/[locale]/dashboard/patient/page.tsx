"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { 
    User, Settings, Plus, Activity, Brain, HeartPulse, Hospital, 
    FileText, ChevronRight, LogOut, Smartphone, X, LayoutDashboard, 
    ShieldCheck, Database, Zap, Bell, Menu
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/firebase/auth/useUser";
import { useRouter, useParams } from "next/navigation";
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    onSnapshot,
    doc,
    getDoc
} from "firebase/firestore";
import { db, auth } from "@/firebase/clientApp";
import { AddVitalsModal } from "@/components/dashboard/add-vitals-modal";
import { RuralHospitalList, MedicinePriceCard, FamilyCardsList, GovSchemesCard, VoiceAssistantButton } from "@/components/dashboard/rural-features";
import { ExpandableCard } from "@/components/dashboard/expandable-card";
import { UserProfileModal } from "@/components/dashboard/user-profile";
import Link from "next/link";
import { signOut } from "firebase/auth";

export default function DashboardPage() {
    const { user, loading } = useUser();
    const router = useRouter();
    const params = useParams();
    const locale = params.locale as string;
    const [scrolled, setScrolled] = useState(false);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    
    const t = useTranslations("dashboard");
    const tNav = useTranslations("nav");
    
    const [vitals, setVitals] = useState<any>(null);
    const [vitalsHistory, setVitalsHistory] = useState<any[]>([]);

    useEffect(() => {
        if (!loading && !user) {
            router.push(`/${locale}/auth/patient`);
        }
    }, [user, loading, router, locale]);

    useEffect(() => {
        const handleScroll = () => setScrolled(window.scrollY > 20);
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    // Real-time Vitals Subscription
    useEffect(() => {
        if (!user) return;

        const vitalsQuery = query(
            collection(db, "users", user.uid, "vitals"),
            orderBy("updatedAt", "desc"),
            limit(10)
        );

        const unsubscribe = onSnapshot(vitalsQuery, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            if (data.length > 0) {
                setVitals(data[0]);
                setVitalsHistory(data);
            }
        });

        return () => unsubscribe();
    }, [user]);

    const handleLogout = async () => {
        await signOut(auth);
        router.push(`/${locale}/auth/patient`);
    };

    if (loading || !user) {
        return (
            <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#0B1120] flex items-center justify-center">
                <div className="relative">
                    <div className="h-24 w-24 rounded-full border-t-2 border-[#0D9488] dark:border-[#14B8A6] animate-spin" />
                    <HeartPulse className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 text-[#0D9488] dark:text-[#14B8A6] animate-pulse" />
                </div>
            </div>
        );
    }

    const navItems = [
        { icon: LayoutDashboard, label: tNav("home"), active: true, path: `/${locale}/dashboard` },
        { icon: Activity, label: tNav("symptomChecker"), path: `/${locale}/symptom-checker` },
        { icon: ShieldCheck, label: tNav("govtSchemes"), path: `/${locale}/govt-schemes` },
        { icon: Database, label: tNav("healthRecords"), path: `/${locale}/health-records` },
        { icon: Zap, label: tNav("trends"), path: `/${locale}/health-trends` },
    ];

    return (
        <div className="min-h-screen bg-[#FAFAF9] dark:bg-[#0B1120] text-muted-foreground dark:text-muted-foreground font-sans flex overflow-hidden">
            
            {/* Sidebar Navigation */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-24 bg-[#0B1120] dark:bg-[#0B1120]/80 backdrop-blur-3xl border-r border-border dark:border-border 
                flex flex-col items-center py-10 transition-transform duration-500 ease-in-out
                md:relative md:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="mb-12">
                    <Link href={`/${locale}/dashboard`}>
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-indigo-600 flex items-center justify-center emerald-glow group cursor-pointer transition-transform duration-500 hover:rotate-12">
                            <HeartPulse className="w-6 h-6 text-white" />
                        </div>
                    </Link>
                </div>
                
                <nav className="flex flex-col gap-8 flex-1">
                    {navItems.map((item, index) => (
                        <Link key={index} href={item.path || "#"} className="group relative" onClick={() => setIsSidebarOpen(false)}>
                            <item.icon className={`w-6 h-6 transition-all duration-300 ${item.active ? 'text-[#0D9488] dark:text-[#14B8A6]' : 'text-muted-foreground dark:text-muted-foreground group-hover:text-muted-foreground dark:group-hover:text-muted-foreground'}`} />
                            {item.active && <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-1 h-6 bg-[#0D9488] dark:bg-[#14B8A6] rounded-r-full shadow-[0_0_15px_rgba(13,148,136,0.5)] dark:shadow-[0_0_15px_rgba(20,184,166,0.5)]" />}
                            <span className="absolute left-16 top-1/2 -translate-y-1/2 bg-[#0B1120] dark:bg-secondary text-muted-foreground dark:text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none uppercase tracking-tighter z-50 shadow-xl border border-border dark:border-border">
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </nav>

                <div className="flex flex-col gap-6 pt-8 border-t border-border dark:border-border w-full items-center">
                    <UserProfileModal>
                        <Settings className="w-6 h-6 text-muted-foreground hover:text-muted-foreground dark:text-muted-foreground dark:hover:text-muted-foreground cursor-pointer transition-colors" />
                    </UserProfileModal>
                    <UserProfileModal>
                        <button className="h-10 w-10 rounded-full border border-border dark:border-border overflow-hidden hover:border-[#0D9488]/50 dark:hover:border-[#14B8A6]/50 transition-all">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt="P" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full bg-secondary dark:bg-secondary flex items-center justify-center text-[10px] font-bold text-muted-foreground dark:text-muted-foreground">U</div>
                            )}
                        </button>
                    </UserProfileModal>
                    <button onClick={handleLogout} className="p-2 text-muted-foreground dark:text-muted-foreground hover:text-red-500 transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </aside>

            {/* Mobile Overlay */}
            <AnimatePresence>
                {isSidebarOpen && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSidebarOpen(false)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
                    />
                )}
            </AnimatePresence>

            {/* Main Content Area */}
            <main className="flex-1 h-screen overflow-y-auto relative scrollbar-hide">
                <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-12">
                    
                    {/* Top Command Bar */}
                    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-12">
                        <div className="flex items-center gap-6">
                            <button 
                                onClick={() => setIsSidebarOpen(true)}
                                className="p-3 bg-[#0B1120] dark:bg-secondary border border-border dark:border-border rounded-xl md:hidden hover:bg-slate-50 dark:hover:bg-secondary/80 transition-all"
                            >
                                <Menu className="w-5 h-5" />
                            </button>
                            <div className="space-y-1">
                                <p className="text-[10px] text-[#0D9488]/80 dark:text-[#14B8A6]/80 font-sans font-bold tracking-[0.3em] uppercase">
                                    {t("welcome")}
                                </p>
                                <h1 className="text-4xl font-heading font-bold tracking-tighter text-[#0F172A] dark:text-[#F8FAFC]">
                                    {t("health")} <span className="text-muted-foreground dark:text-muted-foreground">{t("dashboardSpan")}</span>
                                </h1>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                            <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B1120] dark:bg-secondary border border-border dark:border-border">
                                <div className="h-2 w-2 rounded-full bg-[#0D9488] dark:bg-[#14B8A6] animate-pulse" />
                                <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground dark:text-muted-foreground">{t("systemOnline")}</span>
                            </div>
                            <AddVitalsModal />
                            <VoiceAssistantButton />
                        </div>
                    </header>

                    {/* Layout Grid */}
                    <div className="grid grid-cols-12 gap-8">
                        
                        {/* Hero Section: AI Diagnostic Vector */}
                        <section className="col-span-12 group relative rounded-[24px] border border-border dark:border-border bg-[#0B1120] dark:bg-[#1E293B] p-12 overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none">
                            
                            <div className="relative z-10 grid lg:grid-cols-2 gap-16 items-center">
                                <div className="space-y-10">
                                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#0D9488]/10 dark:bg-[#14B8A6]/10 border border-[#0D9488]/20 dark:border-[#14B8A6]/20">
                                        <div className="h-1.5 w-1.5 rounded-full bg-[#0D9488] dark:bg-[#14B8A6] animate-pulse" />
                                        <span className="text-[10px] font-bold text-[#0D9488] dark:text-[#14B8A6] uppercase tracking-[0.2em]">{t("aiHelperReady")}</span>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <h2 className="text-5xl md:text-6xl font-heading font-bold tracking-tight leading-tight text-muted-foreground dark:text-white">
                                            {t("quick")} <br/> 
                                            <span className="text-[#0D9488] dark:text-[#14B8A6]">{t("healthCheck")}</span>
                                        </h2>
                                        <p className="text-xl text-muted-foreground dark:text-muted-foreground font-medium leading-relaxed max-w-lg">
                                            {t("heroDesc")}
                                        </p>
                                    </div>

                                    <div className="flex flex-wrap items-center gap-6 pt-4">
                                        <Link href={`/${locale}/skin-scan`}>
                                            <button className="h-16 px-10 rounded-[16px] bg-[#0D9488] text-white dark:bg-[#14B8A6] dark:text-muted-foreground font-bold flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-[#0D9488]/20 dark:shadow-[#14B8A6]/20 group">
                                                {t("startScan")}
                                                <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                            </button>
                                        </Link>
                                        <div className="flex items-center gap-4 px-6 h-16 rounded-[16px] border border-border dark:border-border bg-white/50 dark:bg-[#1E293B]/50 backdrop-blur-xl">
                                            <div className="flex -space-x-3">
                                                {[1, 2, 3].map(i => (
                                                    <div key={i} className="h-8 w-8 rounded-full border-2 border-[#FAFAF9] dark:border-[#0B1120] bg-secondary dark:bg-secondary flex items-center justify-center text-[8px] font-bold">U{i}</div>
                                                ))}
                                            </div>
                                            <span className="text-xs font-bold text-muted-foreground dark:text-muted-foreground uppercase tracking-widest">{t("connectDoctors")}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="hidden lg:flex items-center justify-center relative">
                                    <div className="relative w-72 h-72 rounded-full bg-[#0D9488]/5 dark:bg-[#14B8A6]/5 flex items-center justify-center">
                                        <div className="absolute inset-0 rounded-full border border-[#0D9488]/10 dark:border-[#14B8A6]/10 animate-[spin_15s_linear_infinite]"></div>
                                        <div className="absolute inset-8 rounded-full border border-dashed border-[#0D9488]/20 dark:border-[#14B8A6]/20 animate-[spin_25s_linear_reverse_infinite]"></div>
                                        <div className="w-32 h-32 rounded-full bg-[#0B1120] dark:bg-[#1E293B] shadow-[0_0_40px_rgba(13,148,136,0.15)] dark:shadow-[0_0_40px_rgba(20,184,166,0.1)] flex items-center justify-center relative z-10 transition-transform duration-700 hover:scale-110">
                                            <Activity className="w-14 h-14 text-[#0D9488] dark:text-[#14B8A6]" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </section>



                        {/* Feature Components */}
                        <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
                            <div className="xl:col-span-1"><ExpandableCard><MedicinePriceCard /></ExpandableCard></div>
                            <div className="xl:col-span-1"><ExpandableCard><FamilyCardsList /></ExpandableCard></div>
                            <div className="xl:col-span-1"><ExpandableCard><GovSchemesCard /></ExpandableCard></div>
                            <div className="xl:col-span-1"><ExpandableCard><RuralHospitalList /></ExpandableCard></div>
                        </div>

                    </div>
                    
                    {/* Footer System Status */}
                    <footer className="mt-24 pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 opacity-30">
                        <div className="flex items-center gap-6">
                            <span className="text-[10px] font-bold uppercase tracking-[0.3em]">{t("version")}</span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.3em]">{t("locationActive")}</span>
                        </div>
                        <p className="text-[10px] font-bold">{t("copyright")}</p>
                    </footer>

                </div>
            </main>
        </div>
    );
}
