"use client";

import { GlassCard } from "./glass-card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
    Phone, CheckCircle2, Pill, Users, MessageCircle, Star, 
    MapPin, Mic, AlertOctagon, ShieldCheck, Plus, Check, 
    Clock, Shield, Search, ChevronRight, Activity, Zap, Server, Navigation
} from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useFirebaseContext } from "@/firebase/provider";
import { doc, getDoc, setDoc, updateDoc, arrayUnion, collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/firebase/clientApp";
import { getMedicinePrices, type MedicinePriceInfo } from "@/ai/flows/medicine";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { VoiceCallInterface } from "@/components/voice-call-interface";

/**
 * Regional Medical Centers - Redesigned as high-fidelity node monitoring
 */
export function RuralHospitalList() {
    const t = useTranslations("dashboard");
    const [hospitals, setHospitals] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMsg, setLoadingMsg] = useState("Detecting nearby hospitals...");

    useEffect(() => {
        if (typeof window !== "undefined" && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const userLat = pos.coords.latitude;
                    const userLng = pos.coords.longitude;
                    
                    const calculateDist = (hLat: number, hLng: number) => {
                        const R = 6371;
                        const dLat = (hLat - userLat) * Math.PI / 180;
                        const dLon = (hLng - userLng) * Math.PI / 180;
                        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(userLat * Math.PI / 180) * Math.cos(hLat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2); 
                        return (R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))).toFixed(1);
                    };

                    try {
                        const res = await fetch(`/api/nearby-facilities?lat=${userLat}&lng=${userLng}&radius=15000`);
                        let places = [];
                        if (res.ok) {
                            const data = await res.json();
                            places = data.places || [];
                        }

                        if (places.length < 2) {
                            places = [
                                { name: "District General Hospital", lat: userLat + 0.02, lng: userLng + 0.01, address: "Central District" },
                                { name: "Community Health Center (CHC)", lat: userLat - 0.015, lng: userLng + 0.02, address: "North Block" },
                                { name: "Primary Health Center (PHC)", lat: userLat + 0.03, lng: userLng - 0.01, address: "Rural Block A" },
                                { name: "Lifeline Specialty Hospital", lat: userLat - 0.025, lng: userLng - 0.03, address: "City Limits" },
                                { name: "Sanjeevani Clinic", lat: userLat + 0.01, lng: userLng + 0.04, address: "East Sector" },
                            ];
                        }

                        const formatted = places.slice(0, 8).map((place: any, idx: number) => {
                            const dist = calculateDist(place.lat, place.lng);
                            return {
                                name: place.name || "Local Clinic",
                                dist: `${dist} km away`,
                                lat: place.lat,
                                lng: place.lng,
                                sector: place.address?.split(",")[0] || "Local Area",
                                rating: (idx % 2 === 0) ? 4 : 5,
                                cover: (idx % 3 === 0) ? "PM-JAY ACTIVE" : "STANDARD",
                                phone: place.phone || ""
                            };
                        });
                        
                        formatted.sort((a: any, b: any) => parseFloat(a.dist) - parseFloat(b.dist));
                        setHospitals(formatted);
                    } catch (e) {
                        console.error("Failed to fetch hospitals", e);
                        setHospitals([
                            { name: "Emergency District Hospital", dist: "2.4 km away", sector: "Local", rating: 5, cover: "PM-JAY ACTIVE", lat: userLat, lng: userLng }
                        ]);
                    } finally {
                        setLoading(false);
                    }
                },
                (err) => {
                    setLoadingMsg("Location access denied.");
                    setLoading(false);
                }
            );
        } else {
            setLoadingMsg("Geolocation not supported.");
            setLoading(false);
        }
    }, []);

    return (
        <GlassCard className="h-[500px] flex flex-col p-8 border-slate-200 dark:border-slate-700 bg-[#FAFAF9] dark:bg-[#0B1120]/40 backdrop-blur-3xl rounded-[2.5rem]">
            <div className="flex justify-between items-center mb-8 shrink-0">
                <div className="space-y-1">
                    <h2 className="font-heading font-bold text-2xl flex items-center gap-3 text-slate-800 dark:text-white">
                        <Activity className="w-6 h-6 text-[#0D9488] dark:text-[#14B8A6]" />
                        {t("nearbyHospitals")}
                    </h2>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.25em]">{t("localHealthCenters")}</p>
                </div>
                <Badge variant="secondary" className="bg-[#0D9488]/10 dark:bg-[#14B8A6]/10 text-[#0D9488] dark:text-[#14B8A6] text-[9px] border border-[#0D9488]/20 dark:border-[#14B8A6]/20 uppercase tracking-widest px-3 py-1 font-bold">
                    {loading ? t("syncing") : t("syncActive")}
                </Badge>
            </div>

            <div className="flex flex-col gap-6 overflow-y-auto custom-scroll pr-2 pb-2 flex-1">
                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center min-h-[200px] text-center gap-4">
                        <div className="w-8 h-8 border-2 border-[#0D9488]/20 dark:border-[#14B8A6]/20 border-t-indigo-500 rounded-full animate-spin" />
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium animate-pulse">{loadingMsg}</p>
                    </div>
                ) : hospitals.length > 0 ? (
                    hospitals.map((hospital, idx) => (
                        <motion.div 
                            key={idx}
                            className="p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 transition-all group flex flex-col justify-between shrink-0"
                            whileHover={{ y: -5 }}
                        >
                            <div className="space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1 pr-4">
                                        <h3 className="font-bold text-lg text-slate-800 dark:text-white group-hover:text-[#0D9488] dark:text-[#14B8A6] transition-colors uppercase tracking-tight font-heading truncate">
                                            {hospital.name}
                                        </h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <MapPin className="w-3 h-3 text-slate-400 dark:text-slate-500 shrink-0" />
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest leading-none truncate">
                                                {hospital.dist} • {hospital.sector}
                                            </p>
                                        </div>
                                    </div>
                                    <Badge className="bg-slate-100 dark:bg-slate-800 text-[8px] border border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-lg shrink-0">
                                        {hospital.cover}
                                    </Badge>
                                </div>

                                <div className="flex items-center gap-1.5 py-2 border-y border-slate-200 dark:border-slate-700">
                                    {[...Array(5)].map((_, i) => (
                                        <Star key={i} className={`w-3 h-3 ${i < hospital.rating ? 'fill-indigo-500 text-indigo-500' : 'fill-white/5 text-slate-800 dark:text-slate-400 dark:text-slate-500'}`} />
                                    ))}
                                    <span className="text-[9px] ml-2 text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tighter">{t("hospitalRating")}</span>
                                </div>
                            </div>

                            <div className="flex gap-4 mt-6">
                                <Button className="flex-1 bg-[#0D9488] text-white dark:bg-[#14B8A6] dark:text-slate-900 hover:bg-[#0F766E] dark:hover:bg-[#0D9488] rounded-xl h-12 font-bold text-xs font-heading transition-all active:scale-95" asChild>
                                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${hospital.lat},${hospital.lng}`} target="_blank" rel="noopener noreferrer">
                                        <Navigation className="w-4 h-4 mr-2" /> Get Directions
                                    </a>
                                </Button>
                            </div>
                        </motion.div>
                    ))
                ) : (
                    <div className="text-center text-slate-500 dark:text-slate-400 text-sm mt-10 font-medium">{loadingMsg}</div>
                )}
            </div>
        </GlassCard>
    );
}

/**
 * Medicine Price Comparison - Redesigned as Dermal-Cost Review Interface
 */
export function MedicinePriceCard() {
    const t = useTranslations("dashboard");
    const [searchQuery, setSearchQuery] = useState("");
    const [medicineData, setMedicineData] = useState<MedicinePriceInfo | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setLoading(true);
        try {
            const data = await getMedicinePrices(searchQuery.trim());
            setMedicineData(data);
            toast.success(`Found prices for ${data.searchedName}`);
        } catch (error) {
            toast.error("Could not find medicine prices right now.");
        } finally {
            setSearchQuery("");
            setLoading(false);
        }
    };

    return (
        <GlassCard className="h-[500px] flex flex-col p-8 border-slate-200 dark:border-slate-700 bg-[#FAFAF9] dark:bg-[#0B1120]/40 backdrop-blur-3xl rounded-[2.5rem] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-[#0D9488]/5 dark:bg-[#14B8A6]/5 blur-[100px] pointer-events-none" />
            
            <div className="flex items-center gap-4 mb-10 text-left">
                <div className="p-3 rounded-2xl bg-[#0D9488]/10 dark:bg-[#14B8A6]/10 border border-[#0D9488]/20 dark:border-[#14B8A6]/20">
                    <Pill className="w-6 h-6 text-[#0D9488] dark:text-[#14B8A6]" />
                </div>
                <div className="space-y-0.5">
                    <h2 className="font-heading font-bold text-2xl text-slate-800 dark:text-white">{t("medicinePrices")}</h2>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.25em]">{t("checkCompareCosts")}</p>
                </div>
            </div>

            <div className="space-y-6 flex-1 flex flex-col">
                <form onSubmit={handleSearch} className="flex gap-3">
                    <Input
                        placeholder={t("searchMedicine")}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-14 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded-2xl text-sm text-slate-800 dark:text-white placeholder:text-slate-800 dark:text-slate-400 dark:text-slate-500 px-6 font-sans focus:ring-indigo-500/20"
                        disabled={loading}
                    />
                    <Button type="submit" size="icon" disabled={loading} className="h-14 w-14 shrink-0 bg-[#0D9488] text-slate-800 dark:text-white dark:bg-[#14B8A6] dark:text-slate-900 hover:bg-[#0F766E] dark:hover:bg-[#0D9488] rounded-2xl transition-all shadow-2xl active:scale-90">
                        {loading ? <div className="w-5 h-5 border-3 border-black/20 border-t-black rounded-full animate-spin" /> : <Search className="w-5 h-5" />}
                    </Button>
                </form>

                <AnimatePresence mode="wait">
                    {medicineData ? (
                        <motion.div 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="flex-1 flex flex-col gap-6"
                        >
                            <div className="p-8 rounded-[2rem] bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 relative overflow-hidden group">
                                <div className="border-b border-slate-200 dark:border-slate-700 pb-6 mb-8 flex justify-between items-start text-left">
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-2xl text-slate-800 dark:text-white font-heading tracking-tight">{medicineData.searchedName}</h3>
                                        <Badge className="bg-[#0D9488]/10 dark:bg-[#14B8A6]/10 text-[#0D9488] dark:text-[#14B8A6] border-[#0D9488]/20 dark:border-[#14B8A6]/20 text-[9px] font-bold tracking-widest px-2">{t("verified")}</Badge>
                                    </div>
                                    <div className="h-10 w-10 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                        <Zap className="w-4 h-4 text-[#0D9488] dark:text-[#14B8A6]" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-6">
                                    <div className="flex justify-between items-end p-6 rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/10">
                                        <div className="space-y-1 text-left">
                                            <span className="text-[10px] font-bold text-[#0D9488] dark:text-[#14B8A6] uppercase tracking-widest">{t("genericMedicine")}</span>
                                            <div className="text-lg font-medium text-slate-800 dark:text-slate-700 dark:text-slate-200 font-heading">{medicineData.genericName}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-3xl font-bold text-[#0D9488] dark:text-[#14B8A6] tracking-tighter">₹{medicineData.genericPrice}</div>
                                            <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">{t("govtHospitalPrice")}</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-end p-6 rounded-2xl bg-slate-100 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-600 opacity-60 grayscale hover:grayscale-0 hover:opacity-100 transition-all cursor-help">
                                        <div className="space-y-1 text-left">
                                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{t("brandedMedicine")}</span>
                                            <div className="text-base font-medium text-slate-500 dark:text-slate-400">{medicineData.brandedName}</div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-xl font-bold text-slate-400 dark:text-slate-500 tracking-tighter">₹{medicineData.brandedPrice}</div>
                                            <span className="text-[9px] text-slate-800 dark:text-slate-400 dark:text-slate-500 uppercase tracking-widest font-bold">{t("marketPrice")}</span>
                                        </div>
                                    </div>
                                </div>

                                <Link href={medicineData.purchaseLink} target="_blank" className="mt-10 block">
                                    <Button className="w-full h-16 bg-[#0D9488] text-slate-800 dark:text-white dark:bg-[#14B8A6] dark:text-slate-900 hover:bg-[#0F766E] dark:hover:bg-[#0D9488] font-bold rounded-2xl shadow-[0_20px_50px_rgba(255,255,255,0.05)] transition-all font-heading uppercase tracking-widest text-sm">
                                        {t("buyOnline")}
                                    </Button>
                                </Link>
                            </div>
                        </motion.div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-[2.5rem] bg-slate-50 dark:bg-slate-800">
                            <Server className="w-12 h-12 text-slate-800 dark:text-white/5 mb-6 animate-pulse" />
                            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500 leading-relaxed max-w-[200px]">
                                {t("searchPrompt")}
                            </p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </GlassCard>
    );
}

/**
 * Kinsman Network - Family Hub with Biometric styling
 */
export function FamilyCardsList() {
    const t = useTranslations("dashboard");
    const { user } = useFirebaseContext();
    const [familyMembers, setFamilyMembers] = useState<any[]>([]);
    const [openDialog, setOpenDialog] = useState(false);
    const [memberEmail, setMemberEmail] = useState("");
    const [newRelation, setNewRelation] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) return;
        const fetchFamily = async () => {
            try {
                const familyRef = doc(db, "users", user.uid, "family", "details");
                const snap = await getDoc(familyRef);
                if (snap.exists() && snap.data().members) {
                    setFamilyMembers(snap.data().members);
                }
            } catch (error) {
                console.warn("Could not load family members.");
            }
        };
        fetchFamily();
    }, [user]);

    const handleAddFamily = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !memberEmail.trim() || !newRelation.trim()) return;

        setLoading(true);
        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("email", "==", memberEmail.toLowerCase().trim()));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                toast.error("Could not find this email address.");
                setLoading(false);
                return;
            }

            const familyUserData = querySnapshot.docs[0].data();
            const familyUserId = querySnapshot.docs[0].id;
            const newMemberName = familyUserData.displayName || memberEmail.split('@')[0];

            const familyRef = doc(db, "users", user.uid, "family", "details");
            const newMember = {
                name: newMemberName,
                relation: newRelation,
                email: memberEmail.toLowerCase().trim(),
                uid: familyUserId
            };

            await setDoc(familyRef, { members: arrayUnion(newMember) }, { merge: true });
            setFamilyMembers(prev => [...prev, newMember]);
            toast.success(`Family member added: ${newMemberName}`);
            setOpenDialog(false);
            setMemberEmail("");
            setNewRelation("");
        } catch (error: any) {
            toast.error("Could not add family member.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <GlassCard className="h-[500px] flex flex-col p-8 border-slate-200 dark:border-slate-700 bg-[#FAFAF9] dark:bg-[#0B1120]/40 backdrop-blur-3xl rounded-[2.5rem]">
            <div className="flex justify-between items-center mb-8 shrink-0 text-left">
                <div className="space-y-1">
                    <h2 className="font-heading font-bold text-2xl flex items-center gap-4 text-slate-800 dark:text-white">
                        <Users className="w-7 h-7 text-[#0D9488] dark:text-[#14B8A6]" />
                        {t("familyMembers")}
                    </h2>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.25em]">{t("connectedAccounts")}</p>
                </div>
                <Badge variant="outline" className="border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400 font-bold text-[10px] tracking-widest px-3 py-1">
                    {t("membersCount", { count: familyMembers.length + 1 })}
                </Badge>
            </div>
            
            <div className="flex flex-col gap-4 overflow-y-auto pb-4 custom-scroll flex-1 pr-2">
                <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                    <DialogTrigger asChild>
                        <motion.div 
                            className="shrink-0 w-full min-h-[100px] rounded-[2rem] border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center gap-4 cursor-pointer hover:bg-slate-200 dark:bg-slate-700 hover:border-[#0D9488]/20 dark:border-[#14B8A6]/20 transition-all group"
                            whileHover={{ scale: 1.01 }}
                        >
                            <div className="w-12 h-12 rounded-2xl border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-400 dark:text-slate-500 group-hover:text-[#0D9488] dark:text-[#14B8A6] transition-colors">
                                <Plus className="w-6 h-6" />
                            </div>
                            <p className="text-[12px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest group-hover:text-slate-800 dark:text-white">{t("addMember")}</p>
                        </motion.div>
                    </DialogTrigger>
                    <DialogContent className="max-w-[450px] bg-[#FAFAF9] dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 shadow-[0_0_100px_rgba(0,0,0,1)] rounded-[3rem] p-10 font-heading overflow-hidden">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-[#0D9488]/5 dark:bg-[#14B8A6]/5 blur-[100px] pointer-events-none" />
                        <DialogHeader className="text-left mb-8 relative z-10">
                            <DialogTitle className="text-3xl font-bold tracking-tighter">{t("addMember")}</DialogTitle>
                            <DialogDescription className="text-slate-500 dark:text-slate-400 font-sans font-light text-base mt-2">
                                {t("linkFamilyDesc")}
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleAddFamily} className="space-y-8 relative z-10">
                            <div className="space-y-3">
                                <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">{t("emailAddress")}</Label>
                                <Input
                                    placeholder="name@example.com"
                                    className="h-16 bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded-2xl text-slate-800 dark:text-white font-sans"
                                    value={memberEmail}
                                    onChange={(e) => setMemberEmail(e.target.value)}
                                    required
                                />
                            </div>
                            <div className="space-y-3">
                                <Label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">{t("relationship")}</Label>
                                <Input
                                    placeholder="Spouse, Sibling, Ward"
                                    className="h-16 bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 rounded-2xl text-slate-800 dark:text-white font-sans"
                                    value={newRelation}
                                    onChange={(e) => setNewRelation(e.target.value)}
                                    required
                                />
                            </div>
                            <Button type="submit" disabled={loading} className="w-full h-16 bg-[#0D9488] text-slate-800 dark:text-white dark:bg-[#14B8A6] dark:text-slate-900 hover:bg-[#0F766E] dark:hover:bg-[#0D9488] font-bold text-lg rounded-2xl transition-all shadow-2xl">
                                {loading ? t("adding") : t("addMember")}
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>

                {familyMembers.map((member, i) => (
                    <motion.div 
                        key={i} 
                        className="shrink-0 w-full min-h-[100px] rounded-[2rem] border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/80 flex items-center gap-5 p-6 hover:bg-slate-200 dark:bg-slate-700 transition-all group cursor-pointer"
                        whileHover={{ scale: 1.01 }}
                    >
                        <div className={`w-14 h-14 shrink-0 rounded-[1.25rem] flex items-center justify-center font-heading font-bold text-xl shadow-2xl transition-transform group-hover:rotate-6 ${i % 2 === 0 ? 'bg-[#0D9488]/10 dark:bg-[#14B8A6]/10 text-[#0D9488] dark:text-[#14B8A6] border border-[#0D9488]/20 dark:border-[#14B8A6]/20' : 'bg-[#0D9488]/10 dark:bg-[#14B8A6]/10 text-[#0D9488] dark:text-[#14B8A6] border border-[#0D9488]/20 dark:border-[#14B8A6]/20'}`}>
                            {member.name?.[0] || 'N'}
                        </div>
                        <div className="text-left space-y-1 overflow-hidden">
                            <p className="text-sm font-bold text-slate-800 dark:text-white tracking-tight leading-tight truncate">{member.name}</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.15em] truncate">{member.relation}</p>
                        </div>
                    </motion.div>
                ))}
            </div>
        </GlassCard>
    );
}

/**
 * Government Schemes - Redesigned as Sovereign Protocols
 */
export function GovSchemesCard() {
    const t = useTranslations("dashboard");
    return (
        <GlassCard className="h-[500px] flex flex-col p-8 border-slate-200 dark:border-slate-700 bg-[#FAFAF9] dark:bg-[#0B1120]/40 backdrop-blur-3xl rounded-[2.5rem]">
            <div className="flex items-center gap-4 mb-8 shrink-0 text-left">
                <div className="p-3 rounded-2xl bg-[#0D9488]/10 dark:bg-[#14B8A6]/10 border border-[#0D9488]/20 dark:border-[#14B8A6]/20">
                    <Shield className="w-6 h-6 text-[#0D9488] dark:text-[#14B8A6]" />
                </div>
                <div className="space-y-0.5">
                    <h2 className="font-heading font-bold text-2xl text-slate-800 dark:text-white">{t("govtSchemes")}</h2>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.25em]">{t("importantBenefits")}</p>
                </div>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto custom-scroll pr-2 pb-2 flex-1">
                {[
                    { title: "Ayushman PM-JAY", desc: "Free healthcare up to ₹5 Lakhs.", icon: ShieldCheck, color: "emerald", link: "https://pmjay.gov.in/" },
                    { title: "ABHA Health ID", desc: "Your digital health record card.", icon: Activity, color: "blue", link: "https://abha.abdm.gov.in/" },
                    { title: "Janani Suraksha", desc: "Help for pregnant mothers.", icon: Activity, color: "fuchsia", link: "https://nhm.gov.in/" }
                ].map((scheme, i) => (
                    <motion.a 
                        key={i} 
                        href={scheme.link}
                        target="_blank"
                        className="block shrink-0 p-6 border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 rounded-[2rem] transition-all hover:bg-slate-200 dark:bg-slate-700 group overflow-hidden relative"
                        whileHover={{ x: 5 }}
                    >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 dark:bg-slate-800 rotate-45 translate-x-12 -translate-y-12" />
                        <div className="flex justify-between items-center relative z-10 text-left">
                            <div className="space-y-2">
                                <h3 className="text-base font-bold text-slate-800 dark:text-white font-heading tracking-tight group-hover:text-[#0D9488] dark:text-[#14B8A6] transition-colors uppercase">
                                    {scheme.title}
                                </h3>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed font-sans">{scheme.desc}</p>
                            </div>
                            <div className="h-10 w-10 shrink-0 flex items-center justify-center text-slate-800 dark:text-slate-400 dark:text-slate-500 group-hover:text-emerald-500 transition-all transform group-hover:translate-x-1">
                                <ChevronRight className="w-6 h-6" />
                            </div>
                        </div>
                    </motion.a>
                ))}
            </div>
        </GlassCard>
    );
}

/**
 * Daily Reminders - Redesigned as Temporal Tasks Component
 */
export function DailyRemindersCard() {
    const { user } = useFirebaseContext();
    const [reminders, setReminders] = useState([
        { id: 1, title: "Check Skin Issue", subtitle: "Scheduled Checkup", checked: true },
        { id: 2, title: "Take Medicines", subtitle: "Daily Task", checked: false }
    ]);
    const [openDialog, setOpenDialog] = useState(false);
    const [newTitle, setNewTitle] = useState("");

    const toggleReminder = (id: number) => {
        setReminders(reminders.map(r => r.id === id ? { ...r, checked: !r.checked } : r));
    };

    return (
        <GlassCard className="h-full flex flex-col p-8 border-slate-200 dark:border-slate-700 bg-[#FAFAF9] dark:bg-[#0B1120]/40 backdrop-blur-3xl rounded-[2.5rem]">
            <div className="flex justify-between items-start mb-10 shrink-0 text-left">
                <div className="space-y-1">
                    <h2 className="font-heading font-bold text-2xl flex items-center gap-4 text-slate-800 dark:text-white">
                        <Clock className="w-7 h-7 text-rose-400" />
                        Daily Reminders
                    </h2>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.25em]">Your health tasks for today</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setOpenDialog(true)} className="h-12 w-12 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 group transition-all shrink-0">
                    <Plus className="w-6 h-6 text-slate-400 dark:text-slate-500 group-hover:text-slate-800 dark:text-white transition-colors" />
                </Button>
            </div>

            <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scroll select-none">
                {reminders.map((r) => (
                    <motion.div
                        key={r.id}
                        className={`p-6 rounded-[2rem] border transition-all cursor-pointer flex justify-between items-center group relative overflow-hidden backdrop-blur-sm ${r.checked ? 'bg-emerald-500/[0.05] border-[#0D9488]/20 dark:border-[#14B8A6]/20 opacity-60' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:border-slate-600'}`}
                        onClick={() => toggleReminder(r.id)}
                        whileTap={{ scale: 0.98 }}
                    >
                        <div className="flex flex-col relative z-10 space-y-1 text-left">
                            <span className={`text-base font-bold font-heading transition-all uppercase tracking-tight ${r.checked ? 'text-[#0D9488] dark:text-[#14B8A6] line-through' : 'text-slate-800 dark:text-slate-700 dark:text-slate-200'}`}>{r.title}</span>
                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-[0.2em]">{r.subtitle}</span>
                        </div>
                        <div className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center border transition-all relative z-10 ${r.checked ? 'bg-emerald-500 border-emerald-500 shadow-[0_0_20px_rgba(0,252,64,0.3)]' : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600'}`}>
                            {r.checked && <Check className="w-6 h-6 text-slate-800 dark:text-white" />}
                        </div>
                    </motion.div>
                ))}
            </div>
            
            <Dialog open={openDialog} onOpenChange={setOpenDialog}>
                <DialogContent className="max-w-[400px] bg-[#FAFAF9] dark:bg-[#0B1120] border border-slate-200 dark:border-slate-700 shadow-3xl rounded-[3rem] p-10 text-slate-800 dark:text-white font-heading">
                    <DialogHeader className="text-center mb-8">
                        <DialogTitle className="text-3xl font-bold tracking-tighter">Add Reminder</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 text-left">
                        <div className="space-y-3">
                            <Label className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">What to remember?</Label>
                            <Input
                                placeholder="E.g., Take medicine..."
                                className="h-16 bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600 rounded-2xl font-sans text-slate-800 dark:text-white"
                                value={newTitle}
                                onChange={(e) => setNewTitle(e.target.value)}
                            />
                        </div>
                        <Button onClick={() => {
                            if (newTitle.trim()) {
                                setReminders([...reminders, { id: Date.now(), title: newTitle, subtitle: "Added by you", checked: false }]);
                                setNewTitle("");
                                setOpenDialog(false);
                                toast.success("Reminder Added");
                            }
                        }} className="w-full h-16 bg-[#0D9488] text-white dark:bg-[#14B8A6] dark:text-slate-900 font-bold text-lg rounded-2xl hover:bg-[#0F766E] dark:hover:bg-[#0D9488] transition-all font-heading">
                            Add Reminder
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </GlassCard>
    );
}

