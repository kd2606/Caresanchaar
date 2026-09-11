import React from 'react';
import Link from 'next/link';
import styles from './landing.module.css';

export default function FinalCta() {
  return (
    <section className={styles.ctaSection}>
      <h2 className={styles.ctaTitle}>Make every referral count.</h2>
      <p className={styles.ctaText}>Help rural patients move from symptoms to timely, connected care—with frontline workers and public-health facilities working as one system.</p>
      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginTop: '1.5rem' }}>
        <Link href="/en/auth/district" className={styles.btnPrimary} style={{ background: '#0f172a', border: '1px solid #0f172a' }}>
          District Command
        </Link>
        <Link href="/en/auth/worker" className={styles.btnPrimary} style={{ background: 'transparent', border: '1px solid white' }}>
          ASHA Worker Portal
        </Link>
      </div>
    </section>
  );
}
