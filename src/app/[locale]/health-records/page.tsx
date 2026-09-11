"use client";

import { useState, useEffect } from "react";
import { useUser } from "@/firebase/auth/useUser";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/firebase/clientApp";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/ui/fade-in";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    ClipboardList,
    Activity,
    Scan,
    Eye,
    Mic,
    Brain,
    Calendar,
    ChevronRight,
    Search,
    MessageCircle,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface RecordDetails {
    symptoms?: string;
    condition?: string;
    medicines?: string[];
    homecare?: string[];
}

interface HealthRecord {
    id: string;
    type: "symptom" | "skin" | "vision" | "cough" | "mental" | "stress" | "wellness";
    title: string;
    severity: "low" | "moderate" | "high";
    verdict: "rest" | "monitor" | "doctor_today" | "urgent_support";
    summary: string;
    details?: RecordDetails;
    date?: { toMillis: () => number };
    saved?: boolean;
}

const filterOptions = [
    { id: "all", label: "All" },
    { id: "symptom", label: "Symptoms" },
    { id: "skin", label: "Skin" },
    { id: "vision", label: "Vision" },
    { id: "cough", label: "Cough" },
    { id: "stress", label: "Wellness" },
];

const typeIcons: Record<string, React.ReactNode> = {
    symptom: <Activity className="h-4 w-4" />,
    skin: <Scan className="h-4 w-4" />,
    vision: <Eye className="h-4 w-4" />,
    cough: <Mic className="h-4 w-4" />,
    mental: <Brain className="h-4 w-4" />,
    stress: <Brain className="h-4 w-4" />,
    wellness: <Brain className="h-4 w-4" />,
};

const typeLabels: Record<string, string> = {
    symptom: "Symptom Check",
    skin: "Skin Scan",
    vision: "Vision Scan",
    cough: "Cough Analysis",
    mental: "Mental Health",
    stress: "Wellness Screen",
    wellness: "Wellness Screen",
};

function getSeverityBadge(severity: string) {
    if (severity === "high") return <Badge variant="destructive">High</Badge>;
    if (severity === "moderate")
        return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 hover:bg-yellow-500/20">Moderate</Badge>;
    return <Badge className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20">Low</Badge>;
}

function VerdictCard({ verdict }: { verdict: string }) {
    if (verdict === "doctor_today" || verdict === "urgent_support") {
        return (
            <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-lg mb-4">
                <h4 className="font-bold text-red-500">{verdict === "urgent_support" ? "🔴 Urgent Support Recommended" : "🔴 Visit doctor TODAY"}</h4>
                <p className="text-sm text-red-500/80 mt-1">Your results need immediate attention</p>
            </div>
        );
    }
    if (verdict === "monitor") {
        return (
            <div className="bg-yellow-500/10 border-l-4 border-yellow-500 p-4 rounded-r-lg mb-4">
                <h4 className="font-bold text-yellow-500">🟡 Monitor for 24-48 hours</h4>
                <p className="text-sm text-yellow-500/80 mt-1">Watch symptoms, visit doctor if worsens</p>
            </div>
        );
    }
    return (
        <div className="bg-green-500/10 border-l-4 border-green-500 p-4 rounded-r-lg mb-4">
            <h4 className="font-bold text-green-500">🟢 Rest at home</h4>
            <p className="text-sm text-green-500/80 mt-1">Home care should be enough</p>
        </div>
    );
}

function VerdictDot({ verdict }: { verdict: string }) {
    const colors: Record<string, string> = {
        doctor_today: "bg-red-500",
        urgent_support: "bg-red-500",
        monitor: "bg-yellow-500",
        rest: "bg-green-500",
    };
    return <div className={`w-3 h-3 rounded-full ${colors[verdict] ?? "bg-muted"} shrink-0`} />;
}

