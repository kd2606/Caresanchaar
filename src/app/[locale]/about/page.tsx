import React from 'react';

export default function AboutPage() {
    return (
        <div className="container mx-auto max-w-4xl py-16 px-4 space-y-8 text-foreground">
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight border-b border-border pb-4">
                About CareSanchaar
            </h1>
            
            <p className="text-lg leading-relaxed text-muted-foreground">
                In rural and underserved communities, patients often travel long distances only to face fragmented records and disconnected care. CareSanchaar is designed to solve this by providing an offline-first workflow, protocol-guided triage, and secure QR handoff. We connect ASHA workers, Medical Officers, healthcare facilities, and district teams into a single, coordinated care continuity network.
            </p>

            <h2 className="text-2xl font-bold mt-8">Our Approach</h2>
            <ul className="list-disc list-inside text-lg leading-relaxed text-muted-foreground space-y-2">
                <li><strong>Offline-First Workflow:</strong> Enabling frontline workers to capture structured information even in the most remote areas with zero connectivity.</li>
                <li><strong>Protocol-Guided Triage:</strong> Aiding workers with risk review systems to flag urgent cases while preserving clinical judgment.</li>
                <li><strong>Secure QR Handoff:</strong> Ensuring privacy and security by replacing paper slips with encrypted QR tokens.</li>
            </ul>

            <div className="mt-12 p-6 bg-amber-50 dark:bg-amber-950/30 border-l-4 border-amber-500 rounded-r-md">
                <h3 className="text-lg font-bold text-amber-900 dark:text-amber-400 mb-2">Prototype Status Disclosure</h3>
                <p className="text-amber-800 dark:text-amber-500/90">
                    CareSanchaar is currently a production-oriented public-health platform foundation demonstrated with synthetic/staging data.
                </p>
            </div>
        </div>
    );
}
