'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuth } from 'firebase/auth';
import { collection, getDocs, getFirestore, limit, query, where } from 'firebase/firestore';
import type { ReferralRow } from '@/app/api/district/referrals/route';

type Meta = {
  count: number;
  openCount: number;
  breachedCount: number;
  criticalCount: number;
  slaMinutes: number;
  source: string;
};

const SLA_MINUTES = Number(process.env.NEXT_PUBLIC_SLA_MINUTES ?? 60);

function normalize(id: string, data: Record<string, any>): ReferralRow {
  const rawCreated = data.createdAt ?? data.created_at ?? data.syncedAt ?? data.timestamp;
  const created =
    rawCreated?.toDate?.() ??
    (typeof rawCreated === 'string' || typeof rawCreated === 'number' ? new Date(rawCreated) : null);
  const createdAt = created && !Number.isNaN(created.getTime()) ? created.toISOString() : null;
  const status = String(data.status ?? 'pending').toLowerCase().replace(/[\s-]+/g, '_') as ReferralRow['status'];
  const ageMinutes = createdAt ? Math.max(0, Math.round((Date.now() - new Date(createdAt).getTime()) / 60000)) : null;
  const isOpen = !['completed', 'admitted', 'cancelled'].includes(status);

  return {
    id,
    patientName: data.patientName ?? data.patient_name ?? data.name ?? 'Unnamed patient',
    age: Number.isFinite(Number(data.age)) ? Number(data.age) : null,
    gender: data.gender ?? '—',
    village: data.village ?? data.location ?? '—',
    ashaName: data.ashaName ?? data.createdByName ?? 'ASHA Worker',
    reason: data.reason ?? data.referralReason ?? data.symptoms ?? '—',
    urgency: (['critical', 'high', 'routine'].includes(String(data.urgency)) ? data.urgency : 'routine') as ReferralRow['urgency'],
    status: (['pending', 'acknowledged', 'in_transit', 'admitted', 'completed', 'cancelled'].includes(status)
      ? status
      : 'pending') as ReferralRow['status'],
    facilityId: data.facilityId ?? '',
    createdAt,
    updatedAt: null,
    ageMinutes,
    slaBreached: isOpen && ageMinutes !== null && ageMinutes > SLA_MINUTES,
  };
}

export function useDistrictReferrals(facilityId?: string | null, pollMs = 20000) {
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mounted = useRef(true);

  const clientFallback = useCallback(async (fid: string) => {
    const snap = await getDocs(
      query(collection(getFirestore(), 'referrals'), where('facilityId', '==', fid), limit(300)),
    );
    return snap.docs
      .map((d) => normalize(d.id, d.data() as Record<string, any>))
      .sort((a, b) => (b.createdAt ? +new Date(b.createdAt) : 0) - (a.createdAt ? +new Date(a.createdAt) : 0));
  }, []);

  const fetchReferrals = useCallback(async () => {
    try {
      setError(null);
      let token: string | null = null;
      try {
        token = (await getAuth().currentUser?.getIdToken()) ?? null;
      } catch {
        token = null;
      }

      const params = new URLSearchParams();
      if (facilityId) params.set('facilityId', facilityId);

      const res = await fetch(`/api/district/referrals?${params.toString()}`, {
        cache: 'no-store',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const json = await res.json();
      let rows: ReferralRow[] = Array.isArray(json?.referrals) ? json.referrals : [];

      if (rows.length === 0 && facilityId) {
        try {
          const fallbackRows = await clientFallback(facilityId);
          if (fallbackRows.length > 0) rows = fallbackRows;
        } catch {
          /* keep API result */
        }
      }

      if (!mounted.current) return;
      setReferrals(rows);
      setMeta({
        count: rows.length,
        openCount: rows.filter((r) => !['completed', 'admitted', 'cancelled'].includes(r.status)).length,
        breachedCount: rows.filter((r) => r.slaBreached).length,
        criticalCount: rows.filter((r) => r.urgency === 'critical').length,
        slaMinutes: json?.slaMinutes ?? SLA_MINUTES,
        source: json?.source ?? 'client',
      });
      setLastUpdated(new Date());
    } catch (e) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e.message : 'Unable to load referrals');
      setReferrals([]);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [facilityId, clientFallback]);

  useEffect(() => {
    mounted.current = true;
    fetchReferrals();
    const t = pollMs > 0 ? setInterval(fetchReferrals, pollMs) : null;
    return () => {
      mounted.current = false;
      if (t) clearInterval(t);
    };
  }, [fetchReferrals, pollMs]);

  return { referrals, meta, loading, error, lastUpdated, refetch: fetchReferrals };
}
