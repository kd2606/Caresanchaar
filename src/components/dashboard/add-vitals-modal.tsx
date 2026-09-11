"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Activity, Zap, ShieldCheck, Thermometer } from "lucide-react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/firebase/clientApp";
import { useFirebaseContext } from "@/firebase/provider";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

export function AddVitalsModal() {
    const { user } = useFirebaseContext();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form states - Clinical Terminology
    const [pulseFrequency, setPulseFrequency] = useState("72");
    const [autonomicResponse, setAutonomicResponse] = useState("30"); // Replaces Stress
    const [biometricIndex, setBiometricIndex] = useState("78"); // Replaces Holistic

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        try {
            const vitalsRef = doc(db, "users", user.uid, "vitals", "latest");
            await setDoc(vitalsRef, {
                pulseFrequency: parseInt(pulseFrequency),
                autonomicResponse: parseInt(autonomicResponse),
                biometricIndex: parseInt(biometricIndex),
                heartRate: parseInt(pulseFrequency), // Keep for backward compatibility if needed
                updatedAt: new Date().toISOString()
            });

            toast.success("Health Status Saved", {
                description: "Your vitals have been successfully updated."
            });
            setOpen(false);
        } catch (error: any) {
            toast.error("Synchronization Failure: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="h-12 px-6 border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white rounded-2xl transition-all font-space uppercase tracking-widest text-[10px] font-bold">
                    <Plus className="w-4 h-4 mr-2 text-emerald-400" />
                    Add Health Vitals
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[450px] bg-[#0a0a0a] border border-white/5 shadow-[0_0_100px_rgba(0,0,0,1)] rounded-[3rem] p-10 font-space overflow-hidden">
                {/* Premium Ambient Flare */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[100px] pointer-events-none" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 blur-[80px] pointer-events-none" />

                <DialogHeader className="relative z-10 text-left mb-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 rounded-2xl bg-white/5 border border-white/10">
                            <Activity className="w-6 h-6 text-emerald-400" />
                        </div>
                        <Badge variant="outline" className="border-emerald-500/20 text-emerald-400/60 font-bold text-[8px] tracking-[0.2em] px-3 py-0.5">MANUAL ENTRY</Badge>
                    </div>
                    <DialogTitle className="text-3xl font-bold tracking-tighter text-white">Record Vitals</DialogTitle>
                    <DialogDescription className="text-white/30 font-inter font-light text-sm mt-3 leading-relaxed">
                        Add your current health measures (like heart rate and stress level) to keep track of your wellbeing.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <Label htmlFor="pulse" className="text-[10px] font-bold text-white/40 uppercase tracking-widest">Heart Rate (BPM)</Label>
                                <span className="text-[10px] font-mono text-emerald-400/40">NORMAL: 60-100</span>
                            </div>
                            <div className="relative">
                                <Input
                                    id="pulse"
                                    type="number"
                                    min="30"
                                    max="200"
                                    className="h-16 bg-white/[0.03] border-white/10 rounded-2xl text-white font-space text-lg px-6 focus:ring-emerald-500/20 focus:border-emerald-500/40"
                                    value={pulseFrequency}
                                    onChange={(e) => setPulseFrequency(e.target.value)}
                                    required
                                />
                                <Thermometer className="absolute right-6 top-5 w-5 h-5 text-white/10" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="autonomic" className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Stress Level (0-100%)</Label>
                            <Input
                                id="autonomic"
                                type="number"
                                min="0"
                                max="100"
                                className="h-16 bg-white/[0.03] border-white/10 rounded-2xl text-white font-space text-lg px-6 focus:ring-indigo-500/20 focus:border-indigo-500/40"
                                value={autonomicResponse}
                                onChange={(e) => setAutonomicResponse(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-3">
                            <Label htmlFor="biometric" className="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1">Overall Health Score</Label>
                            <Input
                                id="biometric"
                                type="number"
                                min="0"
                                max="100"
                                className="h-16 bg-white/[0.03] border-white/10 rounded-2xl text-white font-space text-lg px-6"
                                value={biometricIndex}
                                onChange={(e) => setBiometricIndex(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full h-16 mt-4 rounded-2xl bg-[#0B1120] text-black hover:bg-emerald-400 font-bold text-base transition-all shadow-[0_20px_50px_rgba(255,255,255,0.05)] uppercase tracking-widest font-space"
                    >
                        {loading ? (
                            <span className="flex items-center gap-3">
                                <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                Saving...
                            </span>
                        ) : (
                            <span className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5" />
                                Save Vitals
                            </span>
                        )}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function Badge({ children, variant, className }: { children: React.ReactNode, variant?: string, className?: string }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`}>
            {children}
        </span>
    );
}
