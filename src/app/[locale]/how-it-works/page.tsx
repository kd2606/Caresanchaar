import React from 'react';

export default function HowItWorksPage() {
    return (
        <div className="container mx-auto max-w-4xl py-16 px-4 space-y-8 text-foreground">
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight border-b border-border pb-4">
                How CareSanchaar Works
            </h1>
            
            <p className="text-lg leading-relaxed text-muted-foreground">
                CareSanchaar provides a structured, secure, and offline-capable workflow to connect patients in rural areas with the healthcare facilities they need.
            </p>

            <div className="space-y-6 mt-8">
                <div className="p-6 border border-border rounded-lg shadow-sm">
                    <h3 className="text-xl font-bold mb-2">1. Frontline Intake</h3>
                    <p className="text-muted-foreground">ASHA workers gather basic health information and symptoms during community visits.</p>
                </div>
                
                <div className="p-6 border border-border rounded-lg shadow-sm">
                    <h3 className="text-xl font-bold mb-2">2. Offline Protection</h3>
                    <p className="text-muted-foreground">Data is captured and securely encrypted locally, ensuring no loss of information even in areas with zero connectivity.</p>
                </div>

                <div className="p-6 border border-border rounded-lg shadow-sm">
                    <h3 className="text-xl font-bold mb-2">3. Protocol-Guided Triage</h3>
                    <p className="text-muted-foreground">The system provides risk-oriented guidance, helping frontline workers identify potential red flags and high-risk symptoms.</p>
                </div>

                <div className="p-6 border border-border rounded-lg shadow-sm">
                    <h3 className="text-xl font-bold mb-2">4. Referral Coordination</h3>
                    <p className="text-muted-foreground">Patients are routed to appropriate healthcare facilities based on symptoms and facility availability.</p>
                </div>

                <div className="p-6 border border-border rounded-lg shadow-sm">
                    <h3 className="text-xl font-bold mb-2">5. Secure QR Handoff</h3>
                    <p className="text-muted-foreground">A secure, opaque QR token is generated for the patient, ensuring safe data transfer without exposing raw patient PII on paper.</p>
                </div>

                <div className="p-6 border border-border rounded-lg shadow-sm">
                    <h3 className="text-xl font-bold mb-2">6. MO Review</h3>
                    <p className="text-muted-foreground">Medical Officers review escalated cases and incoming referrals through the District Command portal.</p>
                </div>

                <div className="p-6 border border-border rounded-lg shadow-sm">
                    <h3 className="text-xl font-bold mb-2">7. Facility Coordination & Follow-up</h3>
                    <p className="text-muted-foreground">The care loop is closed as facilities register patient arrivals and schedule follow-ups, ensuring continuity of care.</p>
                </div>
            </div>
        </div>
    );
}
