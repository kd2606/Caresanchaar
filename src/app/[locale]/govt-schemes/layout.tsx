import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Government Health Schemes | CareSanchaar | Health Worker Portal",
    description: "Discover government health schemes tailored to your profile.",
};

export default function GovtSchemesLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