export default function HealthRecordsPage() {
    const { user } = useUser();
    const [records, setRecords] = useState<HealthRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("all");
    const [selectedRecord, setSelectedRecord] = useState<HealthRecord | null>(null);

    useEffect(() => {
        if (!user) { setLoading(false); return; }

        const q = query(
            collection(db, `users/${user.uid}/healthRecords`),
            orderBy("date", "desc"),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data: HealthRecord[] = snapshot.docs.map(
                (doc) => ({ id: doc.id, ...doc.data() } as HealthRecord)
            );
            setRecords(data);
            setLoading(false);
        }, () => setLoading(false));

        return () => unsubscribe();
    }, [user]);

    // ── Stats ──────────────────────────────────────────────────────────
    const totalChecks = records.length;
    const now = new Date();
    const thisMonth = records.filter((r) => {
        if (!r.date?.toMillis) return false;
        const d = new Date(r.date.toMillis());
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;

    const occurrences: Record<string, number> = {};
    records.forEach((r) => { occurrences[r.title] = (occurrences[r.title] ?? 0) + 1; });
    let mostCommonTitle = "None";
    let mostCommonCount = 0;
    Object.entries(occurrences).forEach(([title, count]) => {
        if (count > mostCommonCount) { mostCommonTitle = title; mostCommonCount = count; }
    });

    const lastCheckDate = records[0]?.date?.toMillis
        ? new Date(records[0].date.toMillis()).toLocaleDateString()
        : "Never";

    // ── Filtering & Grouping ───────────────────────────────────────────
    const filtered = activeFilter === "all" ? records : records.filter((r) => r.type === activeFilter);

    const grouped: Record<string, HealthRecord[]> = {};
    filtered.forEach((r) => {
        const d = r.date?.toMillis ? new Date(r.date.toMillis()) : new Date();
        const key = d.toLocaleString("en-US", { month: "long", year: "numeric" });
        (grouped[key] ??= []).push(r);
    });

    // ── Share handler ──────────────────────────────────────────────────
    const handleShare = (r: HealthRecord) => {
        const verdictText =
            (r.verdict === "doctor_today" || r.verdict === "urgent_support") ? "Urgent Support / Medical Attention Recommended" :
                r.verdict === "monitor" ? "Monitor for 24-48 hours" : "Rest at home";
        const text = `*Health Record – caresanchaar AI*\n\nCondition: ${r.title}\nSeverity: ${r.severity.toUpperCase()}\nVerdict: ${verdictText}\n\nSummary:\n${r.summary}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            {/* Header */}
            <FadeIn direction="down">
                <h1 className="text-3xl font-bold tracking-tight">My Health Records</h1>
                <p className="text-muted-foreground">Your complete health history and analysis results</p>
            </FadeIn>

            {/* Stats Card */}
            <FadeIn delay={0.1}>
                <Card className="bg-muted/30">
                    <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <Activity className="text-primary h-6 w-6" />
                            <h3 className="font-semibold text-lg">Health Summary</h3>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Total Checks</p>
                                <p className="text-2xl font-bold">{totalChecks}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">This Month</p>
                                <p className="text-2xl font-bold">{thisMonth}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Most Common</p>
                                <p className="font-bold truncate" title={mostCommonTitle}>
                                    {mostCommonTitle === "None" ? "–" : `${mostCommonTitle} (${mostCommonCount})`}
                                </p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Last Check</p>
                                <p className="font-semibold">{lastCheckDate}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </FadeIn>

            {/* Filter Chips */}
            <FadeIn delay={0.2} className="flex flex-wrap gap-2">
                {filterOptions.map((opt) => (
                    <button
                        key={opt.id}
                        onClick={() => setActiveFilter(opt.id)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${activeFilter === opt.id
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-card border-border text-muted-foreground hover:border-primary/60"
                            }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </FadeIn>

            {/* Timeline */}
            {loading ? (
                <div className="flex justify-center p-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
            ) : filtered.length === 0 ? (
                <FadeIn delay={0.3}>
                    <Card className="flex items-center justify-center min-h-[300px] border-dashed">
                        <div className="text-center space-y-4 px-4">
                            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                                <ClipboardList className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold">No health records yet</h3>
                                <p className="text-sm text-muted-foreground max-w-sm mt-1">
                                    Your results will automatically save here after every health check.
                                </p>
                            </div>
                            <Button onClick={() => window.location.href = "/en/symptom-checker"}>
                                Start Symptom Check
                            </Button>
                        </div>
                    </Card>
                </FadeIn>
            ) : (
                <StaggerContainer delay={0.3} className="space-y-8">
                    {Object.entries(grouped).map(([month, monthRecords]) => (
                        <div key={month}>
                            <h3 className="font-medium text-muted-foreground flex items-center gap-2 mb-4 ml-1">
                                <Calendar className="h-4 w-4" /> {month}
                            </h3>
                            <div className="space-y-3">
                                {monthRecords.map((record) => {
                                    const d = record.date?.toMillis ? new Date(record.date.toMillis()) : new Date();
                                    return (
                                        <StaggerItem key={record.id}>
                                            <Card
                                                className="hover:border-primary/50 transition-colors cursor-pointer group"
                                                onClick={() => setSelectedRecord(record)}
                                            >
                                                <CardContent className="p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                                                    <div className="space-y-1.5">
                                                        <div className="flex gap-2 items-center text-xs text-muted-foreground">
                                                            {typeIcons[record.type]}
                                                            <span>{typeLabels[record.type]}</span>
                                                            <span className="opacity-50">•</span>
                                                            <span>{d.toLocaleDateString([], { day: "numeric", month: "short" })}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <h4 className="font-semibold text-base">{record.title}</h4>
                                                            {getSeverityBadge(record.severity)}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3 border-t sm:border-none pt-3 sm:pt-0 mt-3 sm:mt-0">
                                                        <VerdictDot verdict={record.verdict} />
                                                        <span className="text-sm font-medium text-primary flex items-center group-hover:underline">
                                                            View Details <ChevronRight className="h-4 w-4 ml-1" />
                                                        </span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </StaggerItem>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </StaggerContainer>
            )}

            {/* Detail Dialog */}
            <Dialog open={!!selectedRecord} onOpenChange={(open) => { if (!open) setSelectedRecord(null); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    {selectedRecord && (
                        <>
                            <DialogHeader className="mb-2">
                                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
                                    {typeIcons[selectedRecord.type]}
                                    <span>{typeLabels[selectedRecord.type]}</span>
                                    <span className="opacity-50">•</span>
                                    <span>
                                        {selectedRecord.date?.toMillis
                                            ? new Date(selectedRecord.date.toMillis()).toLocaleString()
                                            : "Unknown"}
                                    </span>
                                    {getSeverityBadge(selectedRecord.severity)}
                                </div>
                                <DialogTitle className="text-2xl">{selectedRecord.title}</DialogTitle>
                            </DialogHeader>

                            <VerdictCard verdict={selectedRecord.verdict} />

                            <div className="space-y-5">
                                <div>
                                    <h4 className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-2">
                                        In Simple Words
                                    </h4>
                                    <p className="text-sm bg-muted/50 p-4 rounded-md leading-relaxed">
                                        {selectedRecord.summary}
                                    </p>
                                </div>

                                {selectedRecord.details?.symptoms && (
                                    <div>
                                        <h4 className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-2">
                                            Symptoms Evaluated
                                        </h4>
                                        <p className="text-sm bg-card border p-3 rounded-md">
                                            &ldquo;{selectedRecord.details.symptoms}&rdquo;
                                        </p>
                                    </div>
                                )}

                                {selectedRecord.details?.condition && (
                                    <div>
                                        <h4 className="text-xs uppercase tracking-wider font-medium text-muted-foreground mb-2">
                                            Detected Condition
                                        </h4>
                                        <p className="text-sm">{selectedRecord.details.condition}</p>
                                    </div>
                                )}

                                <div className="grid sm:grid-cols-2 gap-4">
                                    {(selectedRecord.details?.homecare ?? []).length > 0 && (
                                        <div className="bg-card border p-4 rounded-xl">
                                            <h4 className="font-medium flex items-center gap-2 mb-3 text-sm">
                                                <Activity className="h-4 w-4 text-green-500" /> Care Plan
                                            </h4>
                                            <ul className="space-y-2 text-sm">
                                                {(selectedRecord.details?.homecare ?? []).map((item: string, i: number) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {(selectedRecord.details?.medicines ?? []).length > 0 && (
                                        <div className="bg-card border p-4 rounded-xl">
                                            <h4 className="font-medium flex items-center gap-2 mb-3 text-sm">
                                                <Search className="h-4 w-4 text-blue-500" /> Medicines
                                            </h4>
                                            <ul className="space-y-2 text-sm">
                                                {(selectedRecord.details?.medicines ?? []).map((item: string, i: number) => (
                                                    <li key={i} className="flex items-start gap-2">
                                                        <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                                                        {item}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-4 border-t flex justify-end">
                                    <Button
                                        className="bg-[#25D366] hover:bg-[#128C7E] text-white"
                                        onClick={() => handleShare(selectedRecord)}
                                    >
                                        <MessageCircle className="w-4 h-4 mr-2" /> Share Report
                                    </Button>
                                </div>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
