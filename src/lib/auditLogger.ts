import { db } from "@/firebase/clientApp";
import { collection, addDoc } from "firebase/firestore";
import crypto from "crypto";

export const logAudit = (route: string, triagePriority: string, payloadStr: string) => {
    if (!db) return;
    
    // Fire and forget async log
    setTimeout(() => {
        try {
            const anonymized_hash = crypto.createHash("sha256").update(payloadStr).digest("hex");
            addDoc(collection(db, "audit_logs"), {
                timestamp: new Date().toISOString(),
                route,
                triagePriority,
                anonymized_hash
            }).catch((err) => console.error("Audit log failed:", err));
        } catch (e) {
            console.error("Audit log hash failed:", e);
        }
    }, 0);
};
