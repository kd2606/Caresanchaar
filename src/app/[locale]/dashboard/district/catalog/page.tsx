'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';
import { useAuthClaims } from '@/hooks/useAuthClaims';

/* ------------------------------------------------------------------ *
 * i18n guard
 * ------------------------------------------------------------------ */
function useSafeT(namespace?: string) {
  const t = useTranslations(namespace as never);
  return useCallback(
    (key: string, fallback: string) => {
      try {
        const v = t(key as never) as unknown as string;
        return !v || v.includes(key) ? fallback : v;
      } catch {
        return fallback;
      }
    },
    [t]
  );
}

/* ------------------------------------------------------------------ *
 * Authorization
 * ------------------------------------------------------------------ */

type Claims = Record<string, any> | null;

const ALLOWED_ROLES = new Set(['mo', 'admin', 'dmo', 'district_mo', 'district_admin', 'medical_officer']);

export function isFacilityManager(claims: Claims): boolean {
  if (!claims) return false;
  if (claims.admin === true || claims.admin === 'true') return true;

  const single = typeof claims.role === 'string' ? claims.role.toLowerCase().trim() : '';
  if (ALLOWED_ROLES.has(single)) return true;

  const many: string[] = Array.isArray(claims.roles) ? claims.roles : [];
  if (many.some((r) => typeof r === 'string' && ALLOWED_ROLES.has(r.toLowerCase().trim()))) return true;

  return false;
}

/**
 * Resolves claims with a forced token refresh.
 * Custom claims minted server-side are NOT in the cached ID token, so the
 * first read after minting looks unauthorized. getIdToken(true) fixes that.
 */
