import React from 'react';

export default function FAQPage() {
    return (
        <div className="container mx-auto max-w-4xl py-16 px-4 space-y-8 text-foreground">
            <h1 className="text-4xl font-extrabold tracking-tight leading-tight border-b border-border pb-4">
                Frequently Asked Questions
            </h1>
            
            <div className="space-y-8 mt-8">
                <div>
                    <h3 className="text-2xl font-bold mb-2">How does the offline capability work?</h3>
                    <p className="text-muted-foreground">
                        CareSanchaar is designed as a Progressive Web App (PWA). Once loaded, ASHA workers can use the app without an internet connection. Intake data and triage assessments are securely encrypted and stored locally on the device. When connectivity is restored, the data automatically syncs with the central database.
                    </p>
                </div>
                
                <div>
                    <h3 className="text-2xl font-bold mb-2">Are patient details stored in the QR code?</h3>
                    <p className="text-muted-foreground">
                        No. The QR code generated for referrals is an opaque token. It does not contain any raw patient Personally Identifiable Information (PII). When the receiving facility scans the QR code, the system securely resolves the token on the server side to fetch the patient's record.
                    </p>
                </div>

                <div>
                    <h3 className="text-2xl font-bold mb-2">Is this a live clinical application?</h3>
                    <p className="text-muted-foreground">
                        CareSanchaar is currently a production-oriented public-health platform foundation. All demonstrations use synthetic/staging data. It is not currently integrated with live hospital systems or deployed for active clinical use.
                    </p>
                </div>
            </div>
        </div>
    );
}