/**
 * SOS Primary Emergency Button
 */
export function EmergencyButton() {
    return (
        <motion.a
            href="tel:108"
            className="flex items-center justify-center gap-4 w-full h-16 bg-rose-600 hover:bg-rose-500 text-slate-800 dark:text-white rounded-[1.5rem] font-bold shadow-[0_20px_40px_rgba(225,29,72,0.2)] transition-all border border-rose-400/20 font-heading tracking-widest text-sm uppercase"
            whileHover={{ y: -4 }}
            whileTap={{ scale: 0.95 }}
        >
            <div className="relative flex h-3 w-3">
                <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></div>
                <div className="relative inline-flex rounded-full h-3 w-3 bg-white"></div>
            </div>
            Call Ambulance (108)
        </motion.a>
    );
}

/**
 * Telemetry Voice Interface Button (Now triggers Full Voice Call UI)
 */
export function VoiceAssistantButton() {
    const [callActive, setCallActive] = useState(false);

    return (
        <>
            <motion.button
                onClick={() => setCallActive(true)}
                className="flex items-center justify-center h-12 w-12 rounded-xl shadow-2xl transition-all backdrop-blur-3xl border bg-[#0D9488]/10 dark:bg-[#14B8A6]/10 border-[#0D9488]/20 dark:border-[#14B8A6]/20 text-[#0D9488] dark:text-[#14B8A6] hover:bg-[#0D9488]/20 dark:bg-[#14B8A6]/20 relative z-10"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title="Start Voice Call"
            >
                <div className="absolute inset-0 bg-[#0D9488]/20 dark:bg-[#14B8A6]/20 rounded-xl blur-md animate-pulse pointer-events-none" />
                <Phone className="h-5 w-5" />
            </motion.button>
            {callActive && <VoiceCallInterface onClose={() => setCallActive(false)} />}
        </>
    );
}
