"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useUser } from "@/firebase/auth/useUser";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/firebase/clientApp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

export default function DistrictLoginPage() {
    return (
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center p-4"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>}>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const { user, loading: globalLoading, signInWithGoogle } = useUser();
    const router = useRouter();
    const params = useParams();
    const locale = params.locale as string;
    const searchParams = useSearchParams();
    const getSafeRedirect = (defaultPath: string) => {
        const next = searchParams.get("next");
        if (next && next.startsWith("/") && !next.startsWith("//")) {
            return next;
        }
        return defaultPath;
    };


    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (user && !globalLoading && !loading) {
            handleAuthSuccess(user);
        }
    }, [user, globalLoading, loading]);

    const handleAuthSuccess = async (authenticatedUser: any) => {
        if (!authenticatedUser) return;
        try {
            let token = await authenticatedUser.getIdToken();
            const payloadBase64 = token.split('.')[1];
            const payload = JSON.parse(atob(payloadBase64));
            
            if (!payload.role) {
                // Assign 'district_admin' role since they logged in from the district auth page
                await fetch('/api/auth/assign-role', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idToken: token, role: 'district_admin' }),
                });
                // Refresh token to pick up the new claim
                token = await authenticatedUser.getIdToken(true);
            }

            await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: token }),
            });
        } catch (e) {
            console.error("Failed to set session cookie:", e);
        }
        
        router.push(getSafeRedirect(`/${locale}/dashboard/district`));
    };

    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const userCred = await signInWithEmailAndPassword(auth, email, password);
            toast.success("District login successful!");
            handleAuthSuccess(userCred.user);
        } catch (error: any) {
            toast.error(error.message || "Failed to login");
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = async () => {
        setLoading(true);
        const DEMO_EMAIL = "dmo@caresanchaar.ai";
        const DEMO_PASSWORD = "demo123456";

        try {
            let userCred;
            try {
                userCred = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
            } catch (signInError: any) {
                if (
                    signInError.code === "auth/user-not-found" ||
                    signInError.code === "auth/invalid-credential" ||
                    signInError.code === "auth/invalid-login-credentials"
                ) {
                    userCred = await createUserWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
                } else {
                    throw signInError;
                }
            }

            const token = await userCred.user.getIdToken();
            await fetch('/api/auth/assign-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: token, role: 'district_admin' }),
            });

            const freshToken = await userCred.user.getIdToken(true);
            await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: freshToken }),
            });

            toast.success("District demo login successful! 👋");
            router.push(getSafeRedirect(`/${locale}/dashboard/district`));
        } catch (error: any) {
            toast.error("Demo login failed: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setLoading(true);
        try {
            const userCred = await signInWithGoogle();
            if (userCred && userCred.user) {
                toast.success("Login successful!");
                await handleAuthSuccess(userCred.user);
            }
        } catch (error: any) {
            setLoading(false);
            if (error.code !== 'auth/popup-closed-by-user') {
                toast.error("Sign in failed: " + error.message);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-slate-50 relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/10 blur-[120px] rounded-full animate-pulse" />
                <div className="relative z-10 flex flex-col items-center gap-6">
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.4em] animate-pulse">Authenticating...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-slate-50">
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md z-10"
            >
                <Card className="rounded-[2.5rem] border border-slate-200 bg-white shadow-xl relative overflow-hidden">
                    <CardHeader className="text-center pb-2 pt-10">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 shadow-xl shadow-blue-500/20">
                            <Building className="h-8 w-8 text-white" />
                        </div>
                        <CardTitle className="text-3xl font-bold tracking-tighter text-slate-900">
                            District <span className="text-blue-600">Command</span>
                        </CardTitle>
                        <CardDescription className="text-slate-500 font-medium tracking-wide text-xs uppercase mt-2">
                            Secure Hospital / DHO Access
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-6 px-8 pb-10">
                        <form onSubmit={handleEmailLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-500 text-xs font-bold uppercase tracking-widest ml-1">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="dmo@caresanchaar.ai"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-2xl h-12 focus:border-blue-500/50 transition-all"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" title="Password" className="text-slate-500 text-xs font-bold uppercase tracking-widest ml-1">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-slate-50 border-slate-200 text-slate-900 rounded-2xl h-12 focus:border-blue-500/50 transition-all"
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full h-12 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all shadow-md active:scale-[0.98]" disabled={loading}>
                                {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Mail className="w-4 h-4 mr-2" />} Login with Email
                            </Button>
                            <Button type="button" variant="outline" className="w-full h-12 rounded-2xl border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all shadow-sm active:scale-[0.98]" disabled={loading} onClick={handleDemoLogin}>
                                {loading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : null} Demo Login
                            </Button>
                        </form>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-slate-200" />
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-bold">
                                <span className="bg-white px-4 text-slate-400">OR</span>
                            </div>
                        </div>

                        <Button
                            type="button"
                            onClick={handleGoogleSignIn}
                            variant="outline"
                            className="w-full h-12 rounded-2xl border-2 border-slate-300 shadow-sm bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-400 active:bg-slate-100 disabled:text-slate-500 transition-all font-semibold"
                            disabled={loading}
                        >
                            <svg className="mr-3 h-5 w-5" viewBox="0 0 24 24">
                                <path
                                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                                    fill="#4285F4"
                                />
                                <path
                                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    fill="#34A853"
                                />
                                <path
                                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    fill="#FBBC05"
                                />
                                <path
                                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    fill="#EA4335"
                                />
                            </svg>
                            Continue with Google
                        </Button>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
