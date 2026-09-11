"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/firebase/clientApp";
import { doc, setDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Activity, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";

export default function SignupPage() {
    const router = useRouter();
    const params = useParams();
    const locale = params.locale as string;

    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Create user
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // Set initial state for a new user
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                displayName: name,
                email: email,
                createdAt: new Date().toISOString(),
                isNewUser: true // This will be used to show the "clean dashboard"
            });

            toast.success("Account created successfully!");
            router.push(`/${locale}/onboarding`);
        } catch (error: any) {
            toast.error(error.message || "Failed to create account");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-[#0a0a0a]">
            {/* Premium Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-md z-10"
            >
                <Card className="rounded-[2.5rem] border border-white/10 bg-black/40 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-32 h-32 bg-white/[0.02] blur-3xl rounded-full -ml-16 -mt-16" />

                    <CardHeader className="text-center pb-2 pt-10">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-emerald-500 shadow-2xl shadow-indigo-500/20">
                            <Activity className="h-8 w-8 text-white" />
                        </div>
                        <CardTitle className="text-3xl font-space font-bold tracking-tighter text-white">Join <span className="text-emerald-400">caresanchaar AI</span></CardTitle>
                        <CardDescription className="text-white/40 font-medium tracking-wide text-xs uppercase mt-2">New Professional Registration</CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-6 px-8">
                        <form onSubmit={handleSignup} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-white/60 text-xs font-bold uppercase tracking-widest ml-1">Full Name</Label>
                                <Input
                                    id="name"
                                    placeholder="Dr. Ramesh Kumar"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white rounded-2xl h-12 focus:border-indigo-500/50 transition-all"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-white/60 text-xs font-bold uppercase tracking-widest ml-1">Email ID</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="doctor@caresanchaar.ai"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white rounded-2xl h-12 focus:border-indigo-500/50 transition-all"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" title="Access Key" className="text-white/60 text-xs font-bold uppercase tracking-widest ml-1">Set Access Key</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white rounded-2xl h-12 focus:border-indigo-500/50 transition-all"
                                    required
                                    minLength={6}
                                />
                            </div>
                            <Button type="submit" className="w-full h-12 rounded-2xl bg-[#0B1120] text-black font-bold hover:bg-indigo-50 transition-all shadow-xl mt-4" disabled={loading}>
                                <ShieldCheck className="w-4 h-4 mr-2" />
                                {loading ? "Registering..." : "Create Identity"}
                            </Button>
                        </form>
                    </CardContent>

                    <CardFooter className="flex flex-col items-center justify-center border-t border-white/5 pt-8 pb-10 mt-4">
                        <div className="text-center text-sm">
                            <span className="text-white/40 mr-2">Already Registered?</span>
                            <Link href={`/${locale}/auth/patient`} className="text-indigo-400 hover:text-indigo-300 font-bold transition-colors">
                                Authenticate Here
                            </Link>
                        </div>
                    </CardFooter>
                </Card>
            </motion.div>
        </div>
    );
}
