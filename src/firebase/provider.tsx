"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, getRedirectResult } from "firebase/auth";
import { auth, db } from "./clientApp";
import { doc, setDoc } from "firebase/firestore";

interface FirebaseContextType {
    user: User | null;
    loading: boolean;
}

const FirebaseContext = createContext<FirebaseContextType>({
    user: null,
    loading: true,
});

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!auth) {
            setTimeout(() => setLoading(false), 0);
            return;
        }

        // Handle redirect result (from signInWithRedirect)
        const handleRedirect = async () => {
            try {
                const result = await getRedirectResult(auth);
                if (result?.user) {
                    // Redirect sign-in successful
                }
            } catch (error: any) {
                console.error("Critical Redirect sign-in error:", error);
            }
        };

        handleRedirect();

        const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
            // Set user and loading state IMMEDIATELY so UI doesn't hang
            setUser(firebaseUser);
            setLoading(false);

            if (firebaseUser && db) {
                // Sync minimal profile logic in the background (fire and forget)
                const userProfileRef = doc(db, "users", firebaseUser.uid, "profile", "data");
                setDoc(
                    userProfileRef,
                    {
                        email: firebaseUser.email,
                        displayName: firebaseUser.displayName,
                        photoURL: firebaseUser.photoURL,
                        lastLogin: new Date().toISOString(),
                    },
                    { merge: true }
                ).catch((e) => {
                    console.warn("Could not sync profile (offline or blocked)", e);
                });
            }
        });

        return () => unsubscribe();
    }, []);


    return (
        <FirebaseContext.Provider value={{ user, loading }}>
            {children}
        </FirebaseContext.Provider>
    );
}

export const useFirebaseContext = () => useContext(FirebaseContext);

