"use client";
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import styles from './landing.module.css';

export default function HowItWorks() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section 
      id="how-it-works" 
      className={styles.howItWorksSection}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      viewport={{ once: true, margin: "-50px" }}
    >
      <h2 className={styles.howItWorksHeader}>A connected care journey for rural communities</h2>
      <div className={styles.howItWorksGrid}>
        <div className={styles.stepCard}>
          <div className={styles.stepNumber}>1</div>
          <h3 className={styles.stepTitle}>Register and Screen</h3>
          <p className={styles.stepDesc}>An ASHA worker records symptoms, vitals and relevant health information in a guided, multilingual workflow.</p>
        </div>
        <div className={styles.stepCard}>
          <div className={styles.stepNumber}>2</div>
          <h3 className={styles.stepTitle}>Assess Risk</h3>
          <p className={styles.stepDesc}>Protocol-guided AI assistance highlights urgency, red flags and the next recommended care level. It does not replace a doctor’s diagnosis.</p>
        </div>
        <div className={styles.stepCard}>
          <div className={styles.stepNumber}>3</div>
          <h3 className={styles.stepTitle}>Find the Right Facility</h3>
          <p className={styles.stepDesc}>The platform helps identify the appropriate PHC, rural hospital or district facility based on service availability, urgency and location.</p>
        </div>
        <div className={styles.stepCard}>
          <div className={styles.stepNumber}>4</div>
          <h3 className={styles.stepTitle}>Refer and Coordinate</h3>
          <p className={styles.stepDesc}>A referral or appointment request is created with a trackable ID, destination facility and priority level.</p>
        </div>
        <div className={styles.stepCard}>
          <div className={styles.stepNumber}>5</div>
          <h3 className={styles.stepTitle}>Complete and Follow Up</h3>
          <p className={styles.stepDesc}>Workers and facilities update referral status and consultation outcomes while follow-up tasks continue until care is completed.</p>
        </div>
      </div>
    </motion.section>
  );
}
