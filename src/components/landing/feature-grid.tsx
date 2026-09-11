"use client";
import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, ArrowRightCircle, MessageCircleHeart, FileHeart, MapPin, Users, WifiOff, LayoutDashboard } from 'lucide-react';
import styles from './landing.module.css';

export default function FeatureGrid() {
  const shouldReduceMotion = useReducedMotion();
  const features = [
    {
      icon: <Activity size={32} />,
      title: "Assisted Digital Triage",
      desc: "Capture symptoms, vitals and red flags through a guided workflow. CareSanchaar helps frontline workers prioritize cases while keeping clinical decisions with qualified professionals."
    },
    {
      icon: <ArrowRightCircle size={32} />,
      title: "Smart Referral Tracking",
      desc: "Create, track and close referrals across sub-centres, PHCs, rural hospitals and district facilities with a clear status timeline."
    },
    {
      icon: <MessageCircleHeart size={32} />,
      title: "Appointment and Queue Coordination",
      desc: "Coordinate appointment requests, queue tokens and facility handoffs so patients and frontline workers have clearer next steps before travelling."
    },
    {
      icon: <FileHeart size={32} />,
      title: "Longitudinal Health Records",
      desc: "Maintain consent-aware longitudinal records for visits, vitals, referrals, consultation outcomes and follow-up tasks across the care journey."
    },
    {
      icon: <MapPin size={32} />,
      title: "Facility and Service Visibility",
      desc: "Help workers identify available facility services, referral destinations and suitable care locations before travelling."
    },
    {
      icon: <Users size={32} />,
      title: "Follow-up for High-Risk Families",
      desc: "Support ASHA workers with follow-up tasks and referral-closure tracking for high-risk maternal, child and chronic-care cases."
    },
    {
      icon: <WifiOff size={32} />,
      title: "Offline-First Field Work",
      desc: "Record patient information in low-connectivity areas and securely synchronize it when the network becomes available."
    },
    {
      icon: <LayoutDashboard size={32} />,
      title: "District Coordination Dashboard",
      desc: "Give district teams visibility into referral completion, follow-up status, high-risk cases, facility services and coordination trends."
    }
  ];

  return (
    <motion.section 
      id="features"
      className={styles.featureGridSection}
      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      viewport={{ once: true, margin: "-50px" }}
    >
      <div className={styles.featureGridContainer}>
        <div className={styles.featureGridHeader}>
          <h2 className={styles.featureGridTitle}>From first contact to completed care</h2>
          <p className={styles.featureCardDesc}>CareSanchaar strengthens the public-health system by helping frontline workers identify risk, coordinate services and close the loop on every referral.</p>
        </div>
        <div className={styles.featureGridGrid}>
          {features.map((feature, idx) => (
            <div key={idx} className={styles.featureCard}>
              <div className={styles.featureCardIcon}>
                {feature.icon}
              </div>
              <h3 className={styles.featureCardTitle}>{feature.title}</h3>
              <p className={styles.featureCardDesc}>{feature.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.section>
  );
}
