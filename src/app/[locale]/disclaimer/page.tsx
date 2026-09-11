import React from 'react';

export default function DisclaimerPage() {
    return (
        <div className="container mx-auto max-w-4xl py-16 px-4 space-y-8 text-foreground">
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight border-b border-border pb-4">
                Medical Disclaimer
            </h1>
            
            <div className="p-6 bg-destructive/10 border-l-4 border-destructive rounded-r-md mt-8">
                <h2 className="text-xl font-bold text-destructive mb-2">Not a Substitute for Professional Care</h2>
                <p className="text-foreground">
                    CareSanchaar is a care-coordination platform designed to support frontline health workers and public health facilities. It is <strong>not a substitute for qualified healthcare professionals, professional medical diagnosis, or emergency services</strong>.
                </p>
                <p className="mt-4 text-foreground font-bold">
                    In case of a medical emergency, do not wait for this application. Please contact local emergency services (e.g., dial 108) or visit the nearest hospital immediately.
                </p>
            </div>
            
            <p className="text-lg leading-relaxed text-muted-foreground mt-8">
                Any triage guidance or risk assessments provided by this platform are protocol-guided tools intended to aid coordination and prioritize care. They do not constitute an autonomous diagnosis or treatment plan. All clinical decisions remain the sole responsibility of the attending Medical Officer or healthcare provider.
            </p>
        </div>
    );
}