function useFreshClaims() {
  const raw = useAuthClaims() as Record<string, any> | null | undefined;
  const hookClaims: Claims = raw?.claims ?? raw?.customClaims ?? raw?.token ?? null;

  const [claims, setClaims] = useState<Claims>(hookClaims);
  const [status, setStatus] = useState<'loading' | 'ready' | 'signed-out'>('loading');
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { getAuth, onAuthStateChanged } = await import('firebase/auth');
        const auth = getAuth();

        const unsub = onAuthStateChanged(auth, async (user) => {
          if (cancelled) return;
          if (!user) {
            setClaims(null);
            setStatus('signed-out');
            return;
          }
          try {
            await user.getIdToken(true);            // force refresh
            const result = await user.getIdTokenResult();
            if (cancelled) return;
            setClaims({ ...(hookClaims ?? {}), ...result.claims, email: user.email });
          } catch (err) {
            console.warn('[catalog] token refresh failed, using cached claims:', err);
            if (!cancelled) setClaims(hookClaims ?? null);
          } finally {
            if (!cancelled) setStatus('ready');
          }
        });

        return () => unsub();
      } catch (err) {
        console.warn('[catalog] firebase auth unavailable:', err);
        if (!cancelled) {
          setClaims(hookClaims ?? null);
          setStatus('ready');
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  useEffect(() => {
    if (hookClaims && !claims) setClaims(hookClaims);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hookClaims]);

  return { claims, status, refresh };
}

/* ------------------------------------------------------------------ *
 * Data
 * ------------------------------------------------------------------ */

type Service = {
  id: string;
  name: string;
  category: string;
  available: boolean;
  capacity?: number | null;
};

const SEED_SERVICES: Service[] = [
  { id: 'opd',        name: 'General OPD',            category: 'Outpatient', available: true,  capacity: 120 },
  { id: 'anc',        name: 'Antenatal Care (ANC)',   category: 'Maternal',   available: true,  capacity: 40 },
  { id: 'delivery',   name: 'Labour & Delivery',      category: 'Maternal',   available: true,  capacity: 8 },
  { id: 'nicu',       name: 'NICU Cot',               category: 'Neonatal',   available: false, capacity: 4 },
  { id: 'lab',        name: 'Pathology Lab',          category: 'Diagnostics',available: true,  capacity: null },
  { id: 'xray',       name: 'X-Ray / Imaging',        category: 'Diagnostics',available: true,  capacity: null },
  { id: 'ambulance',  name: '108 Ambulance Dispatch', category: 'Transport',  available: true,  capacity: 3 },
  { id: 'bloodbank',  name: 'Blood Storage Unit',     category: 'Support',    available: false, capacity: null },
];

export default function DistrictCatalogPage() {
  const tx = useSafeT('district.catalog');
  const { claims, status, refresh } = useFreshClaims();

  const authorized = useMemo(() => isFacilityManager(claims), [claims]);
  const facilityId: string = claims?.facilityId ?? 'fac_gadchiroli_dh';

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingSeed, setUsingSeed] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    if (!authorized) return;
    setLoading(true);
    try {
      const { getFirestore, collection, getDocs } = await import('firebase/firestore');
      const db = getFirestore();
      const snap = await getDocs(collection(db, 'facilities', facilityId, 'services'));

      if (snap.empty) {
        setServices(SEED_SERVICES);
        setUsingSeed(true);
      } else {
        setServices(
          snap.docs.map((d) => {
            const v = d.data() ?? {};
            return {
              id: d.id,
              name: typeof v.name === 'string' ? v.name : d.id,
              category: typeof v.category === 'string' ? v.category : 'General',
              available: v.available !== false,
              capacity: typeof v.capacity === 'number' ? v.capacity : null,
            };
          })
        );
        setUsingSeed(false);
      }
    } catch (err) {
      console.warn('[catalog] load failed, showing baseline catalog:', err);
      setServices(SEED_SERVICES);
      setUsingSeed(true);
    } finally {
      setLoading(false);
    }
  }, [authorized, facilityId]);

  useEffect(() => {
    if (status === 'ready') void loadServices();
  }, [status, loadServices]);

  const toggle = useCallback(
    async (svc: Service) => {
      setSaving(svc.id);
      setServices((prev) => prev.map((s) => (s.id === svc.id ? { ...s, available: !s.available } : s)));
      try {
        const { getFirestore, doc, setDoc, serverTimestamp } = await import('firebase/firestore');
        const db = getFirestore();
        await setDoc(
          doc(db, 'facilities', facilityId, 'services', svc.id),
          {
            name: svc.name,
            category: svc.category,
            capacity: svc.capacity ?? null,
            available: !svc.available,
            updatedAt: serverTimestamp(),
            updatedBy: claims?.email ?? claims?.uid ?? 'mo',
          },
          { merge: true }
        );
        setUsingSeed(false);
        setNotice(null);
      } catch (err) {
        console.warn('[catalog] write failed (kept local state):', err);
        setNotice(tx('offlineNotice', 'Change saved locally — it will sync when connectivity returns.'));
      } finally {
        setSaving(null);
      }
    },
    [facilityId, claims, tx]
  );

  /* ---------------- Render states ---------------- */

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        {tx('verifying', 'Verifying your facility permissions…')}
      </div>
    );
  }

  if (!authorized) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-amber-500" aria-hidden />
        <h1 className="text-lg font-semibold text-slate-900">
          {tx('denied.title', 'Additional permissions required')}
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          {tx(
            'denied.body',
            'Your account is signed in but does not yet carry facility-management rights. Refreshing your session usually resolves this.'
          )}
        </p>
        <button
          type="button"
          onClick={refresh}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <RefreshCw className="h-4 w-4" />
          {tx('denied.retry', 'Refresh session')}
        </button>
        <p className="mt-4 text-xs text-slate-400">
          {claims?.email ?? tx('denied.noEmail', 'No signed-in account detected')}
        </p>
      </div>
    );
  }

  const grouped = services.reduce<Record<string, Service[]>>((acc, s) => {
    (acc[s.category] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {tx('title', 'Service Catalog')}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tx('subtitle', 'Manage services offered by')} {claims?.facilityName ?? 'Gadchiroli District Hospital'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadServices()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
          {tx('refresh', 'Refresh')}
        </button>
      </header>

      {usingSeed && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            {tx('seedNotice', 'Showing the baseline district-hospital catalog. Toggle any service to publish it to Firestore.')}
          </span>
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          {tx('loading', 'Loading catalog…')}
        </div>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <section key={category} className="rounded-xl border border-slate-200 bg-white">
            <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-700">
              {category}
            </h2>
            <ul className="divide-y divide-slate-100">
              {items.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{s.name}</p>
                    <p className="text-xs text-slate-500">
                      {s.capacity != null
                        ? `${tx('capacity', 'Capacity')}: ${s.capacity}`
                        : tx('noCapacity', 'No capacity limit')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void toggle(s)}
                    disabled={saving === s.id}
                    className={[
                      'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-60',
                      s.available
                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                    ].join(' ')}
                    aria-pressed={s.available}
                  >
                    {saving === s.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}
                    {s.available ? tx('available', 'Available') : tx('unavailable', 'Unavailable')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
