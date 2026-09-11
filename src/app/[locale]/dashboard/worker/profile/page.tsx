"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { User, Mail, Building, ShieldCheck, Phone, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { auth, db } from "@/firebase/clientApp";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useUser } from "@/firebase/auth/useUser";
import { updateProfile } from "firebase/auth";
import { useTranslations } from "next-intl";

export default function WorkerProfilePage() {
  const t = useTranslations("worker.profile");
  const { user } = useUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phc: "",
    employeeId: "",
    phone: ""
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const docRef = doc(db, `users/${user.uid}`);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setFormData({
            name: data.name || user.displayName || "Health Worker",
            email: data.email || user.email || "worker@caresanchaar.in",
            phc: data.phc || "Block 4 Primary Health Centre",
            employeeId: data.employeeId || "ASHA-2023-8942",
            phone: data.phone || "+91 98765 43210"
          });
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    try {
      const docRef = doc(db, `users/${user.uid}`);
      await updateDoc(docRef, {
        name: formData.name,
        email: formData.email,
        phc: formData.phc,
        phone: formData.phone
      });
      
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { displayName: formData.name });
      }
      
      toast.success(t("success"));
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || t("error"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{t("title")}</h1>
        <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
      </div>

      <Card className="bg-background border-border shadow-xl overflow-hidden">
        <CardHeader className="border-b border-border bg-card/30 pb-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[#0D9488] to-indigo-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-emerald-500/20 border-4 border-[#0B1120]">
              {formData.name ? formData.name.charAt(0).toUpperCase() : "HW"}
            </div>
            <div>
              <CardTitle className="text-2xl text-white">{formData.name || t("healthWorkerDefault")}</CardTitle>
              <CardDescription className="text-emerald-400 font-medium mt-1 uppercase tracking-wider text-xs flex items-center">
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5" />
                {t("verifiedRole")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        
        <form onSubmit={handleSubmit}>
          <CardContent className="p-8 space-y-8">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center text-xs uppercase tracking-wider font-semibold">
                    <User className="w-3.5 h-3.5 mr-2 text-emerald-500" /> {t("fullName")}
                  </Label>
                  <Input 
                    value={formData.name} 
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="bg-card/50 border-border text-white focus-visible:ring-emerald-500 font-medium" 
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center text-xs uppercase tracking-wider font-semibold">
                    <Mail className="w-3.5 h-3.5 mr-2 text-emerald-500" /> {t("email")}
                  </Label>
                  <Input 
                    value={formData.email} 
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    type="email"
                    className="bg-card/50 border-border text-white focus-visible:ring-emerald-500 font-medium" 
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center text-xs uppercase tracking-wider font-semibold">
                    <Building className="w-3.5 h-3.5 mr-2 text-emerald-500" /> {t("assignedPhc")}
                  </Label>
                  <Input 
                    value={formData.phc} 
                    onChange={e => setFormData({ ...formData, phc: e.target.value })}
                    className="bg-card/50 border-border text-white focus-visible:ring-emerald-500 font-medium" 
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center text-xs uppercase tracking-wider font-semibold">
                    <ShieldCheck className="w-3.5 h-3.5 mr-2 text-emerald-500" /> {t("employeeId")}
                  </Label>
                  <Input 
                    value={formData.employeeId} 
                    className="bg-card/50 border-border text-white focus-visible:ring-emerald-500 font-medium" 
                    disabled
                  />
                  <p className="text-[10px] text-muted-foreground">{t("contactAdmin")}</p>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-muted-foreground flex items-center text-xs uppercase tracking-wider font-semibold">
                    <Phone className="w-3.5 h-3.5 mr-2 text-emerald-500" /> {t("contactNumber")}
                  </Label>
                  <Input 
                    value={formData.phone} 
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="bg-card/50 border-border text-white focus-visible:ring-emerald-500 font-medium" 
                  />
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="border-t border-border bg-card/20 p-6 flex justify-end gap-3">
            <Button type="button" variant="ghost" className="text-muted-foreground hover:text-white">{t("cancel")}</Button>
            <Button type="submit" disabled={saving || loading} className="bg-[#0D9488] hover:bg-[#0F766E] text-white font-semibold">
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} 
              {saving ? t("saving") : t("saveChanges")}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
