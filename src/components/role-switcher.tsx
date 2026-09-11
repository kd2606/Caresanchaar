"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Activity, Building2, Settings2, X } from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

export function RoleSwitcher() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  // Show only in non-production environments or if explicitly requested via query param
  const isDev = process.env.NODE_ENV !== "production";
  const isVercelDemo = typeof window !== "undefined" && window.location.hostname.includes("vercel.app");
  const hasDemoParam = typeof window !== "undefined" && window.location.search.includes("demo=true");
  
  const isDemoMode = isDev || isVercelDemo || hasDemoParam;

  if (!isDemoMode) return null;

  // Extract locale from pathname if possible, default to 'en'
  const parts = pathname?.split('/') || [];
  const locale = (parts.length > 1 && parts[1].length === 2) ? parts[1] : 'en';

  const roles = [
    { label: "ASHA Worker (B2B)", path: `/${locale}/dashboard/worker`, icon: Activity, color: "text-emerald-400" },
    { label: "DHO District", path: `/${locale}/dashboard/district`, icon: Building2, color: "text-amber-400" },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-[9999]">
      {isOpen ? (
        <div className="bg-slate-900 border border-slate-700 shadow-2xl rounded-xl p-3 w-56 flex flex-col gap-2 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div className="flex items-center justify-between px-1 pb-1 mb-1 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Settings2 className="w-3 h-3" />
              Demo Switcher
            </span>
            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          {roles.map((role) => {
            const isActive = pathname === role.path || (pathname?.startsWith(role.path) && role.path !== `/${locale}/dashboard`);
            return (
              <Link
                key={role.path}
                href={role.path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all",
                  isActive 
                    ? "bg-slate-800 text-white font-medium shadow-inner" 
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                )}
              >
                <role.icon className={cn("w-4 h-4", isActive ? role.color : "opacity-70")} />
                {role.label}
              </Link>
            );
          })}
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="h-10 w-10 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 active:scale-95 border-2 border-indigo-400/30"
          title="Demo Role Switcher"
        >
          <Settings2 className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
