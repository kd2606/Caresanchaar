import React from 'react';
import Link from 'next/link';
import styles from './landing.module.css';

export default function Footer() {
  return (
    <footer className={styles.footerSection}>
      <div className={styles.footerGrid}>
        <div>
          <div className={styles.navLogo} style={{ marginBottom: '1rem' }}>CareSanchaar</div>
          <p style={{ color: '#6b7280', lineHeight: 1.6, marginBottom: '1rem' }}>
            CareSanchaar is an AI-assisted rural care coordination platform designed to improve access, referral completion and continuity across public-health services.
          </p>
          <p style={{ color: '#4b5563', lineHeight: 1.4, fontSize: '0.75rem' }}>
            <strong>Disclaimer:</strong> CareSanchaar is a healthcare workflow and triage-support prototype. It does not replace professional medical diagnosis, treatment or emergency services. In an emergency, contact local emergency services or visit the nearest healthcare facility.
          </p>
        </div>
        <div>
          <h4 className={styles.footerColTitle}>Product</h4>
          <div className={styles.footerLinks}>
            <Link href="/en/features" className={styles.footerLink}>Features</Link>
            <Link href="/en/how-it-works" className={styles.footerLink}>How It Works</Link>
          </div>
        </div>
        <div>
          <h4 className={styles.footerColTitle}>Resources</h4>
          <div className={styles.footerLinks}>
            <Link href="/en/faq" prefetch={false} className={styles.footerLink}>FAQ</Link>
            <Link href="/en/contact" prefetch={false} className={styles.footerLink}>Contact Support</Link>
          </div>
        </div>
        <div>
          <h4 className={styles.footerColTitle}>Organization</h4>
          <div className={styles.footerLinks}>
            <Link href="/en/about" prefetch={false} className={styles.footerLink}>About Us</Link>
          </div>
        </div>
        <div>
          <h4 className={styles.footerColTitle}>Legal & Safety</h4>
          <div className={styles.footerLinks}>
            <Link href="/en/privacy" prefetch={false} className={styles.footerLink}>Privacy Policy</Link>
            <Link href="/en/security" prefetch={false} className={styles.footerLink}>Security</Link>
            <Link href="/en/disclaimer" prefetch={false} className={styles.footerLink}>Medical Disclaimer</Link>
          </div>
        </div>
        <div>
          <h4 className={styles.footerColTitle}>Access</h4>
          <div className={styles.footerLinks}>
            <Link href="/en/auth/worker" className={styles.footerLink}>ASHA Portal</Link>
            <Link href="/en/auth/district" className={styles.footerLink}>District Command</Link>
          </div>
        </div>
      </div>
      <div className={styles.footerBottom}>
        &copy; {new Date().getFullYear()} CareSanchaar. All rights reserved.
      </div>
    </footer>
  );
}
