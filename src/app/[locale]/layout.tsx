import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Plus_Jakarta_Sans, DM_Sans, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { FirebaseProvider } from "@/firebase/provider";
import { Toaster } from "@/components/ui/sonner";
import { PatientLayoutWrapper } from "@/components/patient-layout-wrapper";
import { RoleSwitcher } from "@/components/role-switcher";
import "../globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
    variable: "--font-plus-jakarta-sans",
    subsets: ["latin"],
});

const dmSans = DM_Sans({
    variable: "--font-dm-sans",
    subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
    variable: "--font-space-grotesk",
    subsets: ["latin"],
});

type Props = {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
};

export default async function LocaleLayout({ children, params }: Props) {
    const { locale } = await params;

    // Validate locale
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (!routing.locales.includes(locale as any)) {
        notFound();
    }

    const messages = await getMessages();

    return (
        <html lang={locale} suppressHydrationWarning>
            <body
                className={`${plusJakartaSans.variable} ${dmSans.variable} ${spaceGrotesk.variable} font-sans antialiased`}
                suppressHydrationWarning
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    forcedTheme="dark"
                    disableTransitionOnChange
                >
                    <NextIntlClientProvider messages={messages}>
                        <FirebaseProvider>
                            <PatientLayoutWrapper locale={locale}>
                                {children}
                            </PatientLayoutWrapper>
                            <Toaster />
                            <RoleSwitcher />
                        </FirebaseProvider>
                    </NextIntlClientProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
