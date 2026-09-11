import React from 'react';
import { ShieldAlert, FileSearch, AlertTriangle, BookOpen } from 'lucide-react';
import styles from './landing.module.css';
import { COMPLIANCE_CLAIMS } from '@/lib/constants/claims';

export default function TrustBar() {
  return (
    <section className={styles.trustBarSection}>
      <div className={styles.trustBarGrid}>
        <div className={styles.trustBarItem}>
          <div className={styles.trustBarIcon}>
            <ShieldAlert size={32} />
          </div>
          <div className={styles.trustBarText}>Built with clinical safety guardrails</div>
        </div>
        <div className={styles.trustBarItem}>
          <div className={styles.trustBarIcon}>
            <FileSearch size={32} />
          </div>
          <div className={styles.trustBarText}>{COMPLIANCE_CLAIMS.audit}</div>
        </div>
        <div className={styles.trustBarItem}>
          <div className={styles.trustBarIcon}>
            <AlertTriangle size={32} />
          </div>
          <div className={styles.trustBarText}>Red-flag escalation guidance</div>
        </div>
        <div className={styles.trustBarItem}>
          <div className={styles.trustBarIcon}>
            <BookOpen size={32} />
          </div>
          <div className={styles.trustBarText}>Human-in-the-loop safety pathways</div>
        </div>
      </div>
    </section>
  );
}
