import Navbar from "@/components/landing/navbar";
import Hero from "@/components/landing/hero";
import TrustBar from "@/components/landing/trust-bar";
import DataProblem from "@/components/landing/data-problem";
import FeatureGrid from "@/components/landing/feature-grid";
import HowItWorks from "@/components/landing/how-it-works";
import AshaSection from "@/components/landing/asha-section";
import PulseShowcase from "@/components/landing/pulse-showcase";
import SafetyPrivacy from "@/components/landing/safety-privacy";
import FinalCta from "@/components/landing/final-cta";
import Footer from "@/components/landing/footer";

export default function LandingPage() {
    return (
        <div style={{ backgroundColor: '#ffffff', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <main style={{ flex: 1 }}>
                <Hero />
                <TrustBar />
                <DataProblem />
                <FeatureGrid />
                <HowItWorks />
                <AshaSection />
                <PulseShowcase />
                <SafetyPrivacy />
                <FinalCta />
            </main>
            <Footer />
        </div>
    );
}
