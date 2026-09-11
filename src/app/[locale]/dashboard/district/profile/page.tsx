"use client";
import { useTranslations } from "next-intl";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { useUser } from "@/firebase/auth/useUser";
import { User, Mail, Shield, Building, Key, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { auth, db } from "@/firebase/clientApp";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";

export default function DistrictProfilePage() {
    const { user } = useUser();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    const [initialData, setInitialData] = useState({
        name: "",
        email: "",
        jurisdiction: "Raipur District Command Center",
        uid: "",
        accessLevel: "Level 4 (District Wide)"
    });
    
    const [formData, setFormData] = useState({
        name: "",
        email: ""
    });

    const [errors, setErrors] = useState({ name: "", email: "" });
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

    const t = useTranslations('district');

    useEffect(() => {
        const fetchProfile = async () => {
            if (!user) return;
            try {
                const docRef = doc(db, `users/${user.uid}`);
                const snap = await getDoc(docRef);
                const data = snap.exists() ? snap.data() : {};
                
                const initial = {
                    name: data.name || user.displayName || "Dr. C. Mishra",
                    email: data.email || user.email || "dmo@caresanchaar.ai",
                    jurisdiction: data.jurisdiction || "Raipur District Command Center",
                    uid: user.uid,
                    accessLevel: data.accessLevel || "Level 4 (District Wide)"
                };
                
                setInitialData(initial);
                setFormData({ name: initial.name, email: initial.email });
            } catch (error) {
                console.error("Failed to load profile:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [user]);

    useEffect(() => {
        setHasUnsavedChanges(formData.name !== initialData.name || formData.email !== initialData.email);
        
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [formData, initialData, hasUnsavedChanges]);

    const validateForm = () => {
        let valid = true;
        const newErrors = { name: "", email: "" };
        
        if (!formData.name.trim()) {
            newErrors.name = "Full Name is required";
            valid = false;
        } else if (formData.name.length < 3) {
            newErrors.name = "Name must be at least 3 characters";
            valid = false;
        }
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!formData.email.trim()) {
            newErrors.email = "Email is required";
            valid = false;
        } else if (!emailRegex.test(formData.email)) {
            newErrors.email = "Invalid email format";
            valid = false;
        }
        
        setErrors(newErrors);
        return valid;
    };

    const handleCancel = () => {
        setFormData({ name: initialData.name, email: initialData.email });
        setErrors({ name: "", email: "" });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || saving) return;
        if (!validateForm()) return;

        setSaving(true);
        try {
            const docRef = doc(db, `users/${user.uid}`);
            await updateDoc(docRef, {
                name: formData.name,
                email: formData.email
            });
            
            if (auth.currentUser) {
                await updateProfile(auth.currentUser, { displayName: formData.name });
            }
            
            setInitialData(prev => ({ ...prev, name: formData.name, email: formData.email }));
            toast.success(t('profile.success'));
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || t('profile.error'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-12">
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{t('profile.title')}</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="col-span-1 shadow-sm border-border bg-card">
                    <CardContent className="p-6 flex flex-col items-center text-center">
                        <div className="h-24 w-24 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4 text-3xl font-bold">
                            {initialData.name ? initialData.name.charAt(0).toUpperCase() : "CM"}
                        </div>
                        <h2 className="text-xl font-bold text-foreground">{initialData.name || t('profile.loading')}</h2>
                        <p className="text-sm text-muted-foreground font-medium">{t('profile.cmo')}</p>
                        <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                            <Shield className="w-3.5 h-3.5" />
                            {t('profile.adminAccess')}
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-1 md:col-span-2 shadow-sm border-border bg-card">
                    <form onSubmit={handleSubmit}>
                        <CardHeader>
                            <CardTitle className="text-lg text-foreground">{t('profile.personalInfo')}</CardTitle>
                            <CardDescription>{t('profile.personalInfoDesc')}</CardDescription>
                            {hasUnsavedChanges && (
                                <div className="mt-2 text-sm text-amber-600 flex items-center gap-1 font-medium bg-amber-50 p-2 rounded-md border border-amber-200">
                                    <AlertCircle className="w-4 h-4" />
                                    {t('profile.unsavedChanges')}
                                </div>
                            )}
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {loading ? (
                                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
                            ) : (
                                <>
                                    <div className="space-y-2">
                                        <Label htmlFor="profile-name" className="text-foreground flex items-center text-xs uppercase tracking-wider font-bold">
                                            <User className="w-4 h-4 mr-2 text-muted-foreground" /> {t('profile.fullName')}
                                        </Label>
                                        <Input 
                                            id="profile-name"
                                            value={formData.name} 
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            className={`font-medium focus-visible:ring-2 ${errors.name ? 'border-red-500 focus-visible:ring-red-500' : 'focus-visible:ring-blue-500'}`}
                                            disabled={saving}
                                        />
                                        {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="profile-email" className="text-foreground flex items-center text-xs uppercase tracking-wider font-bold">
                                            <Mail className="w-4 h-4 mr-2 text-muted-foreground" /> {t('profile.email')}
                                        </Label>
                                        <Input 
                                            id="profile-email"
                                            value={formData.email} 
                                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            type="email"
                                            className={`font-medium focus-visible:ring-2 ${errors.email ? 'border-red-500 focus-visible:ring-red-500' : 'focus-visible:ring-blue-500'}`}
                                            disabled={saving}
                                        />
                                        {errors.email && <p className="text-xs text-red-500 font-medium">{errors.email}</p>}
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="profile-jurisdiction" className="text-muted-foreground flex items-center text-xs uppercase tracking-wider font-bold">
                                            <Building className="w-4 h-4 mr-2" /> {t('profile.jurisdiction')}
                                        </Label>
                                        <Input 
                                            id="profile-jurisdiction"
                                            value={initialData.jurisdiction} 
                                            className="font-medium bg-secondary text-muted-foreground border-transparent cursor-not-allowed" 
                                            disabled
                                            readOnly
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="profile-uid" className="text-muted-foreground flex items-center text-xs uppercase tracking-wider font-bold">
                                                <Key className="w-4 h-4 mr-2" /> {t('profile.uid')}
                                            </Label>
                                            <Input 
                                                id="profile-uid"
                                                value={initialData.uid || "SYS-ADMIN-001"} 
                                                className="font-mono text-sm bg-secondary text-muted-foreground border-transparent cursor-not-allowed" 
                                                disabled
                                                readOnly
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="profile-access" className="text-muted-foreground flex items-center text-xs uppercase tracking-wider font-bold">
                                                <Shield className="w-4 h-4 mr-2" /> {t('profile.accessLevel')}
                                            </Label>
                                            <Input 
                                                id="profile-access"
                                                value={initialData.accessLevel} 
                                                className="font-medium bg-secondary text-muted-foreground border-transparent cursor-not-allowed" 
                                                disabled
                                                readOnly
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </CardContent>
                        <CardFooter className="border-t border-border bg-slate-50 dark:bg-card p-6 flex justify-end gap-3 rounded-b-lg">
                            <Button 
                                type="button" 
                                variant="outline" 
                                className="text-foreground border-border hover:bg-secondary"
                                onClick={handleCancel}
                                disabled={saving || !hasUnsavedChanges}
                            >
                                {t('profile.cancel')}
                            </Button>
                            <Button 
                                type="submit" 
                                disabled={saving || loading || !hasUnsavedChanges} 
                                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                            >
                                {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} 
                                {saving ? t('profile.saving') : t('profile.save')}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </div>
    );
}
