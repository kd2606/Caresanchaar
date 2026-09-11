import React from "react";

export default function ContactPage() {
    return (
        <div className="min-h-screen bg-[#0B1120] text-slate-300 font-sans">
            <main className="max-w-4xl mx-auto px-6 py-16 prose prose-invert prose-slate">
                <h1 className="text-[#F8FAFC] font-bold tracking-tight mb-8">Institutional Communications & Clinical Validation Channels</h1>
                
                <h2 className="text-[#F8FAFC] font-bold mt-12 mb-4">1. Primary Health Centre (PHC) Pilot Engagements</h2>
                <p className="leading-relaxed mb-6">
                    We are actively reviewing deployment proposals for randomized, 50-user controlled clinical pilot programs in collaboration with rural Primary Health Centres (PHCs) and district administrative boards. Our field deployment roadmap relies on direct coordination with localized frontline workers to fine-tune the PWA interface under real-world 2G/3G constraints.
                </p>

                <h2 className="text-[#F8FAFC] font-bold mt-12 mb-4">2. Technical and Engineering Infrastructure Inquiries</h2>
                <p className="leading-relaxed mb-4">
                    For code validation queries, security disclosure reports, architectural audits, or issues related to the underlying edge data sync pipelines:
                </p>
                <ul className="list-disc pl-6 mb-6 space-y-2">
                    <li><strong>Lead Architecture Channel:</strong> <a href="mailto:tech@caresanchaar.ai" className="text-emerald-400 hover:text-emerald-300">tech@caresanchaar.ai</a></li>
                    <li><strong>Direct Founder Desk:</strong> <a href="mailto:krrish@caresanchaar.ai" className="text-emerald-400 hover:text-emerald-300">krrish@caresanchaar.ai</a></li>
                </ul>

                <h2 className="text-[#F8FAFC] font-bold mt-12 mb-4">3. Medical Advisory & Regulatory Research Partnerships</h2>
                <p className="leading-relaxed mb-4">
                    Licensed practitioners (MBBS/MD/DNB), epidemiological researchers, and public health NGOs looking to evaluate our multimodal triage metrics or participate in software-as-a-medical-device (SaMD) quality validation protocols can reach our administrative intake channel:
                </p>
                <ul className="list-disc pl-6 mb-6 space-y-2">
                    <li><strong>Clinical Integration Queue:</strong> <a href="mailto:research@caresanchaar.ai" className="text-emerald-400 hover:text-emerald-300">research@caresanchaar.ai</a></li>
                    <li><strong>Emergency Escalation Reference:</strong> <a href="mailto:legal@caresanchaar.ai" className="text-emerald-400 hover:text-emerald-300">legal@caresanchaar.ai</a></li>
                </ul>
            </main>
        </div>
    );
}
