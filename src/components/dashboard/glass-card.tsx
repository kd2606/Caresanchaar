"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLMotionProps<"div"> {
    className?: string;
    children: React.ReactNode;
    hoverEffect?: boolean;
}

export function GlassCard({ className, children, hoverEffect = true, ...props }: GlassCardProps) {
    return (
        <motion.div
            className={cn(
                "relative overflow-hidden rounded-[24px] border border-slate-200 dark:border-slate-700 bg-[#0B1120] dark:bg-[#1E293B] p-8 shadow-sm dark:shadow-none transition-all duration-500",
                hoverEffect && "hover:border-[#0D9488]/30 dark:hover:border-[#14B8A6]/30 hover:shadow-md dark:hover:bg-[#1E293B]/80",
                className
            )}
            whileHover={hoverEffect ? { y: -5, scale: 1.005 } : undefined}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            {...props}
        >
            {/* Specular Ghost Highlight (15% opacity fallback border) */}
            <div className="absolute inset-0 border border-white/50 dark:border-white/[0.03] rounded-[24px] pointer-events-none" />
            
            {/* Atmospheric Depth Layer */}
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/[0.03] blur-[100px] pointer-events-none" />

            <div className="relative z-10 h-full">{children}</div>
        </motion.div>
    );
}
