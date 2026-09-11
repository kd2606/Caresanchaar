"use client";

import { useRouter, useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Stethoscope, Heart, User, CheckCircle2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AuthPage() {
  const router = useRouter();
  const params = useParams();
  const locale = params?.locale || "en";

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100">
      {/* Government Branding Strip */}
      <div className="bg-[#1e3a5f] text-white py-2 px-4 text-xs font-medium text-center tracking-wide border-b border-blue-900/50">
        Ministry of Health & Family Welfare | Ayushman Bharat Digital Mission
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 space-y-12">
        {/* Header Section */}
        <div className="text-center space-y-4 max-w-2xl">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <Activity className="w-10 h-10 text-blue-400" />
            <h1 className="text-4xl font-bold tracking-tight text-white">caresanchaar</h1>
          </div>
          <h2 className="text-2xl font-semibold text-slate-200">
            Rural Care Coordination & Digital Triage Platform
          </h2>
          <p className="text-slate-400">
            Select your role to access the national health infrastructure securely.
          </p>
        </div>

        {/* Role Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Health Worker Card */}
          <Card 
            className="group cursor-pointer bg-slate-900 border-slate-800 hover:border-blue-500/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-blue-900/20 overflow-hidden"
            onClick={() => router.push(`/${locale}/auth/worker`)}
          >
            <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
            <CardHeader className="space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-blue-950/50 flex items-center justify-center border border-blue-900/50 group-hover:scale-110 transition-transform duration-300">
                <Shield className="w-8 h-8 text-blue-400" />
                <Stethoscope className="w-4 h-4 text-blue-400 absolute bottom-3 right-3 bg-slate-900 rounded-full" />
              </div>
              <div>
                <CardTitle className="text-2xl text-white">Health Worker</CardTitle>
                <CardDescription className="text-slate-400 mt-2 text-base">
                  (ASHA / ANM / MO)
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 mb-6 h-12">
                Access patient intake, triage tools, and referral management.
              </p>
              <ul className="space-y-3">
                {[
                  "Digital Triage & Symptom Checker",
                  "Secure Patient Record Access",
                  "Teleconsultation Referrals"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start space-x-3 text-sm text-slate-400">
                    <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full mt-8 bg-blue-600 hover:bg-blue-700 text-white" variant="default">
                Login as Worker
              </Button>
            </CardContent>
          </Card>

          {/* Patient / Citizen Card */}
          <Card 
            className="group cursor-pointer bg-slate-900 border-slate-800 hover:border-teal-500/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-teal-900/20 overflow-hidden"
            onClick={() => router.push(`/${locale}/auth/patient`)}
          >
            <div className="h-2 bg-gradient-to-r from-teal-500 to-emerald-500" />
            <CardHeader className="space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-teal-950/50 flex items-center justify-center border border-teal-900/50 group-hover:scale-110 transition-transform duration-300">
                <Heart className="w-8 h-8 text-teal-400" />
                <User className="w-4 h-4 text-teal-400 absolute bottom-3 right-3 bg-slate-900 rounded-full" />
              </div>
              <div>
                <CardTitle className="text-2xl text-white">Patient / Citizen</CardTitle>
                <CardDescription className="text-slate-400 mt-2 text-base">
                  (ABHA ID Holders)
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-slate-300 mb-6 h-12">
                View your health records, prescriptions, and book teleconsultations.
              </p>
              <ul className="space-y-3">
                {[
                  "View E-Prescriptions & Reports",
                  "Book Teleconsultations",
                  "Link Health Records via ABHA"
                ].map((feature, i) => (
                  <li key={i} className="flex items-start space-x-3 text-sm text-slate-400">
                    <CheckCircle2 className="w-5 h-5 text-teal-500 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full mt-8 bg-teal-600 hover:bg-teal-700 text-white" variant="default">
                Login as Patient
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <div className="py-6 text-center text-xs text-slate-500 space-y-1">
        <p>Powered by Ayushman Bharat Digital Mission (ABDM)</p>
        <p>Compliant with Digital Personal Data Protection (DPDP) Act 2023</p>
      </div>
    </div>
  );
}
