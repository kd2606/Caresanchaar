import React from 'react';
import Link from 'next/link';
import { ShieldCheck, Lock, Activity, Users } from 'lucide-react';
import styles from './landing.module.css';
import { publicNavigationConfig } from '@/lib/config/navigation';

export default function Hero() {
  const isPublicHealth = publicNavigationConfig.primaryAudience === "public-health";

  return (
    <section className={styles.heroSection}>
      <div className={styles.heroLeft}>
        <p style={{ color: '#0d9488', fontWeight: 600, fontSize: '0.875rem', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '1rem' }}>
          {isPublicHealth ? "AI-ASSISTED PUBLIC HEALTH COORDINATION" : "AI-ASSISTED RURAL CARE COORDINATION"}
        </p>
        <h1 className={styles.heroTitle}>
          Care that reaches. Coordination that connects.
        </h1>
        <p className={styles.heroSubtitle}>
          CareSanchaar helps frontline workers, Medical Officers, facilities, and district teams coordinate care from community intake to referral, queue support, and follow-up—even in low-connectivity settings.
        </p>
        <div className={styles.heroActions} style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
          {publicNavigationConfig.showPatientEntry && (
            <Link href="/en/auth/patient" className={styles.btnPrimary} style={{ background: 'transparent', color: '#64748b', border: '1px solid #cbd5e1' }}>
              Patient Portal
            </Link>
          )}
          {publicNavigationConfig.showDistrictEntry && (
            <Link href="/en/auth/district" className={styles.btnPrimary} style={{ background: '#0f172a' }}>
              District Command
            </Link>
          )}
          {publicNavigationConfig.showWorkerEntry && (
            <Link href="/en/auth/worker" className={styles.btnPrimary} style={{ background: 'transparent', border: '1px solid #0d9488', color: '#0d9488' }}>
              ASHA Worker Portal
            </Link>
          )}
        </div>
        <div className={styles.trustStrip}>
          <div className={styles.trustItem}>
            <ShieldCheck size={18} color="#0d9488" />
            <span>Protocol-Guided</span>
          </div>
          <div className={styles.trustItem}>
            <Lock size={18} color="#0d9488" />
            <span>Consent-Aware Records</span>
          </div>
          <div className={styles.trustItem}>
            <Activity size={18} color="#0d9488" />
            <span>Trackable Referrals</span>
          </div>
          <div className={styles.trustItem}>
            <Users size={18} color="#0d9488" />
            <span>Built for Rural Care</span>
          </div>
        </div>
      </div>
      <div className={styles.heroRight}>
        <div className={styles.phoneMockup}>
          <div className={styles.phoneNotch}></div>
          <div className={styles.workflowApp}>
            <div className={styles.workflowHeader}>
              <div className={styles.workflowBrand}>CareSanchaar Field</div>
              <div className={styles.offlineIndicator}>
                <span className={styles.offlineDot}></span>
                Offline Mode
              </div>
            </div>
            <div className={styles.workflowContent}>

              <div className={styles.workflowCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.caseId}>Case P-042</span>
                  <span className={styles.badgeYellow}>MO Review</span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardRow}>
                    <ShieldCheck size={14} color="#0d9488" />
                    <span>Consent Recorded</span>
                  </div>
                  <div className={styles.cardRow}>
                    <Activity size={14} color="#0d9488" />
                    <span>Offline Intake Saved</span>
                  </div>
                </div>
              </div>

              <div className={styles.workflowCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.caseId}>Referral Assigned</span>
                  <span className={styles.badgeGreen}>Active</span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardRow}>
                    <strong>Facility:</strong> PHC Rural Center
                  </div>
                  <div className={styles.cardRow}>
                    <strong>Token:</strong> A-042
                  </div>
                </div>
              </div>

              <div className={styles.workflowCard}>
                <div className={styles.cardHeader}>
                  <span className={styles.caseId}>Follow-up Due</span>
                  <span className={styles.badgeGray}>In 3 Days</span>
                </div>
              </div>

            </div>
            <div className={styles.workflowFooter}>
              Syncs when online...
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
