"use client";
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ShieldAlert, UserCheck, Lock, ActivitySquare } from 'lucide-react';
import styles from './landing.module.css';
import { COMPLIANCE_CLAIMS } from '@/lib/constants/claims';

export default function SafetyPrivacy() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section 
      id="safety"
      className={styles.safetySection}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      viewport={{ once: true, margin: "-50px" }}
    >
      <div>
        <h2 className={styles.safetyTitle}>Designed to assist care—not replace clinicians</h2>
        <p className={styles.safetyDesc} style={{ marginBottom: '2rem', color: '#4b5563' }}>
          CareSanchaar provides risk-oriented guidance and workflow support. It does not independently diagnose, prescribe or replace qualified medical professionals. High-risk cases are escalated to appropriate emergency services or healthcare facilities.
        </p>
        <div className={styles.safetyList}>
          <div className={styles.safetyItem}>
            <ShieldAlert size={24} color="#0d9488" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ display: 'block', color: '#111827' }}>Red-flag escalation</strong>
              <span>Emergency symptoms trigger immediate guidance to contact emergency services and seek urgent care.</span>
            </div>
          </div>
          <div className={styles.safetyItem}>
            <UserCheck size={24} color="#0d9488" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ display: 'block', color: '#111827' }}>Human-in-the-loop</strong>
              <span>AI suggestions remain subject to review by qualified healthcare professionals.</span>
            </div>
          </div>
          <div className={styles.safetyItem}>
            <Lock size={24} color="#0d9488" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ display: 'block', color: '#111827' }}>Consent-based sharing</strong>
              <span>Patient information is shared with workers or facilities only through appropriate access and consent controls.</span>
            </div>
          </div>
          <div className={styles.safetyItem}>
            <ActivitySquare size={24} color="#0d9488" style={{ flexShrink: 0 }} />
            <div>
              <strong style={{ display: 'block', color: '#111827' }}>Audit-ready workflow</strong>
              <span>{COMPLIANCE_CLAIMS.audit}</span>
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
