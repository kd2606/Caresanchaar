import React from 'react';

export default function SecurityPage() {
    return (
        <div className="container mx-auto max-w-4xl py-16 px-4 space-y-8 text-foreground">
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight border-b border-border pb-4">
                Security Overview
            </h1>
            
            <p className="text-lg leading-relaxed text-muted-foreground">
                Security is foundational to the CareSanchaar architecture. We utilize modern web and cloud security practices to protect sensitive public health data.
            </p>

            <ul className="list-disc list-inside space-y-4 text-lg text-muted-foreground mt-8">
                <li><strong>Firebase Auth:</strong> Secure, token-based authentication handles identity verification for all system roles.</li>
                <li><strong>Web Crypto/PIN Boundary:</strong> A device-level PIN uses the Web Crypto API to derive encryption keys, securing the offline IndexedDB storage.</li>
                <li><strong>Opaque Referral Tokens:</strong> QR codes generated for patient handoffs contain only reference IDs, requiring authenticated server-side resolution to retrieve clinical data.</li>
                <li><strong>Role-Based Access Control (RBAC):</strong> Firestore security rules ensure that data is only accessible to users with the appropriate authenticated role.</li>
            </ul>
        </div>
    );
}
