"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FadeIn } from "@/components/ui/fade-in";
import { Loader2, Landmark, HeartPulse, CheckCircle2, AlertTriangle, Info, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { suggestGovtSchemes } from "@/ai/flows/govt-schemes";

type Results = Awaited<ReturnType<typeof suggestGovtSchemes>>;

const INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
    "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
    "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Jammu and Kashmir"
];

const CATEGORIES = ["General", "SC/ST", "OBC", "BPL/Poor", "Farmer", "Woman"];

export default function GovtSchemesPage() {
    const [step, setStep] = useState<1 | 2>(1);
    
    // Form fields
    const [age, setAge] = useState("");
    const [stateLocation, setStateLocation] = useState("Chhattisgarh");
    const [category, setCategory] = useState("");

    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<Results | null>(null);

    const handleSearch = async () => {
        if (!age || !category) {
            toast.error("Please enter your age and select a category.");
            return;
        }

        setLoading(true);
        setResults(null);
        try {
            const response = await fetch("/api/govt-schemes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    profile: {
                        age: parseInt(age, 10),
                        state: stateLocation,
                        category: category,
                    }
                }),
            });

            if (!response.ok) {
                throw new Error("Failed to fetch schemes");
            }

            const data = await response.json();
            setResults(data);
            setStep(2);
        } catch (error) {
            console.error("Schemes check error:", error);
            toast.error("Analysis failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };
    
    // Render status badge based on eligibilityStatus
    const renderEligibilityBadge = (status: "eligible" | "maybe" | "check") => {
        switch (status) {
            case "eligible":
                return (
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-md text-sm font-medium w-fit">
                        <CheckCircle2 className="h-4 w-4" />
                        You are eligible!
                    </div>
                );
            case "maybe":
                return (
                    <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-500/10 px-3 py-1.5 rounded-md text-sm font-medium w-fit">
                        <AlertTriangle className="h-4 w-4" />
                        You may be eligible
                    </div>
                );
            case "check":
            default:
                return (
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-md text-sm font-medium w-fit">
                        <Info className="h-4 w-4" />
                        Check eligibility
                    </div>
                );
        }
    };

    return (
        <div className="space-y-6 max-w-3xl mx-auto">
            <FadeIn direction="down">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                        <Landmark className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Govt Schemes Finder</h1>
                        <p className="text-muted-foreground">Discover health and welfare schemes tailored to you.</p>
                    </div>
                </div>
            </FadeIn>

            {step === 1 && (
                <FadeIn delay={0.1}>
                    <Card className="border-2 border-muted overflow-hidden">
                        <CardHeader className="text-center pb-4 pt-8 bg-muted/20">
                            <div className="mx-auto bg-primary/10 text-primary px-4 py-1.5 rounded-full text-sm font-bold w-fit mb-4">
                                🏛️ 50+ Government Schemes Available
                            </div>
                            <CardTitle className="text-2xl">Find your eligible schemes</CardTitle>
                            <CardDescription>Just 3 quick details to get started</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8 p-6 sm:p-8">
                            <div className="space-y-3">
                                <Label htmlFor="age" className="text-base text-muted-foreground uppercase tracking-wider font-bold">1. Your Age</Label>
                                <Input
                                    id="age"
                                    type="number"
                                    min={1}
                                    max={120}
                                    placeholder="e.g. 45"
                                    className="h-14 text-lg"
                                    value={age}
                                    onChange={(e) => setAge(e.target.value)}
                                />
                            </div>

                            <div className="space-y-3">
                                <Label className="text-base text-muted-foreground uppercase tracking-wider font-bold">2. State</Label>
                                <Select value={stateLocation} onValueChange={setStateLocation}>
                                    <SelectTrigger className="h-14 text-lg">
                                        <SelectValue placeholder="Select State" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {INDIAN_STATES.map((s) => (
                                            <SelectItem key={s} value={s}>{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-3">
                                <Label className="text-base text-muted-foreground uppercase tracking-wider font-bold">3. Category</Label>
                                <div className="flex flex-wrap gap-3">
                                    {CATEGORIES.map((c) => (
                                        <button
                                            key={c}
                                            onClick={() => setCategory(c)}
                                            className={`px-5 py-3 rounded-full border-2 transition-all font-medium ${
                                                category === c 
                                                    ? "border-primary bg-primary text-primary-foreground" 
                                                    : "border-border hover:border-primary/50 text-muted-foreground bg-background"
                                            }`}
                                        >
                                            {c}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button 
                                onClick={handleSearch} 
                                disabled={loading} 
                                className="w-full h-14 text-lg mt-6 bg-teal-500 hover:bg-teal-600 text-white shadow-lg disabled:opacity-50" 
                                size="lg"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Finding Schemes...
                                    </>
                                ) : (
                                    <>
                                        Find My Schemes →
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </FadeIn>
            )}

            {step === 2 && results && (
                <FadeIn delay={0.1} className="space-y-6">
                    <Button variant="ghost" className="mb-2 -ml-4 hover:bg-transparent hover:text-primary transition-colors" onClick={() => setStep(1)}>
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to edit profile
                    </Button>

                    {!results.schemes || results.schemes.length === 0 ? (
                        <Card className="text-center py-16 border-2">
                            <CardContent>
                                <Info className="h-16 w-16 mx-auto text-muted-foreground mb-4 opacity-50" />
                                <h3 className="text-2xl font-bold mb-2">No schemes found for your profile.</h3>
                                <p className="text-muted-foreground mb-8 text-lg">Try changing your category or state to see different programs.</p>
                                <Button onClick={() => setStep(1)} size="lg" variant="outline" className="border-2">
                                    Try Again
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-6">
                            {results.schemes.map((scheme: { name: string; description: string; eligibilityStatus: "eligible" | "maybe" | "check"; eligibility: string; benefits: string; howToApply: string; officialLink: string }, i: number) => (
                                <Card key={i} className="overflow-hidden border-2 transition-all hover:border-primary/50">
                                    <CardHeader className="bg-muted/10 border-b pb-5">
                                        <CardTitle className="text-xl sm:text-2xl text-primary leading-tight">{scheme.name}</CardTitle>
                                        <CardDescription className="mt-2 text-base">{scheme.description}</CardDescription>
                                    </CardHeader>
                                    
                                    <CardContent className="pt-6 space-y-6">
                                        {renderEligibilityBadge(scheme.eligibilityStatus)}

                                        <div className="bg-primary/5 dark:bg-primary/10 p-5 rounded-xl border border-primary/20">
                                            <Label className="text-xs uppercase tracking-wider text-primary font-bold flex items-center gap-1.5 mb-2">
                                                <HeartPulse className="h-4 w-4" /> Benefit
                                            </Label>
                                            <p className="text-lg sm:text-xl font-medium text-foreground">{scheme.benefits}</p>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Eligibility Details</Label>
                                            <p className="text-sm border-l-2 border-muted pl-3 text-muted-foreground">{scheme.eligibility}</p>
                                        </div>
                                    </CardContent>
                                    
                                    <CardFooter className="bg-muted/10 border-t pt-5 pb-5 flex gap-3 flex-wrap sm:flex-nowrap">
                                        <Button className="w-full sm:w-1/2 h-12 text-base font-semibold" asChild>
                                            <a href={`https://www.google.com/search?q=${encodeURIComponent(scheme.name + " how to apply")}`} target="_blank" rel="noopener noreferrer">
                                                How to Apply →
                                            </a>
                                        </Button>
                                        <Button variant="outline" className="w-full sm:w-1/2 h-12 text-base border-2" asChild>
                                            <a href={scheme.officialLink} target="_blank" rel="noopener noreferrer">
                                                Know More →
                                            </a>
                                        </Button>
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}
                </FadeIn>
            )}
        </div>
    );
}
