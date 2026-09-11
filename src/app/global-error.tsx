"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCcw } from "lucide-react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error("Global Error Boundary caught:", error);
    }, [error]);

    return (
        <html lang="en" className="dark">
            <body className="bg-background text-foreground min-h-screen flex items-center justify-center p-4">
                <div className="max-w-md w-full p-8 text-center space-y-6 bg-white/5 border border-white/10 rounded-2xl shadow-2xl">
                    <div className="mx-auto w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold tracking-tight">Kuch problem aayi 😕</h2>
                        <p className="text-muted-foreground">
                            Please refresh the page or try again later.
                        </p>
                    </div>

                    <Button 
                        onClick={() => window.location.reload()} 
                        className="w-full bg-teal-500 hover:bg-teal-400 text-black font-bold h-12"
                    >
                        <RefreshCcw className="w-4 h-4 mr-2" />
                        Refresh Page
                    </Button>
                </div>
            </body>
        </html>
    );
}
