"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useUser } from "@/firebase/auth/useUser";
import Link from "next/link";
import { useParams } from "next/navigation";

const DEMO_EMAIL = "demo@caresanchaarai.in";

export function DemoBanner() {
    const { user } = useUser();
    const params = useParams();
    const locale = (params?.locale as string) ?? "en";
    const [dismissed, setDismissed] = useState(false);

    // Reset dismissal each visit (sessionStorage so it hides per tab session)
    useEffect(() => {
        const wasDismissed = sessionStorage.getItem("demoBannerDismissed") === "true";
        setTimeout(() => setDismissed(wasDismissed), 0);
    }, []);

    const dismiss = () => {
        sessionStorage.setItem("demoBannerDismissed", "true");
        setDismissed(true);
    };

    const isDemo = user?.email === DEMO_EMAIL;
    if (!isDemo || dismissed) return null;

    return (
        <div
            style={{
                position: "sticky",
                top: 0,
                zIndex: 100,
                background: "linear-gradient(90deg, #92400e 0%, #78350f 100%)",
                borderBottom: "1px solid rgba(251,191,36,0.4)",
            }}
        >
            <div
                style={{
                    maxWidth: 1200,
                    margin: "0 auto",
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 18 }}>👋</span>
                    <div>
                        <span style={{ fontWeight: 700, color: "#fef3c7", fontSize: 14 }}>
                            You&apos;re in Demo Mode
                        </span>
                        <span style={{ color: "#fcd34d", fontSize: 13, marginLeft: 8 }}>
                            — Sign up free to save your data and unlock all features
                        </span>
                    </div>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Link
                        href={`/${locale}/signup`}
                        style={{
                            background: "#fbbf24",
                            color: "#78350f",
                            fontWeight: 700,
                            fontSize: 13,
                            padding: "6px 16px",
                            borderRadius: 7,
                            textDecoration: "none",
                            whiteSpace: "nowrap",
                        }}
                    >
                        Sign Up Free →
                    </Link>
                    <button
                        onClick={dismiss}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#fcd34d", padding: 4 }}
                        aria-label="Dismiss demo banner"
                    >
                        <X size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
}
