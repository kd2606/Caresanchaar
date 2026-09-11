import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import styles from './landing.module.css';

export default function PulseShowcase() {
  return (
    <section className={styles.pulseShowcaseSection} style={{ flexDirection: 'column', textAlign: 'center' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h2 className={styles.pulseShowcaseTitle}>From referral creation to care completion</h2>
        <p style={{ color: '#4b5563', marginBottom: '2.5rem', lineHeight: 1.6, fontSize: '1.25rem' }}>
          District teams and facilities can track referral status, service availability, queue coordination and follow-up progress—helping frontline workers close the loop on care.
        </p>
        <ul className={styles.pulseBullets} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', textAlign: 'left' }}>
          <li className={styles.pulseBullet}>
            <CheckCircle2 size={24} className={styles.pulseBulletIcon} style={{ flexShrink: 0 }} />
            <span>View active referrals</span>
          </li>
          <li className={styles.pulseBullet}>
            <CheckCircle2 size={24} className={styles.pulseBulletIcon} style={{ flexShrink: 0 }} />
            <span>Check facility services</span>
          </li>
          <li className={styles.pulseBullet}>
            <CheckCircle2 size={24} className={styles.pulseBulletIcon} style={{ flexShrink: 0 }} />
            <span>Coordinate queue tokens</span>
          </li>
          <li className={styles.pulseBullet}>
            <CheckCircle2 size={24} className={styles.pulseBulletIcon} style={{ flexShrink: 0 }} />
            <span>Track follow-up status</span>
          </li>
          <li className={styles.pulseBullet}>
            <CheckCircle2 size={24} className={styles.pulseBulletIcon} style={{ flexShrink: 0 }} />
            <span>Review high-risk cases</span>
          </li>
          <li className={styles.pulseBullet}>
            <CheckCircle2 size={24} className={styles.pulseBulletIcon} style={{ flexShrink: 0 }} />
            <span>Monitor district-level trends</span>
          </li>
        </ul>
      </div>
    </section>
  );
}
