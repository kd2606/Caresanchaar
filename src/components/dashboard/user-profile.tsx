"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Activity, Droplet } from "lucide-react";
import { useFirebaseContext } from "@/firebase/provider";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import { db, auth } from "@/firebase/clientApp";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

export function UserProfileModal({ children }: { children: React.ReactNode }) {
    const { user } = useFirebaseContext();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);

    const [profile, setProfile] = useState({
        name: "",
        age: "",
        gender: "",
        height: "",
        weight: "",
        bloodGroup: "",
        conditions: ""
    });

    const router = useRouter();

    useEffect(() => {
        if (!open || !user) return;
        const fetchProfile = async () => {
            setFetching(true);
            try {
                const userRef = doc(db, "users", user.uid, "profile", "data");
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    setProfile(prev => ({ ...prev, ...snap.data() }));
                } else if (user.displayName) {
                    setProfile(prev => ({ ...prev, name: user.displayName || "" }));
                }
            } catch (error) {
                console.error("Error fetching profile:", error);
            } finally {
                setFetching(false);
            }
        };
        fetchProfile();
    }, [open, user]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        try {
            if (auth.currentUser && profile.name) {
                await updateProfile(auth.currentUser, {
                    displayName: profile.name
                });
            }

            const userRef = doc(db, "users", user.uid, "profile", "data");
            // Sync with merge to preserve other fields like onboardingDone
            await setDoc(userRef, {
                ...profile,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            toast.success("Profile updated successfully!");
            setOpen(false);
            router.refresh();
        } catch (error: any) {
            console.error("Error saving profile:", error);
            toast.error(error?.message || "Failed to update profile.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] bg-white/60 dark:bg-black/60 backdrop-blur-xl border border-white/20 shadow-2xl overflow-hidden rounded-[24px]">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 pointer-events-none" />
                <DialogHeader className="relative z-10">
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <User className="w-5 h-5 text-indigo-500" /> My Health Profile
                    </DialogTitle>
                    <p className="text-sm text-muted-foreground">Keep your details up to date for accurate AI assistance.</p>
                </DialogHeader>

                {fetching ? (
                    <div className="flex justify-center items-center py-10 relative z-10">
                        <Activity className="w-6 h-6 animate-pulse text-indigo-500" />
                    </div>
                ) : (
                    <form onSubmit={handleSave} className="space-y-4 mt-2 relative z-10">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</Label>
                            <Input
                                id="name" placeholder="E.g. Suresh Kumar"
                                className="bg-white/50 dark:bg-black/50"
                                value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })}
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="age" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Age</Label>
                                <Input
                                    id="age" type="number" placeholder="Years"
                                    className="bg-white/50 dark:bg-black/50"
                                    value={profile.age} onChange={e => setProfile({ ...profile, age: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="gender" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gender</Label>
                                <Input
                                    id="gender" placeholder="e.g. Male, Female"
                                    className="bg-white/50 dark:bg-black/50"
                                    value={profile.gender} onChange={e => setProfile({ ...profile, gender: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="height" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Height (cm)</Label>
                                <Input
                                    id="height" type="number" placeholder="170"
                                    className="bg-white/50 dark:bg-black/50"
                                    value={profile.height} onChange={e => setProfile({ ...profile, height: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="weight" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Weight (kg)</Label>
                                <Input
                                    id="weight" type="number" placeholder="65"
                                    className="bg-white/50 dark:bg-black/50"
                                    value={profile.weight} onChange={e => setProfile({ ...profile, weight: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="blood" className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                                <Droplet className="w-3 h-3 text-red-500" /> Blood Group
                            </Label>
                            <Input
                                id="blood" placeholder="e.g. O+, A-"
                                className="bg-white/50 dark:bg-black/50"
                                value={profile.bloodGroup} onChange={e => setProfile({ ...profile, bloodGroup: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="conditions" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Known Medical Conditions</Label>
                            <Input
                                id="conditions" placeholder="e.g. Diabetes, Asthma"
                                className="bg-white/50 dark:bg-black/50"
                                value={profile.conditions} onChange={e => setProfile({ ...profile, conditions: e.target.value })}
                            />
                        </div>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full h-10 mt-4 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-500/20"
                        >
                            {loading ? "Saving..." : "Save Profile Details"}
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
