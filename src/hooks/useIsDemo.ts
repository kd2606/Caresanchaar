"use client";

import { useUser } from "@/firebase/auth/useUser";

const DEMO_EMAIL = "demo@caresanchaarai.in";

/**
 * Returns true if the current logged-in user is the demo account.
 * Safe to call in any client component.
 */
export function useIsDemo(): boolean {
    const { user } = useUser();
    return user?.email === DEMO_EMAIL;
}
