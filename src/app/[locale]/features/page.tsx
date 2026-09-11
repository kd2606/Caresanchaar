import React from 'react';

export default function FeaturesPage() {
    return (
        <div className="container mx-auto max-w-4xl py-16 px-4 space-y-8 text-foreground">
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight border-b border-border pb-4">
                CareSanchaar Features
            </h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
                <div className="p-6 bg-card border border-border rounded-lg">
                    <h2 className="text-2xl font-bold mb-4 text-primary">ASHA Workflow</h2>
                    <p className="text-muted-foreground">Empowers ASHA workers with an offline-ready, intuitive interface to record vitals and symptoms securely during field visits.</p>
                </div>
                
                <div className="p-6 bg-card border border-border rounded-lg">
                    <h2 className="text-2xl font-bold mb-4 text-primary">MO Coordination</h2>
                    <p className="text-muted-foreground">Enables Medical Officers to review flagged cases efficiently and provide timely intervention and guidance.</p>
                </div>

                <div className="p-6 bg-card border border-border rounded-lg">
                    <h2 className="text-2xl font-bold mb-4 text-primary">Secure Referral Handoff</h2>
                    <p className="text-muted-foreground">Utilizes an opaque QR token with server-side resolution to hand off patient data. No raw patient PII is stored on the physical QR.</p>
                </div>
                
                <div className="p-6 bg-card border border-border rounded-lg">
                    <h2 className="text-2xl font-bold mb-4 text-primary">District Command</h2>
                    <p className="text-muted-foreground">A central hub for district health teams to monitor facility loads, track referral completion rates, and manage regional health resources.</p>
                </div>
                
                <div className="p-6 bg-card border border-border rounded-lg md:col-span-2">
                    <h2 className="text-2xl font-bold mb-4 text-primary">Continuity of Care</h2>
                    <p className="text-muted-foreground">Closes the loop between community intake and facility discharge, providing a unified patient journey that improves health outcomes.</p>
                </div>
            </div>
        </div>
    );
}
