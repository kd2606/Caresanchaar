"use client";

import { motion, Variants } from "framer-motion";
import { ReactNode } from "react";

interface FadeInProps {
    children: ReactNode;
    delay?: number;
    direction?: "up" | "down" | "left" | "right" | "none";
    className?: string;
}

export function FadeIn({ children, delay = 0, direction = "up", className }: FadeInProps) {
    const directions = {
        up: { y: 20, x: 0 },
        down: { y: -20, x: 0 },
        left: { x: 20, y: 0 },
        right: { x: -20, y: 0 },
        none: { x: 0, y: 0 },
    };

    return (
        <motion.div
            initial={{ opacity: 0, ...directions[direction] }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={{
                duration: 0.5,
                delay: delay,
                ease: [0.25, 0.25, 0, 1], // Custom easing for a polished feel
            }}
            className={className}
        >
            {children}
        </motion.div>
    );
}

export function StaggerContainer({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
    const container: Variants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                delayChildren: delay,
                staggerChildren: 0.1,
            },
        },
    };

    return (
        <motion.div variants={container} initial="hidden" animate="show" className={className}>
            {children}
        </motion.div>
    );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
    const item: Variants = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
    };

    return (
        <motion.div variants={item} className={className}>
            {children}
        </motion.div>
    );
}
