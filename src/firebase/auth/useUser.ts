"use client";

import { useFirebaseContext } from "../provider";
import { auth } from "../clientApp";
import {
    signOut as firebaseSignOut,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithRedirect,
    RecaptchaVerifier,
    signInWithPhoneNumber,
    ConfirmationResult,
} from "firebase/auth";
import { useRouter } from "next/navigation";

declare global {
    interface Window {
        recaptchaVerifier: RecaptchaVerifier;
    }
}

export function useUser() {
    const { user, loading } = useFirebaseContext();
    const router = useRouter();

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            router.push("/");
        } catch (error) {
            console.error("Sign out error", error);
        }
    };

    const signInWithGoogle = async () => {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        
        try {
            // Check if we are in a context that supports popups
            const result = await signInWithPopup(auth, provider);
            return result;
        } catch (error: any) {
            // Handle cross-origin or blocked popups
            const isPopupBlocked = error.code === "auth/popup-blocked" || error.code === "auth/popup-closed-by-user" || error.code === "auth/cancelled-popup-request";
            const isCrossOrigin = error.code === "auth/unauthorized-domain" || error.message?.includes("cross-origin");
            
            if (isPopupBlocked || isCrossOrigin) {
                console.warn("Switching to redirect auth interface due to:", error.code);
                // Return null to signify that a redirect has been initiated
                await signInWithRedirect(auth, provider);
                return null; 
            }
            throw error;
        }
    };

    const setupRecaptcha = () => {
        if (!window.recaptchaVerifier) {
            window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
                size: "invisible",
            });
        }
        return window.recaptchaVerifier;
    };

    const sendPhoneCode = async (phoneNumber: string) => {
        const recaptchaVerifier = setupRecaptcha();
        return await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    };

    const verifyPhoneCode = async (confirmationResult: ConfirmationResult, code: string) => {
        await confirmationResult.confirm(code);
    };

    return {
        user,
        loading,
        signOut,
        signInWithGoogle,
        sendPhoneCode,
        verifyPhoneCode,
    };
}
