"use client";

import { useEffect, useState } from "react";
import { useFirebaseContext } from "@/firebase/provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { FadeIn } from "@/components/ui/fade-in";
import { BellRing, CalendarDays, Pill, Stethoscope, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    orderBy,
    Timestamp,
    updateDoc
} from "firebase/firestore";
import { db } from "@/firebase/clientApp";
import { format } from "date-fns";

type Reminder = {
    id: string;
    title: string;
    type: "Medication" | "Appointment" | "Other";
    date: Date;
    time: string;
    active: boolean;
};

export default function RemindersPage() {
    const { user } = useFirebaseContext();

    // Form state
    const [title, setTitle] = useState("");
    const [type, setType] = useState<"Medication" | "Appointment" | "Other">("Medication");
    const [dateStr, setDateStr] = useState("");
    const [timeStr, setTimeStr] = useState("");

    const [loading, setLoading] = useState(false);
    const [reminders, setReminders] = useState<Reminder[]>([]);

    useEffect(() => {
        if (!user) {
            setReminders([]);
            return;
        }

        const q = query(
            collection(db, `users/${user.uid}/reminders`),
            orderBy("date", "asc")
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    date: data.date.toDate(),
                } as Reminder;
            });
            setReminders(fetched);
        }, (err) => {
            console.error("Error fetching reminders", err);
            toast.error("Failed to load reminders.");
        });

        return () => unsubscribe();
    }, [user]);

    const handleAdd = async () => {
        if (!user) {
            toast.error("Please login to save reminders.");
            return;
        }
        if (!title.trim() || !dateStr || !timeStr) {
            toast.error("Please fill in title, date and time.");
            return;
        }

        setLoading(true);
        try {
            await addDoc(collection(db, `users/${user.uid}/reminders`), {
                title: title.trim(),
                type,
                date: Timestamp.fromDate(new Date(dateStr)),
                time: timeStr,
                active: true,
                createdAt: Timestamp.now()
            });

            toast.success("Reminder added!");
            setTitle("");
            setDateStr("");
            setTimeStr("");
        } catch (error) {
            console.error("Add reminder error:", error);
            toast.error("Failed to add reminder.");
        } finally {
            setLoading(false);
        }
    };

    const toggleActive = async (id: string, active: boolean) => {
        if (!user) return;
        try {
            await updateDoc(doc(db, `users/${user.uid}/reminders`, id), {
                active
            });
        } catch (error) {
            console.error(error);
            toast.error("Failed to update reminder.");
        }
    };

    const handleDelete = async (id: string) => {
        if (!user) return;
        try {
            await deleteDoc(doc(db, `users/${user.uid}/reminders`, id));
            toast.success("Reminder deleted");
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete reminder.");
        }
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <FadeIn direction="down">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                        <BellRing className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Health Reminders</h1>
                        <p className="text-muted-foreground">Keep track of your medications and upcoming appointments.</p>
                    </div>
                </div>
            </FadeIn>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FadeIn delay={0.1} className="md:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle>Add Reminder</CardTitle>
                            <CardDescription>Schedule a new notification.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Title / Medicine Name</Label>
                                <Input
                                    placeholder="e.g. Paracetamol or Dr. Sharma"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={type} onValueChange={(v: "Medication" | "Appointment" | "Other") => setType(v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Medication">Medication</SelectItem>
                                        <SelectItem value="Appointment">Appointment</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>Date</Label>
                                <Input
                                    type="date"
                                    value={dateStr}
                                    onChange={(e) => setDateStr(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Time</Label>
                                <Input
                                    type="time"
                                    value={timeStr}
                                    onChange={(e) => setTimeStr(e.target.value)}
                                />
                            </div>

                            <Button onClick={handleAdd} disabled={loading} className="w-full mt-2">
                                <Plus className="mr-2 h-4 w-4" />
                                Add Reminder
                            </Button>
                        </CardContent>
                    </Card>
                </FadeIn>

                <FadeIn delay={0.2} className="md:col-span-2">
                    <Card className="h-full border-2">
                        <CardHeader>
                            <CardTitle>Upcoming Reminders</CardTitle>
                            <CardDescription>Your scheduled health items.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {!user ? (
                                <div className="text-center py-10">
                                    <AlertTriangle className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                                    <p className="font-medium text-lg">Please log in</p>
                                    <p className="text-muted-foreground">You need to be logged in to view and save reminders.</p>
                                </div>
                            ) : reminders.length === 0 ? (
                                <div className="text-center py-10 bg-muted/20 rounded-xl border border-dashed">
                                    <CalendarDays className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                                    <p className="font-medium">No Reminders Yet</p>
                                    <p className="text-muted-foreground text-sm">Add one from the panel to get started.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {reminders.map((r) => {
                                        const isPast = r.date.getTime() < new Date().getTime() && r.time < format(new Date(), "HH:mm");
                                        const TypeIcon = r.type === "Medication" ? Pill : (r.type === "Appointment" ? Stethoscope : BellRing);
                                        const typeColor = r.type === "Medication" ? "text-purple-500 bg-purple-100 dark:bg-purple-900/30" : "text-blue-500 bg-blue-100 dark:bg-blue-900/30";

                                        return (
                                            <div key={r.id} className={`flex items-center justify-between p-4 rounded-xl border ${r.active ? "bg-card" : "bg-muted/50 opacity-60"}`}>
                                                <div className="flex items-center gap-4">
                                                    <div className={`h-10 w-10 flex items-center justify-center rounded-full ${typeColor}`}>
                                                        <TypeIcon className="h-5 w-5" />
                                                    </div>
                                                    <div>
                                                        <p className={`font-semibold ${isPast && r.active ? 'text-destructive' : ''} ${!r.active ? 'line-through text-muted-foreground' : ''}`}>{r.title}</p>
                                                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                                            <CalendarDays className="h-3 w-3" />
                                                            {format(r.date, "MMM dd, yyyy")} • {r.time}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <Switch
                                                        checked={r.active}
                                                        onCheckedChange={(checked) => toggleActive(r.id, checked)}
                                                    />
                                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDelete(r.id)}>
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </FadeIn>
            </div>
        </div >
    );
}
