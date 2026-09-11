"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Menu, X, Activity } from 'lucide-react';
import styles from './landing.module.css';
import { publicNavigationConfig } from '@/lib/config/navigation';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className={styles.navbar}>
      <div className={styles.navLogo}>
        <Activity size={28} />
        <span>CareSanchaar</span>
      </div>
      
      <div className={styles.navLinks}>
        {/* Minimal navbar: inner links removed */}
      </div>

      <div className={styles.navRight}>
        {publicNavigationConfig.showPatientEntry && (
            <Link href="/en/auth/patient" className={styles.navLink} style={{ marginRight: '1rem', fontWeight: 500 }}>Patient Portal</Link>
        )}
        {publicNavigationConfig.showDistrictEntry && (
            <Link href="/en/auth/district" className={styles.btnPrimary} style={{ background: '#0f172a' }}>District Command</Link>
        )}
      </div>

      <button className={styles.mobileMenuBtn} onClick={() => setIsOpen(!isOpen)} aria-label="Toggle menu">
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {isOpen && (
        <div className={styles.mobileDrawer}>
          {publicNavigationConfig.showPatientEntry && (
              <Link href="/en/auth/patient" className={styles.navLink} onClick={() => setIsOpen(false)}>Patient Portal</Link>
          )}
          {publicNavigationConfig.showDistrictEntry && (
              <Link href="/en/auth/district" className={styles.btnPrimary} style={{ textAlign: 'center', marginTop: '1rem', background: '#0f172a' }} onClick={() => setIsOpen(false)}>District Command</Link>
          )}
        </div>
      )}
    </nav>
  );
}
