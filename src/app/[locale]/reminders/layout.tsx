import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Medication & Appointment Reminders | CareSanchaar | Health Worker Portal",
    description: "Keep track of your localized health reminders and pill schedules.",
};

export default function RemindersLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
