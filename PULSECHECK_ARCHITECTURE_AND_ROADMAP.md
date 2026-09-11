# PulseCheck AI: Real-World Architecture & Deployment Roadmap

## The Core Mission: A Lifeline for Rural Healthcare
PulseCheck AI (DiagnoVerse) is not a conceptual prototype; it is built as a real-world lifeline for people in deep rural India where the nearest doctor might be 50 kilometers away. Our architecture is engineered around the harsh realities of the ground: erratic internet, low digital literacy, and lack of immediate emergency care. We are not replacing doctors; we are bridging the critical "golden hour" gap, providing instant triage, and directing patients to the right care before a minor symptom becomes a fatality.

## Phase 1: Current Capabilities & Ground Infrastructure
Our current architecture prioritizes absolute resilience. If a user is panicking because a family member is sick, the app must work instantly, even on a patchy 2G connection.

*   **Offline-First & Resilience:**
    *   **PWA & Service Workers:** The platform functions as a Progressive Web App (PWA). Service workers cache the entire interface so the app opens instantly even with zero network connectivity.
    *   **IndexedDB Sync:** Instead of failing when the internet drops, we use a robust IndexedDB queue. If a user takes a picture of a skin infection in an offline zone, the 8MB payload is saved safely on the device and automatically syncs to our AI engines the moment they step into a network zone.
    *   **Graceful Degradation:** If our servers face high load, the app does not crash. It displays a 30-second visual cooldown and falls back to deterministic, pre-loaded emergency advice to ensure the user is never left helpless.

*   **Zero-Friction Accessibility for the Elderly & Illiterate:**
    *   **Native Call Experience:** We built a Full-Screen Voice Call Interface because typing complex medical symptoms is impossible for many rural users. They can simply press a button and "talk" to the app just like a phone call.
    *   **Edge-Processed Voice & Native Languages:** We currently use the browser's Web Speech API for real-time STT/TTS in Hindi and regional languages (`next-intl`) to bypass heavy server-side processing. However, recognizing this as an MVP limitation (browser dependency and variance), our Phase 2 architectural shift includes deploying **offline Vosk WASM** directly in the PWA for true zero-network, highly accurate Indic language STT.

*   **Clinical Safety & The Triage Engine:**
    *   **Live AI Integration:** Powered by `gemini-1.5-flash`, the engine processes visual inputs (Skin/Vision scans), audio waveforms (Cough Analysis), and text.
    *   **Hardcoded Red-Flag Overrides:** AI can make mistakes, but emergencies cannot wait. If the app detects keywords like "Chest Pain" or "Sudden Weakness," it instantly bypasses the AI and flashes a big red screen instructing the user to call 108 (Ambulance), removing any risk of hallucination during a heart attack or stroke.
    *   **Geospatial Intelligence:** Using Overpass API, we dynamically fetch real-world Primary Health Centres (PHCs) based on the user's GPS, telling them exactly where to go.

## Phase 2: Deep Deployment & Clinical Maturation
To truly scale this across thousands of villages, our roadmap is focused on deep integration with India's public health infrastructure and rigorous medical safety.

*   **Connecting to the National Grid (ABDM):**
    *   **ABHA Integration:** We will integrate natively with the Ayushman Bharat Digital Mission (ABDM). When a user gets a triage summary from our AI, it will be linked to their 14-digit ABHA ID, allowing rural government hospital doctors to instantly pull up their history via the Unified Health Interface (UHI).

*   **The "Human-in-the-Loop" Reality Check:**
    *   We are building a secure Doctor Dashboard for ASHA workers and local PHC doctors. The AI will pre-process the patient's symptoms, translate them into clinical terms, and generate a summary. A real human doctor will review this with 1-click approval before any definitive diagnosis is given.

*   **Reaching the Unconnected (Omnichannel Fallback):**
    *   Not everyone has a smartphone. We will deploy lightweight WhatsApp Business API bots and Automated SMS Gateways. A user with a basic feature phone can send an SMS or WhatsApp voice note and receive the same life-saving triage guidance.

*   **Clinical Grade Privacy & Security:**
    *   **Federated Learning:** To improve our computer vision (e.g., detecting regional skin diseases) without violating privacy, models will train locally on the user's device. Only anonymous weight updates—never personal photos—will be sent back to us.
    *   **E2EE & DPDP Act 2023 Compliance:** Full End-to-End Encryption for all health records to align strictly with India's **Digital Personal Data Protection (DPDP) Act 2023** and the **NDHM's Health Data Management Policy**, ensuring rural citizens have the same data privacy rights as those in top private hospitals.
    *   **Audit Log & Liability:** To meet CDSCO Software as a Medical Device (SaMD) requirements, we implement rigorous, append-only server-side audit logging (`audit_logs` collection). Every API interaction, AI triage output, and emergency override is cryptographically hashed and time-stamped, providing a tamper-proof liability trail without storing raw PII.

*   **Affordable Wearable Integration:**
    *   We will implement Bluetooth Low Energy (BLE) protocols to connect the PWA directly to $15 smart pulse oximeters and portable ECGs deployed at local Panchayat levels, streaming real-time objective vitals to counter subjective human error.
