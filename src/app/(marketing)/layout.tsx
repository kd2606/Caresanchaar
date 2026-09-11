import type { Metadata } from "next";
import { Inter, Noto_Sans_Devanagari } from "next/font/google";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  variable: "--font-noto-sans-devanagari",
  weight: ["400", "500", "600", "700"],
  subsets: ["devanagari"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://caresanchaar.com"),
  title: "CareSanchaar | Health Worker Portal",
  description:
    "CareSanchaar is an offline-first public-health care-coordination platform that connects ASHA workers, Medical Officers, healthcare facilities, and district teams.",
  icons: {
    icon: "/icon.svg",
  },
  alternates: {
    languages: {
      "en-IN": "https://caresanchaar.com/en",
      "hi-IN": "https://caresanchaar.com/hi",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "CareSanchaar",
        url: "https://caresanchaar.com",
        logo: "https://caresanchaar.com/icon.svg",
        description:
          "CareSanchaar is an offline-first public-health care-coordination platform that connects ASHA workers, Medical Officers, healthcare facilities, and district teams across intake, triage, referral, queue, and follow-up workflows.",
      },
      {
        "@type": "MedicalWebPage",
        name: "CareSanchaar | Health Worker Portal",
        description:
          "CareSanchaar is an offline-first public-health care-coordination platform that connects ASHA workers, Medical Officers, healthcare facilities, and district teams across intake, triage, referral, queue, and follow-up workflows.",
        url: "https://caresanchaar.com",
      },
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className={`${inter.variable} ${notoSansDevanagari.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
