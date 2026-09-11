"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { motion, AnimatePresence, Variants } from "framer-motion";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/firebase/clientApp";
import { useUser } from "@/firebase/auth/useUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowRight, ArrowLeft, CheckCircle2, ChevronRight, Activity, Scan, MessageSquare, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";

const CONDITIONS = [
    "Diabetes", "Blood Pressure", "Asthma", "Heart Condition", "Thyroid", "None of these"
];

const STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", 
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", 
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", 
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir"
];

export default function OnboardingPage() {
    const router = useRouter();
    const params = useParams();
    const locale = params.locale as string;
    const { user, loading: authLoading } = useUser();
    
    const [step, setStep] = useState(1);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form State
    const [name, setName] = useState("");
    const [age, setAge] = useState("");
    const [gender, setGender] = useState("");
    const [state, setState] = useState("");
    const [conditions, setConditions] = useState<string[]>([]);
    const [smokes, setSmokes] = useState(false);
    const [exercises, setExercises] = useState(false);

    // Initial load checks
    useEffect(() => {
        if (!authLoading && !user) {
            router.replace(`/${locale}/auth/patient`);
        } else if (user) {
            // Already filled out?
            getDoc(doc(db, "users", user.uid, "profile", "data")).then((docSnap) => {
                if (docSnap.exists() && docSnap.data().onboardingDone) {
                    router.replace(`/${locale}/dashboard`);
                }
            });
        }
    }, [user, authLoading, router, locale]);

    const handleNext = () => setStep((s) => Math.min(s + 1, 4));
    const handleBack = () => setStep((s) => Math.max(s - 1, 1));

    const toggleCondition = (cond: string) => {
        if (cond === "None of these") {
            setConditions(["None of these"]);
            return;
        }
        setConditions(prev => {
            const next = prev.filter(c => c !== "None of these");
            if (next.includes(cond)) return next.filter(c => c !== cond);
            return [...next, cond];
        });
    };

    const handleFinish = async () => {
        if (!user) return;
        setIsSaving(true);
        try {
            await setDoc(doc(db, "users", user.uid, "profile", "data"), {
                name: name || user.displayName || "User",
                age: age ? parseInt(age) : null,
                gender: gender || null,
                state: state || null,
                healthConditions: conditions,
                smokes,
                exercises,
                onboardingDone: true,
                onboardingCompletedAt: serverTimestamp()
            }, { merge: true });
            
            setStep(4);
        } catch (error) {
            console.error(error);
            toast.error("Something went wrong saving your profile.");
        } finally {
            setIsSaving(false);
        }
    };

    if (authLoading || (!user && step !== 4)) {
        return (
            <div className="min-h-screen bg-[#0A0F1A] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
            </div>
        );
    }

    // Variants for sliding
    const variants: Variants = {
        initial: (direction: number) => ({
            x: direction > 0 ? 50 : -50,
            opacity: 0,
        }),
        animate: {
            x: 0,
            opacity: 1,
            transition: { duration: 0.3, ease: "easeOut" }
        },
        exit: (direction: number) => ({
            x: direction < 0 ? 50 : -50,
            opacity: 0,
            transition: { duration: 0.2, ease: "easeIn" }
        })
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col relative overflow-hidden font-space">
            {/* Premium Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-indigo-500/10 blur-[130px] rounded-full" />
                <div className="absolute bottom-[-15%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/10 blur-[130px] rounded-full" />
            </div>

            {/* Top Bar / Progress */}
            {step < 4 && (
                <div className="h-20 flex items-center px-6 md:px-12 z-10">
                    <div className="flex-1 flex justify-center items-center gap-3">
                        {[1, 2, 3].map((s) => (
                            <div 
                                key={s} 
                                className={`h-1.5 rounded-full transition-all duration-500 ${s <= step ? 'bg-indigo-500 w-16 md:w-24 shadow-[0_0_20px_rgba(99,102,241,0.5)]' : 'bg-white/5 w-8 md:w-12'}`}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex items-center justify-center p-6 z-10">
                <AnimatePresence mode="wait" custom={1}>
                    {step === 1 && (
                        <motion.div 
                            key="step1" 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="w-full max-w-xl space-y-10 text-center"
                        >
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full" />
                                <div className="text-7xl md:text-8xl relative z-10">🛡️</div>
                            </div>
                            
                            <div className="space-y-4">
                                <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white font-space">
                                    Initialize <span className="text-indigo-400">Clinical Identity</span>
                                </h1>
                                <p className="text-xl text-white/40 max-w-md mx-auto leading-relaxed">
                                    Set up your advanced medical dashboard with AI-driven diagnostics.
                                </p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
                                {[
                                    { text: "Encrypted Protocol", sub: "AES-256 Security" },
                                    { text: "AI Diagnostic Engine", sub: "98% Accuracy" },
                                    { text: "Multi-Lingual", sub: "Hindi & English" }
                                ].map((item, i) => (
                                    <div key={i} className="bg-white/[0.03] border border-white/10 p-5 rounded-3xl backdrop-blur-md">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-3" />
                                        <div className="text-sm font-bold text-white">{item.text}</div>
                                        <div className="text-[10px] text-white/30 uppercase tracking-widest mt-1 font-bold">{item.sub}</div>
                                    </div>
                                ))}
                            </div>

                            <div className="pt-6 space-y-6">
                                <Button onClick={handleNext} className="w-full max-w-sm h-16 text-lg bg-[#0B1120] text-black hover:bg-indigo-50 rounded-2xl font-bold shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98]">
                                    Begin Onboarding <ArrowRight className="ml-2 w-5 h-5" />
                                </Button>
                                <p className="text-xs text-white/20 font-bold tracking-[0.2em] uppercase">Security Clearance Level 1</p>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div 
                            key="step2" 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="w-full max-w-md space-y-8"
                        >
                            <div className="space-y-2 text-center md:text-left">
                                <h2 className="text-3xl font-bold tracking-tight text-white">Identity Particulars</h2>
                                <p className="text-white/40">Provide essential data for clinical personalization.</p>
                            </div>

                            <div className="space-y-6 bg-white/[0.03] border border-white/10 p-8 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full -mr-16 -mt-16" />
                                
                                <div className="space-y-2">
                                    <Label className="text-white/60 text-xs font-bold uppercase tracking-widest ml-1">Assigned Name</Label>
                                    <Input 
                                        placeholder="Dr. Ramesh Kumar" 
                                        value={name} 
                                        onChange={(e) => setName(e.target.value)} 
                                        className="h-14 bg-white/5 border-white/10 rounded-2xl text-white focus:border-indigo-500/50 transition-all" 
                                    />
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-white/60 text-xs font-bold uppercase tracking-widest ml-1">Age</Label>
                                        <Input 
                                            type="number" 
                                            placeholder="25" 
                                            value={age} 
                                            onChange={(e) => setAge(e.target.value)} 
                                            className="h-14 bg-white/5 border-white/10 rounded-2xl text-white focus:border-indigo-500/50 transition-all" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-white/60 text-xs font-bold uppercase tracking-widest ml-1">Gender</Label>
                                        <Select value={gender} onValueChange={setGender}>
                                            <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl text-white">
                                                <SelectValue placeholder="Gender" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-[#161616] border-white/10 text-white rounded-2xl">
                                                {["Male", "Female", "Other"].map(g => (
                                                    <SelectItem key={g} value={g} className="focus:bg-white/10">{g}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label className="text-white/60 text-xs font-bold uppercase tracking-widest ml-1">Operating Region</Label>
                                    <Select value={state} onValueChange={setState}>
                                        <SelectTrigger className="h-14 bg-white/5 border-white/10 rounded-2xl text-white">
                                            <SelectValue placeholder="Select State" />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-[300px] bg-[#161616] border-white/10 text-white rounded-2xl">
                                            {STATES.map(s => <SelectItem key={s} value={s} className="focus:bg-white/10">{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <Button onClick={handleNext} className="w-full h-14 bg-[#0B1120] text-black rounded-2xl font-bold hover:bg-indigo-50 transition-all shadow-xl">
                                    Validate & Continue <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>
                                <button onClick={handleNext} className="text-[10px] font-bold text-white/20 hover:text-white/50 transition-colors uppercase tracking-[0.2em] py-2">
                                    Bypass Validation
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div 
                            key="step3" 
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="w-full max-w-md space-y-8"
                        >
                             <div className="space-y-2 text-center md:text-left">
                                <h2 className="text-3xl font-bold tracking-tight text-white">Clinical History</h2>
                                <p className="text-white/40">Map existing conditions for precise AI monitoring.</p>
                            </div>

                            <div className="space-y-8 bg-white/[0.03] border border-white/10 p-8 rounded-[2.5rem] backdrop-blur-3xl shadow-2xl relative overflow-hidden">
                                <div className="absolute bottom-0 left-0 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full -ml-16 -mb-16" />
                                
                                <div className="flex flex-wrap gap-2">
                                    {CONDITIONS.map(cond => {
                                        const isSelected = conditions.includes(cond);
                                        return (
                                            <button
                                                key={cond}
                                                onClick={() => toggleCondition(cond)}
                                                className={`px-5 py-2.5 rounded-2xl text-xs font-bold border transition-all ${isSelected ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400' : 'bg-white/5 border-white/10 text-white/40 hover:bg-white/10 hover:text-white'}`}
                                            >
                                                {cond}
                                            </button>
                                        );
                                    })}
                                </div>

                                <div className="space-y-6 pt-6 border-t border-white/5">
                                    <div className="flex items-center justify-between group">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-bold text-white/90">Tobacco Usage</Label>
                                            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Clinical Parameter</p>
                                        </div>
                                        <Switch checked={smokes} onCheckedChange={setSmokes} className="data-[state=checked]:bg-indigo-500" />
                                    </div>
                                    <div className="flex items-center justify-between group">
                                        <div className="space-y-0.5">
                                            <Label className="text-sm font-bold text-white/90">Regular Physical Activity</Label>
                                            <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">Clinical Parameter</p>
                                        </div>
                                        <Switch checked={exercises} onCheckedChange={setExercises} className="data-[state=checked]:bg-emerald-500" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col gap-4">
                                <Button onClick={handleFinish} disabled={isSaving} className="w-full h-14 bg-[#0B1120] text-black rounded-2xl font-bold hover:bg-indigo-50 transition-all shadow-xl">
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Finalize Configuration <ArrowRight className="ml-2 w-4 h-4" /></>}
                                </Button>
                                <button onClick={handleFinish} disabled={isSaving} className="text-[10px] font-bold text-white/20 hover:text-white/50 transition-colors uppercase tracking-[0.2em] py-2">
                                    Complete Later
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {step === 4 && (
                        <motion.div 
                            key="step4" 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-xl space-y-10 text-center"
                        >
                            <div className="relative inline-block">
                                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full scale-150" />
                                <div className="text-8xl relative z-10 animate-pulse">🧤</div>
                            </div>

                            <div className="space-y-4">
                                <h2 className="text-4xl md:text-6xl font-bold tracking-tighter text-white font-space">
                                    System <span className="text-emerald-400">Activated</span>
                                </h2>
                                <p className="text-xl text-white/40 max-w-md mx-auto leading-relaxed">
                                    Welcome, {name || 'Professional'}. Your clinical workspace is now fully functional.
                                </p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FeatureButton 
                                    icon={Activity} 
                                    title="Neuro-Scan" 
                                    desc="Symptom analysis." 
                                    onClick={() => router.push(`/${locale}/symptom-checker`)} 
                                />
                                <FeatureButton 
                                    icon={Scan} 
                                    title="Dermal-View" 
                                    desc="Skin diagnostics." 
                                    onClick={() => router.push(`/${locale}/skin-scan`)} 
                                />
                                <FeatureButton 
                                    icon={MessageSquare} 
                                    title="Pulse-Mind" 
                                    desc="AI Consultation." 
                                    onClick={() => router.push(`/${locale}/dashboard`)} 
                                />
                            </div>

                            <div className="pt-6">
                                <Button onClick={() => router.push(`/${locale}/dashboard`)} className="w-full max-w-sm h-16 bg-white/5 border border-white/10 rounded-2xl text-white font-bold hover:bg-white/10 backdrop-blur-md transition-all">
                                    Enter Dashboard <ChevronRight className="w-4 h-4 ml-1" />
                                </Button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

function FeatureButton({ icon: Icon, title, desc, onClick }: { icon: any, title: string, desc: string, onClick: () => void }) {
    return (
        <button 
            onClick={onClick}
            className="group flex flex-col p-6 bg-white/[0.03] border border-white/10 rounded-[2rem] hover:bg-white/[0.06] hover:border-indigo-500/50 transition-all text-left backdrop-blur-md shadow-xl"
        >
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center mb-6 group-hover:bg-indigo-500/20 transition-colors border border-indigo-500/20">
                <Icon className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="space-y-1">
                <h3 className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">{title}</h3>
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-bold">{desc}</p>
            </div>
        </button>
    );
}
