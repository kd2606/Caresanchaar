"use client";
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './landing.module.css';

export default function DataProblem() {
  const shouldReduceMotion = useReducedMotion();
  
  return (
    <motion.section 
      id="impact"
      className={styles.dataProblemSection}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      viewport={{ once: true, margin: "-50px" }}
    >
      <h2 className={styles.dataProblemHeader}>Built for measurable public-health impact</h2>
      <div className={styles.dataProblemGrid} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2rem' }}>
        <div className={styles.dataProblemCol} style={{ flex: '1 1 250px', maxWidth: '300px' }}>
          <div className={styles.dataProblemNumber} style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Less avoidable travel</div>
          <div className={styles.dataProblemText}>through facility and service visibility.</div>
        </div>
        <div className={styles.dataProblemCol} style={{ flex: '1 1 250px', maxWidth: '300px' }}>
          <div className={styles.dataProblemNumber} style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Faster referrals</div>
          <div className={styles.dataProblemText}>through trackable handoffs.</div>
        </div>
        <div className={styles.dataProblemCol} style={{ flex: '1 1 250px', maxWidth: '300px' }}>
          <div className={styles.dataProblemNumber} style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Better continuity</div>
          <div className={styles.dataProblemText}>through longitudinal records.</div>
        </div>
        <div className={styles.dataProblemCol} style={{ flex: '1 1 250px', maxWidth: '300px' }}>
          <div className={styles.dataProblemNumber} style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Stronger follow-up</div>
          <div className={styles.dataProblemText}>for maternal, child and chronic-care patients.</div>
        </div>
        <div className={styles.dataProblemCol} style={{ flex: '1 1 250px', maxWidth: '300px' }}>
          <div className={styles.dataProblemNumber} style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Higher accountability</div>
          <div className={styles.dataProblemText}>through facility-level dashboards.</div>
        </div>
      </div>
    </motion.section>
  );
}
