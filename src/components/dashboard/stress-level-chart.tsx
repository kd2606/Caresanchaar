"use client";

import { useEffect, useState } from "react";
import { AnimatedCircularProgress } from "./animated-circular-progress";

export function StressLevelChart({ stressLevel = 30 }: { stressLevel?: number }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return <div className="h-[200px] w-full animate-pulse bg-muted/50 rounded-xl mt-4" />;

    const strokeColorClass = stressLevel > 70 ? "stroke-red-500" : stressLevel > 40 ? "stroke-amber-500" : "stroke-emerald-500";
    const textLabel = stressLevel > 70 ? "High Stress" : stressLevel > 40 ? "Mod Stress" : "Low Stress";

    return (
        <div className="h-[200px] w-full mt-4 flex items-center justify-center relative">
            <AnimatedCircularProgress
                value={stressLevel}
                max={100}
                size={140}
                strokeWidth={14}
                color={strokeColorClass}
                label={textLabel}
            />
        </div>
    );
}
