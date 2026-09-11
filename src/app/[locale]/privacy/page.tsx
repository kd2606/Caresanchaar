import React from 'react';

export default function PrivacyPage() {
    return (
        <div className="container mx-auto max-w-4xl py-16 px-4 space-y-8 text-foreground">
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight border-b border-border pb-4">
                Privacy Policy
            </h1>
            
            <p className="text-lg leading-relaxed text-muted-foreground">
                At CareSanchaar, we prioritize the privacy and security of health data. We employ multiple layers of protection to ensure information is only accessed by authorized individuals in the care continuum.
            </p>

            <div className="space-y-6 mt-8">
                <h2 className="text-2xl font-bold">Role-Based Access</h2>
                <p className="text-muted-foreground">
                    CareSanchaar strictly enforces role-based access controls via Firebase Auth. ASHA workers, Medical Officers, and District Admins only have access to the data necessary for their specific roles and jurisdictions.
                </p>

                <h2 className="text-2xl font-bold">Local Offline Security</h2>
                <p className="text-muted-foreground">
                    To support offline-first workflows, data is temporarily stored on the device using an encrypted local IndexedDB workflow. This local data is protected by a Web Crypto/PIN boundary, ensuring that if a device is lost or shared, unauthorized users cannot access patient information.
                </p>

                <h2 className="text-2xl font-bold">Secure Handoffs</h2>
                <p className="text-muted-foreground">
                    When a patient is referred, an opaque QR token is generated. This QR code does not contain raw patient Personally Identifiable Information (PII). Instead, it relies on server-side resolution to securely transfer the patient record to the destination facility upon scan.
                </p>
                
                <h2 className="text-2xl font-bold">Data Sync and Cloud Storage</h2>
                <p className="text-muted-foreground">
                    Once online, data is securely synced to our backend infrastructure. While we employ robust security measures for data in transit and at rest, we do not claim full end-to-end encryption for the entire platform workflow at this time.
                </p>
            </div>
        </div>
    );
}
