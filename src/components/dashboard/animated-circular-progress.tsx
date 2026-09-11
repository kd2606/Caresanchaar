"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface AnimatedCircularProgressProps {
    value: number;
    max?: number;
    size?: number;
    strokeWidth?: number;
    color?: string;
    label?: string;
}

export function AnimatedCircularProgress({
    value,
    max = 100,
    size = 140, // Reduced default size for mobile
    strokeWidth = 14,
    color = "stroke-emerald-500",
    label = "Holistic Score",
}: AnimatedCircularProgressProps) {
    const [currentValue, setCurrentValue] = useState(0);
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (currentValue / max) * circumference;

    useEffect(() => {
        const timeout = setTimeout(() => {
            setCurrentValue(value);
        }, 500); // Stagger start
        return () => clearTimeout(timeout);
    }, [value]);

    return (
        <div className="flex flex-col items-center justify-center relative" style={{ width: size, height: size }}>
            {/* Background Circle */}
            <svg width={size} height={size} className="transform -rotate-90">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    className="text-muted/30"
                />
                {/* Foreground Animated Circle */}
                <motion.circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeLinecap="round"
                    className={color}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                    style={{ strokeDasharray: circumference }}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
                <motion.span
                    className="text-4xl font-bold tracking-tight bg-gradient-to-br from-emerald-400 to-indigo-500 bg-clip-text text-transparent"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                >
                    {Math.round(currentValue)}
                </motion.span>
                <span className="text-sm font-medium text-muted-foreground mt-1">{label}</span>
            </div>
        </div>
    );
}
