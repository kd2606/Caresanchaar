"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { motion } from "framer-motion";

export default function ErrorBoundary({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error("Route Error Boundary caught:", error);
    }, [error]);

    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center p-4">
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-md w-full p-8 text-center space-y-6 bg-white/5 border border-white/10 rounded-2xl shadow-xl"
            >
                <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4">
                    <AlertTriangle className="w-8 h-8" />
                </div>
                
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold tracking-tight">Kuch problem aayi 😕</h2>
                    <p className="text-muted-foreground text-sm">
                        Something went wrong while loading this page.
                    </p>
                </div>

                <Button 
                    onClick={() => reset()} 
                    className="w-full bg-teal-500 hover:bg-teal-400 text-black font-bold h-12"
                >
                    <RefreshCcw className="w-4 h-4 mr-2" />
                    Try Again
                </Button>
            </motion.div>
        </div>
    );
}
