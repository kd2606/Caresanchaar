"use client";

import { useState, useEffect } from "react";
import { 
  Shield, 
  Home, 
  Users, 
  ClipboardPlus, 
  Send, 
  FileText, 
  Menu, 
  Bell, 
  RefreshCw,
  LogOut,
  User
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { HeartPulse } from "lucide-react";
import PinGuard from "@/components/auth/PinGuard";
import { OfflineCrypto } from "@/lib/crypto/offline-crypto";
import { signOut } from "firebase/auth";
import { auth } from "@/firebase/clientApp";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useTranslations } from "next-intl";

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const params = useParams();
  const pathname = usePathname();
  const locale = params.locale as string || "en";

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user: any) => {
      if (!user) {
        OfflineCrypto.clearKey();
      }
    });
    return () => unsubscribe();
  }, []);


  const handleLogout = async () => {
    OfflineCrypto.clearKey();
    await signOut(auth);
    router.push(`/${locale}/auth/worker`);
  };

  const t = useTranslations("worker");

  const navItems = [
    { icon: Home, label: t("nav.dashboard"), href: `/${locale}/dashboard/worker` },
    { icon: Users, label: t("nav.assignedFamilies"), href: `/${locale}/dashboard/worker/assigned-families` },
    { icon: ClipboardPlus, label: t("nav.newIntake"), href: `/${locale}/dashboard/worker/intake`, primary: true },
    { icon: Send, label: t("nav.referrals"), href: `/${locale}/dashboard/worker/referrals` },
    { icon: Bell, label: t("nav.inbox"), href: `/${locale}/dashboard/worker/inbox` },
    { icon: FileText, label: t("nav.reports"), href: `/${locale}/dashboard/worker/reports` },
    { icon: User, label: t("nav.myProfile"), href: `/${locale}/dashboard/worker/profile` },
  ];

  return (
    <div className="flex h-screen dashboard-true-black dark bg-background text-foreground overflow-hidden font-sans">
      {/* Mobile Sidebar Overlay */}
      <div 
        className={cn(
          "fixed inset-0 bg-black/60 z-40 md:hidden transition-opacity duration-300 ease-in-out",
          sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setSidebarOpen(false)}
      />

      {/* Sidebar */}
      <aside className={cn(
        "fixed md:static inset-y-0 left-0 z-50 w-[280px] bg-card flex flex-col transition-all duration-300 ease-in-out border-r border-border/50 shadow-xl animate-in fade-in duration-500",
        sidebarOpen ? "translate-x-0 opacity-100" : "-translate-x-full md:translate-x-0 opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto"
      )}>
        {/* Logo Area */}
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <div className="bg-white/5 p-2 rounded-lg">
            <HeartPulse className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">{t("layout.appName")}</h1>
            <p className="text-xs font-medium text-emerald-200/70 uppercase tracking-wider">{t("layout.portalName")}</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {navItems.map((item, i) => {
            const isActive = item.href === `/${locale}/dashboard/worker` 
              ? pathname === item.href 
              : pathname.startsWith(item.href);

            return (
              <Link key={i} href={item.href} onClick={() => setSidebarOpen(false)}>
                <div className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors cursor-pointer text-sm font-medium min-h-[44px]",
                  isActive 
                    ? "bg-[#0D9488] hover:bg-[#0F766E] text-white shadow-sm" 
                    : "text-muted-foreground hover:bg-white/10 hover:text-white"
                )}>
                  <item.icon className={cn("w-5 h-5", isActive ? "text-white" : "text-emerald-500")} />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Section */}
        <div className="p-4 border-t border-white/10 bg-black/20 space-y-4">
          <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <span className="text-sm font-medium text-emerald-400">{t("layout.online")}</span>
              </div>
              <Badge variant="secondary" className="bg-orange-500/20 text-orange-300 hover:bg-orange-500/20 text-xs border-orange-500/30">
                {t("layout.unsynced", { count: 3 })}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#0D9488] flex items-center justify-center text-white font-bold text-sm shadow-inner">
                HW
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-white">{t("layout.healthWorker")}</span>
                <span className="text-[10px] text-emerald-300 uppercase tracking-wider">{t("layout.ashaWorker")}</span>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-white hover:bg-white/10 min-h-[44px] min-w-[44px]" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        {/* Header */}
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-4 lg:px-8 sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              className="md:hidden text-muted-foreground hover:text-white hover:bg-white/10"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-6 h-6" />
            </Button>
            <h2 className="text-lg font-semibold text-white tracking-tight hidden sm:block">
              {(() => {
                const activeItem = navItems.slice().reverse().find(item => 
                  item.href === `/${locale}/dashboard/worker` 
                    ? pathname === item.href 
                    : pathname.startsWith(item.href)
                );
                return activeItem ? activeItem.label : t("nav.dashboard");
              })()}
            </h2>
          </div>
          
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant="outline" size="sm" className="hidden sm:flex border-border bg-secondary hover:bg-secondary/80 text-foreground">
              <RefreshCw className="w-4 h-4 mr-2" />
              {t("layout.syncData")}
            </Button>
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-white hover:bg-white/10">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-border" />
            </Button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto p-4 lg:p-8">
          <div className="max-w-6xl mx-auto">
            <PinGuard>{children}</PinGuard>
          </div>
        </div>
      </main>
    </div>
  );
}
