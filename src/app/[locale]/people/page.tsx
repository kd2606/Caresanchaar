"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Trash2, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { useUser } from "@/firebase/auth/useUser";
import { collection, doc, getDocs, addDoc, deleteDoc } from "firebase/firestore";
import { db } from "@/firebase/clientApp";

interface Person {
    id: string;
    name: string;
    relationship: string;
}

const RELATIONSHIPS = ["self", "spouse", "child", "parent", "sibling", "other"] as const;
const LOAD_TIMEOUT_MS = 5000;

// In-memory cache so navigating back doesn't re-fetch
let cachedPeople: Person[] | null = null;
let cachedUid: string | null = null;

function PeopleSkeleton() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
                <Card key={i}>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <Skeleton className="h-5 w-28" />
                        <Skeleton className="h-8 w-8 rounded" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-4 w-16" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export default function PeoplePage() {
    const t = useTranslations("people");
    const { user, loading: authLoading } = useUser();

    const [people, setPeople] = useState<Person[]>(cachedPeople ?? []);
    const [name, setName] = useState("");
    const [relationship, setRelationship] = useState("");
    const [dialogOpen, setDialogOpen] = useState(false);
    const [adding, setAdding] = useState(false);

    // Three-state: "loading" | "done" | "error" | "timeout"
    const [fetchState, setFetchState] = useState<"loading" | "done" | "error" | "timeout">(
        cachedPeople !== null ? "done" : "loading"
    );

    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const loadPeople = async (uid: string, force = false) => {
        // Use cache if same user and not forced
        if (!force && cachedUid === uid && cachedPeople !== null) {
            setPeople(cachedPeople);
            setFetchState("done");
            return;
        }

        setFetchState("loading");

        // 5-second timeout
        timeoutRef.current = setTimeout(() => {
            setFetchState("timeout");
        }, LOAD_TIMEOUT_MS);

        try {
            const snapshot = await getDocs(collection(db, "users", uid, "people"));
            const loaded = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Person));
            cachedPeople = loaded;
            cachedUid = uid;
            setPeople(loaded);
            setFetchState("done");
        } catch {
            setFetchState("error");
        } finally {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        if (!user) { setFetchState("done"); return; } // not logged in — show page immediately
        loadPeople(user.uid);
        return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
    }, [user, authLoading]);

    const addPerson = async () => {
        if (!user || !name || !relationship) return;
        setAdding(true);
        try {
            const ref = collection(db, "users", user.uid, "people");
            const docRef = await addDoc(ref, { name, relationship });
            const updated = [...people, { id: docRef.id, name, relationship }];
            setPeople(updated);
            cachedPeople = updated;
            setName("");
            setRelationship("");
            setDialogOpen(false);
        } catch {
            // silent
        } finally {
            setAdding(false);
        }
    };

    const removePerson = async (id: string) => {
        if (!user) return;
        const updated = people.filter((p) => p.id !== id);
        setPeople(updated);
        cachedPeople = updated;
        try { await deleteDoc(doc(db, "users", user.uid, "people", id)); }
        catch { setPeople(people); cachedPeople = people; }
    };

    // ── Render helpers ────────────────────────────────────────────────────────
    const renderBody = () => {
        if (!user && !authLoading) {
            return (
                <Card>
                    <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
                        <Users className="h-12 w-12 text-muted-foreground" />
                        <p className="text-muted-foreground">Please log in to view your family members.</p>
                        <Button onClick={() => (window.location.href = "/en/auth/patient")}>Log In</Button>
                    </CardContent>
                </Card>
            );
        }

        if (fetchState === "loading") return <PeopleSkeleton />;

        if (fetchState === "error") {
            return (
                <Card>
                    <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
                        <AlertCircle className="h-10 w-10 text-destructive" />
                        <p className="text-muted-foreground">Kuch problem aayi. Please refresh karo.</p>
                        <Button variant="outline" onClick={() => user && loadPeople(user.uid, true)}>
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
                        <Button variant="outline" onClick={() => user && loadPeople(user.uid, true)}>
                            <RefreshCw className="mr-2 h-4 w-4" /> Retry
                        </Button>
                    </CardContent>
                </Card>
            );
        }

        if (people.length === 0) {
            return (
                <Card>
                    <CardContent className="flex flex-col items-center gap-4 p-12">
                        <Users className="h-12 w-12 text-muted-foreground" />
                        <p className="text-muted-foreground">No family members added yet. Add someone to start tracking.</p>
                        <Button onClick={() => setDialogOpen(true)} className="mt-2">
                            <Plus className="mr-2 h-4 w-4" /> Add Family Member
                        </Button>
                    </CardContent>
                </Card>
            );
        }

        return (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {people.map((person) => (
                    <Card key={person.id}>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-lg">{person.name}</CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => removePerson(person.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </CardHeader>
                        <CardContent>
                            <CardDescription>{t(`relationships.${person.relationship}`)}</CardDescription>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
                    <p className="text-muted-foreground">{t("subtitle")}</p>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" /> {t("addPerson")}
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>{t("addPerson")}</DialogTitle>
                            <DialogDescription>{t("subtitle")}</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label>{t("name")}</Label>
                                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
                            </div>
                            <div className="space-y-2">
                                <Label>{t("relationship")}</Label>
                                <Select value={relationship} onValueChange={setRelationship}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {RELATIONSHIPS.map((rel) => (
                                            <SelectItem key={rel} value={rel}>
                                                {t(`relationships.${rel}`)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={addPerson} className="w-full" disabled={!name || !relationship || adding}>
                                {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                {t("addPerson")}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {renderBody()}
        </div>
    );
}
