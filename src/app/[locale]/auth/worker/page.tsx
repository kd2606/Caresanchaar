"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useUser } from "@/firebase/auth/useUser";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "@/firebase/clientApp";
import { doc, getDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { HeartPulse, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="flex min-h-[90vh] items-center justify-center p-4">
                <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}

function LoginContent() {
    const t = useTranslations("auth");
    const { user, loading: globalLoading, signInWithGoogle } = useUser();
    const router = useRouter();
    const params = useParams();
    const searchParams = useSearchParams();
    const locale = params.locale as string;

    const getSafeRedirect = (defaultPath: string) => {
        const next = searchParams.get("next");
        if (next && next.startsWith("/") && !next.startsWith("//")) {
            return next;
        }
        return defaultPath;
    };

    const isAutoDemo = searchParams.get("demo") === "1";

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [authChecking, setAuthChecking] = useState(true);
    const hasTriggeredDemo = useRef(false);

    useEffect(() => {
        // Redirection logic when user is authenticated
        if (user && !globalLoading && !loading) {
            handleAuthSuccess(user);
        }
    }, [user, globalLoading, loading]);

    const handleAuthSuccess = async (authenticatedUser: any) => {
        if (!authenticatedUser) return;
        
        let redirected = false;
        
        // Ensure the user has a 'worker' role claim (needed by middleware/AuthGuard)
        try {
            let token = await authenticatedUser.getIdToken();
            const payloadBase64 = token.split('.')[1];
            const payload = JSON.parse(atob(payloadBase64));
            
            if (!payload.role) {
                // Assign 'worker' role since they logged in from the worker auth page
                await fetch('/api/auth/assign-role', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ idToken: token, role: 'worker' }),
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

        // Fast redirect timeout - if Firestore check takes > 1s, just go to dashboard
        const timeoutId = setTimeout(() => {
            if (!redirected) {
                console.warn("Auth check timed out, forcing dashboard redirect for speed");
                redirected = true;
                setLoading(false);
                router.push(getSafeRedirect(`/${locale}/dashboard/worker`));
            }
        }, 1000);

        try {
            const userDocPath = `users/${authenticatedUser.uid}/profile/data`;
            const userDoc = await getDoc(doc(db, userDocPath));
            
            if (!redirected) {
                clearTimeout(timeoutId);
                redirected = true;
                setLoading(false);
                router.push(getSafeRedirect(`/${locale}/dashboard/worker`));
            }
        } catch (firestoreError) {
            console.warn("Firestore check failed during auth success:", firestoreError);
            if (!redirected) {
                clearTimeout(timeoutId);
                redirected = true;
                setLoading(false);
                router.push(getSafeRedirect(`/${locale}/dashboard/worker`));
            }
        }
    };

    useEffect(() => {
        if (isAutoDemo && !hasTriggeredDemo.current) {
            hasTriggeredDemo.current = true;
            handleDemoLogin();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isAutoDemo]);


    const handleEmailLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const userCred = await signInWithEmailAndPassword(auth, email, password);
            toast.success("Login successful!");
            handleAuthSuccess(userCred.user);
        } catch (error: any) {
            toast.error(error.message || "Failed to login");
        } finally {
            setLoading(false);
        }
    };

    const handleDemoLogin = async () => {
        setLoading(true);
        const DEMO_EMAIL = "demo@caresanchaarai.in";
        const DEMO_PASSWORD = "demo123456";
        try {
            let userCred;
            try {
                userCred = await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD);
            } catch (signInError: any) {
                // Auto-create demo account if it doesn't exist yet
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

            // Assign 'worker' role via Admin SDK so middleware/AuthGuard don't bounce
            const token = await userCred.user.getIdToken();
            await fetch('/api/auth/assign-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: token, role: 'worker' }),
            });

            // Force token refresh to pick up the new custom claim
            const freshToken = await userCred.user.getIdToken(true);
            await fetch('/api/auth/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: freshToken }),
            });

            toast.success("Demo login successful! 👋");
            router.push(getSafeRedirect(`/${locale}/dashboard/worker`));
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
                toast.success("Google sign in successful!");
                await handleAuthSuccess(userCred.user);
            }
            // If userCred is null, it means a redirect was initiated, 
            // so we keep the loading state until the page reloads.
        } catch (error: any) {
            setLoading(false);
            if (error.code === 'auth/configuration-not-found' || error.message?.includes('configuration-not-found')) {
                toast.error("Configuration Error", {
                    description: "Google Sign-In is not enabled. Please enable it in your Firebase Console.",
                    duration: 10000,
                });
            } else if (error.code !== 'auth/popup-closed-by-user' && error.code !== 'auth/cancelled-popup-request') {
                toast.error("Google sign in failed: " + error.message);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-[120px] rounded-full animate-pulse" />
                <div className="relative z-10 flex flex-col items-center gap-6">
                    <div className="h-1 plan-loading-bar w-48 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                            className="h-full bg-emerald-500"
                            animate={{ x: [-200, 200] }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                        />
                    </div>
                    <p className="text-[10px] font-bold text-white/20 uppercase tracking-[0.4em] animate-pulse">Loading Account...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-4 relative overflow-hidden bg-[#0a0a0a]">
            <style jsx global>{`
                .font-space { font-family: var(--font-space-grotesk), sans-serif; }
            `}</style>

            {/* Premium Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/10 blur-[120px] rounded-full" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-full max-w-md z-10"
            >
                <Card className="rounded-[2.5rem] border border-white/10 bg-black/40 backdrop-blur-3xl shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.02] blur-3xl rounded-full -mr-16 -mt-16" />
                    
                    <CardHeader className="text-center pb-2 pt-10">
                        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-indigo-600 shadow-2xl shadow-emerald-500/20 group animate-in zoom-in duration-500">
                            <HeartPulse className="h-8 w-8 text-white" />
                        </div>
                        <CardTitle className="text-3xl font-space font-bold tracking-tighter text-white">
                            Health Worker <span className="text-emerald-400">Login</span>
                        </CardTitle>
                        <CardDescription className="text-white/40 font-medium tracking-wide text-xs uppercase mt-2">
                            Secure Portal Access
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-6 px-8">
                        <form onSubmit={handleEmailLogin} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-white/60 text-xs font-bold uppercase tracking-widest ml-1">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="doctor@caresanchaar.ai"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white rounded-2xl h-12 focus:border-emerald-500/50 transition-all"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="password" title="Password" className="text-white/60 text-xs font-bold uppercase tracking-widest ml-1">Password</Label>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white rounded-2xl h-12 focus:border-emerald-500/50 transition-all"
                                    required
                                />
                            </div>
                            <Button type="submit" className="w-full h-12 rounded-2xl bg-white text-black font-bold hover:bg-emerald-50 transition-all shadow-xl active:scale-[0.98]" disabled={loading}>
                                {loading ? <Loader2 className="animate-spin" /> : <><Mail className="w-4 h-4 mr-2" /> Login with Email</>}
                            </Button>
                            {process.env.NODE_ENV !== 'production' && (
                            <Button type="button" variant="outline" className="w-full h-12 rounded-2xl border-white/10 bg-white/5 text-white font-bold hover:bg-white/10 hover:text-white transition-all shadow-xl active:scale-[0.98]" disabled={loading} onClick={handleDemoLogin}>
                                {loading ? <Loader2 className="animate-spin" /> : 'Demo Login'}
                            </Button>
                            )}
                        </form>

                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-white/5" />
                            </div>
                            <div className="relative flex justify-center text-[10px] uppercase tracking-[0.2em] font-bold">
                                <span className="bg-transparent px-4 text-white/30">OR</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            <Button
                                onClick={handleGoogleSignIn}
                                variant="outline"
                                className="w-full h-12 rounded-2xl bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20 transition-all"
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
                        </div>
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
