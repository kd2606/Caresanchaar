import { db } from "../clientApp";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export type ScanType =
    | "visionScans"
    | "coughAnalyses"
    | "skinScans"
    | "mentalHealthScreens"
    | "cardioScreens";

export function useScanStore() {
    const saveScan = async (userId: string, personId: string, scanType: ScanType, data: any) => {
        if (!userId || !personId) throw new Error("Missing user or person ID");

        const collectionRef = collection(db, "users", userId, "people", personId, scanType);

        const docRef = await addDoc(collectionRef, {
            ...data,
            createdAt: serverTimestamp(),
        });

        return docRef.id;
    };

    return { saveScan };
}
