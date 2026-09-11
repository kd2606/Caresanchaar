import React from 'react';
import Link from 'next/link';
import styles from './landing.module.css';

export default function AshaSection() {
  return (
    <section id="workers" className={styles.ashaSection}>
      <div className={styles.ashaContainer}>
        <h2 className={styles.ashaTitle}>Put practical clinical intelligence in the hands of frontline workers.</h2>
        <p className={styles.ashaDesc}>
          CareSanchaar gives ASHA workers a simple, offline-ready workspace to record cases, record vitals, identify high-risk cases, coordinate referrals and follow up after the patient reaches a facility.
        </p>
        <Link href="/en/auth/worker" className={styles.btnPrimary} style={{ marginTop: '1.5rem', display: 'inline-block' }}>
          Explore the Worker Workflow
        </Link>
      </div>
    </section>
  );
}
