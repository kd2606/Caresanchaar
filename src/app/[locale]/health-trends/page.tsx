"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { TrendingUp, Brain, Activity, Mic, RefreshCw, AlertCircle } from "lucide-react";
import {
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
} from "recharts";
import { useState as useS, useEffect as useE } from "react";
import { useUser } from "@/firebase/auth/useUser";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/firebase/clientApp";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/fade-in";

interface ChartData {
    mentalWellnessData: any[];
    coughData: any[];
    fatigueData: any[];
}

// Per-user, per-member in-memory cache
const dataCache: Record<string, ChartData> = {};
const LOAD_TIMEOUT_MS = 5000;

function ChartSkeleton() {
    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32 mt-1" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-64 w-full rounded-md" />
                </CardContent>
            </Card>
            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
                    <CardContent><Skeleton className="h-48 w-full rounded-md" /></CardContent>
                </Card>
                <Card>
                    <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
                    <CardContent><Skeleton className="h-48 w-full rounded-md" /></CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function TrendsPage() {
    const t = useTranslations("trends");
    const { user, loading: authLoading } = useUser();

    const [people, setPeople] = useState<{ id: string; name: string }[]>([]);
    const [selectedMember, setSelectedMember] = useState("self");
    const [chartData, setChartData] = useState<ChartData>({
        mentalWellnessData: [],
        coughData: [],
        fatigueData: [],
    });

    type FetchState = "loading" | "done" | "error" | "timeout";
    const [fetchState, setFetchState] = useState<FetchState>("loading");
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ── Fetch helpers ─────────────────────────────────────────────────────────
    const loadPeople = async (uid: string) => {
        try {
            const snap = await getDocs(collection(db, "users", uid, "people"));
            setPeople(snap.docs.map((d) => ({ id: d.id, name: d.data().name })));
        } catch { /* silent */ }
    };

    const loadMemberData = async (uid: string, member: string, force = false) => {
        const cacheKey = `${uid}_${member}`;
        if (!force && dataCache[cacheKey]) {
            setChartData(dataCache[cacheKey]);
            setFetchState("done");
            return;
        }

        setFetchState("loading");

        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => setFetchState("timeout"), LOAD_TIMEOUT_MS);

        try {
            // Mental Health Scores
            const mentalSnap = await getDocs(
                collection(db, "users", uid, "people", member, "mentalHealthScreens")
            );
            let mwData = mentalSnap.docs.map((doc) => {
                const data = doc.data();
                const d = data.createdAt?.toMillis ? new Date(data.createdAt.toMillis()) : new Date();
                return { date: d.toLocaleDateString(), score: data.wellnessScore || 0, ts: d.getTime() };
            });
            mwData = mwData.sort((a, b) => a.ts - b.ts).slice(-20);

            // Cough Analysis
            const coughSnap = await getDocs(
                collection(db, "users", uid, "people", member, "coughAnalyses")
            );
            const coughCounts: Record<string, number> = { dry: 0, wet: 0, wheezing: 0, barking: 0, unknown: 0 };
            coughSnap.docs.forEach((doc) => {
                const type = doc.data().coughType?.toLowerCase() || "unknown";
                coughCounts[type in coughCounts ? type : "unknown"]++;
            });
            const cData = Object.entries(coughCounts).map(([key, count]) => ({
                type: key.charAt(0).toUpperCase() + key.slice(1),
                count,
            }));

            // Vision / Fatigue
            const visionSnap = await getDocs(
                collection(db, "users", uid, "people", member, "visionScans")
            );
            let vData = visionSnap.docs.map((doc) => {
                const data = doc.data();
                const d = data.createdAt?.toMillis ? new Date(data.createdAt.toMillis()) : new Date();
                return { date: d.toLocaleDateString(), fatigued: data.fatigueDetected ? 1 : 0, ts: d.getTime() };
            });
            vData = vData.sort((a, b) => a.ts - b.ts).slice(-20);

            const result: ChartData = { mentalWellnessData: mwData, coughData: cData, fatigueData: vData };
            dataCache[cacheKey] = result;
            setChartData(result);
            setFetchState("done");
        } catch {
            setFetchState("error");
        } finally {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        if (!user) { setFetchState("done"); return; }
        loadPeople(user.uid);
    }, [user, authLoading]);

    useEffect(() => {
        if (!user) return;
        loadMemberData(user.uid, selectedMember);
        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, [user, selectedMember]);

    const handleRetry = () => user && loadMemberData(user.uid, selectedMember, true);

    // ── State renders ─────────────────────────────────────────────────────────
    const renderBody = () => {
        if (!user && !authLoading) {
            return (
                <Card>
                    <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
                        <TrendingUp className="h-10 w-10 text-muted-foreground" />
                        <p className="text-muted-foreground">Please log in to view your health trends.</p>
                        <Button onClick={() => (window.location.href = "/en/auth/patient")}>Log In</Button>
                    </CardContent>
                </Card>
            );
        }

        if (fetchState === "loading") return <ChartSkeleton />;

        if (fetchState === "error") {
            return (
                <Card>
                    <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
                        <AlertCircle className="h-10 w-10 text-destructive" />
                        <p className="text-muted-foreground">Kuch problem aayi. Please refresh karo.</p>
                        <Button variant="outline" onClick={handleRetry}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Retry
                        </Button>
                    </CardContent>
                </Card>
            );
        }

        if (fetchState === "timeout") {
            return (
                <Card>
                    <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
                        <AlertCircle className="h-10 w-10 text-yellow-500" />
                        <p className="text-muted-foreground">Data load took too long or failed.</p>
                        <Button variant="outline" onClick={handleRetry}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Retry
                        </Button>
                    </CardContent>
                </Card>
            );
        }

        const hasNoData =
            chartData.mentalWellnessData.length === 0 &&
            chartData.fatigueData.length === 0 &&
            !chartData.coughData.some((d: any) => d.count > 0);

        if (hasNoData) {
            return (
                <Card>
                    <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
                        <TrendingUp className="h-10 w-10 text-muted-foreground" />
                        <p className="text-muted-foreground">No health trends yet. Start checking your symptoms!</p>
                        <Button onClick={() => (window.location.href = "/en/symptom-checker")}>
                            Go to Symptom Checker →
                        </Button>
                    </CardContent>
                </Card>
            );
        }

        return (
            <StaggerContainer delay={0.1} className="space-y-6">
                {/* Mental Wellness */}
                <StaggerItem>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Brain className="h-5 w-5 text-purple-500" />
                                {t("mentalWellness")}
                            </CardTitle>
                            <CardDescription>Score over time (0–100)</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-64">
                                {chartData.mentalWellnessData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height="100%">
                                        <LineChart data={chartData.mentalWellnessData}>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                            <XAxis dataKey="date" className="text-xs" />
                                            <YAxis domain={[0, 100]} className="text-xs" />
                                            <Tooltip />
                                            <Legend />
                                            <Line
                                                type="monotone"
                                                dataKey="score"
                                                stroke="hsl(var(--chart-1))"
                                                strokeWidth={2}
                                                dot={{ r: 4 }}
                                                name="Wellness Score"
                                            />
                                        </LineChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                                        No mental health data available.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </StaggerItem>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Fatigue */}
                    <StaggerItem>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Activity className="h-5 w-5 text-orange-500" />
                                    {t("fatigueTrend")}
                                </CardTitle>
                                <CardDescription>Daily fatigue instances (Yes=1, No=0)</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-48">
                                    {chartData.fatigueData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData.fatigueData}>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                <XAxis dataKey="date" className="text-xs" />
                                                <YAxis domain={[0, 1]} ticks={[0, 1]} className="text-xs" />
                                                <Tooltip />
                                                <Bar dataKey="fatigued" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} name="Fatigued" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                                            No vision scan data available.
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </StaggerItem>

                    {/* Cough */}
                    <StaggerItem>
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Mic className="h-5 w-5 text-green-500" />
                                    {t("coughTypes")}
                                </CardTitle>
                                <CardDescription>Distribution of detected cough types</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="h-48">
                                    {chartData.coughData.some((d: any) => d.count > 0) ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={chartData.coughData}>
                                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                                <XAxis dataKey="type" className="text-xs" />
                                                <YAxis className="text-xs" allowDecimals={false} />
                                                <Tooltip />
                                                <Bar dataKey="count" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Count" />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                                            No cough data available.
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </StaggerItem>
                </div>
            </StaggerContainer>
        );
    };

    return (
        <div className="space-y-6">
            <FadeIn direction="down" className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
                    <p className="text-muted-foreground">{t("subtitle")}</p>
                </div>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder={t("selectMember")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="self">Self</SelectItem>
                        {people.map((p) => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </FadeIn>

            {renderBody()}
        </div>
    );
}
