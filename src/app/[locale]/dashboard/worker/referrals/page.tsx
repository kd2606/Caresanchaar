'use client';

import { use, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { getOfflineDb } from '@/lib/db/offline-db';
import { SyncStatusBar } from '@/components/sync-status-bar';
import { getOfflineFacilities, syncFacilityCatalog, queueOfflineAssignment } from '@/lib/sync/facility-sync';
import { getFirebaseAuth } from '@/lib/firebase/client';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';

const ReferralQrCode = dynamic(() => import('@/components/qr/ReferralQrCode'), { ssr: false });


type Urgency = 'ROUTINE' | 'URGENT' | 'EMERGENCY';
type ReferralStatus = 'CREATED' | 'ACCEPTED' | 'INFO_REQUESTED' | 'REJECTED' | 'CLOSED';

interface PatientRecord {
  id: string;
  name: string;
}

interface ReferralRecord {
  id: string;
  patient_id: string;
  target_facility: string;
  queue_token?: string;
  urgency: Urgency;
  status: ReferralStatus;
  timestamp: number | string;
}

interface ReferralRow extends ReferralRecord {
  patientName: string;
  sortKey: number;
}

const ACTIVE_STATUSES: ReadonlySet<ReferralStatus> = new Set<ReferralStatus>([
  'CREATED',
  'ACCEPTED',
  'INFO_REQUESTED',
  'REJECTED'
]);

const URGENCY_ORDER: Record<Urgency, number> = {
  EMERGENCY: 0,
  URGENT: 1,
  ROUTINE: 2,
};

const URGENCY_BADGE: Record<Urgency, string> = {
  EMERGENCY: 'bg-red-500/10 text-red-400',
  URGENT: 'bg-yellow-500/10 text-yellow-400',
  ROUTINE: 'bg-emerald-500/10 text-emerald-400',
};

function toEpoch(timestamp: number | string): number {
  if (typeof timestamp === 'number') return timestamp;
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function formatWhen(epoch: number, locale: string): string {
  if (epoch <= 0) return '—';
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(epoch));
}

interface ReferralsPageProps {
  params: Promise<{ locale: string }>;
}

export default function ActiveReferralsPage({ params }: ReferralsPageProps) {
  const tc = useTranslations('worker.catalog');
  const tr = useTranslations('worker.referrals');
  const { locale } = use(params);
  const [selectedQr, setSelectedQr] = useState<string | null>(null);

  const isOnline = true; // Mocked for simplicity since useOfflineSync isn't here
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [catalogSyncing, setCatalogSyncing] = useState(false);
  const [assignTarget, setAssignTarget] = useState<string | null>(null);

  const loadFacilities = async () => {
    try {
      const user = getFirebaseAuth().currentUser;
      if (!user) return;
      const token = await user.getIdTokenResult();
      const districtId = token.claims.district_id as string;
      const facs = await getOfflineFacilities(districtId);
      setFacilities(facs);
    } catch (e) {
      console.error(e);
    }
  };

  const handleSyncCatalog = async () => {
    setCatalogSyncing(true);
    try {
      await syncFacilityCatalog();
      await loadFacilities();
    } catch (e: any) {
      alert(e.message || 'Sync failed');
    } finally {
      setCatalogSyncing(false);
    }
  };

  const handleAssignClick = (refId: string) => {
    setAssignTarget(refId);
    loadFacilities();
    setShowCatalogModal(true);
  };

  const handleConfirmAssign = async (facilityId: string) => {
    if (!assignTarget) return;
    try {
      await queueOfflineAssignment(assignTarget, facilityId);
      setShowCatalogModal(false);
      setAssignTarget(null);
      alert(tr('assignQueued'));
    } catch (e: any) {
      alert(e.message || tr('assignFailed'));
    }
  };


  const rows = useLiveQuery<ReferralRow[] | undefined>(async () => {
    const db = getOfflineDb();

    const referrals = (await db.referrals.toArray()) as ReferralRecord[];

    const active = referrals.filter((referral) =>
      ACTIVE_STATUSES.has(referral.status),
    );

    if (active.length === 0) return [];

    const patientIds = Array.from(
      new Set(active.map((referral) => referral.patient_id)),
    );

    const patients = (await db.patients.bulkGet(patientIds as any)) as Array<
      PatientRecord | undefined
    >;

    const nameById = new Map<string, string>();
    patients.forEach((patient) => {
      if (patient) nameById.set(patient.id, patient.name);
    });

    return active
      .map<ReferralRow>((referral) => ({
        ...referral,
        patientName: nameById.get(referral.patient_id) ?? 'Unknown patient',
        sortKey: toEpoch(referral.timestamp),
      }))
      .sort((a, b) => b.sortKey - a.sortKey);
  }, []);

  const isLoading: boolean = rows === undefined;

  const emergencyCount: number = useMemo(
    () => (rows ?? []).filter((row) => row.urgency === 'EMERGENCY').length,
    [rows],
  );

  const [timelineRef, setTimelineRef] = useState<string | null>(null);
  const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const fetchTimeline = async (referralId: string) => {
    setTimelineRef(referralId);
    setLoadingTimeline(true);
    try {
      const { getDocs, query, collection } = await import('firebase/firestore');
      const { db } = await import('@/firebase/clientApp');
      const q = query(collection(db, 'referral_events'));
      const snapshot = await getDocs(q);
      const events = snapshot.docs
        .map(d => d.data())
        .filter(d => d.referral_id === referralId)
        .sort((a, b) => b.occurred_at - a.occurred_at);
      setTimelineEvents(events);
    } catch(err) {
      console.error(err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SyncStatusBar/>

      <main className="mx-auto w-full max-w-7xl px-4 py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {tr('activeReferrals')}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {tr('subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground">
              {tr('activeBadge')}
              <span className="ml-2 font-semibold tabular-nums text-white">
                {rows?.length ?? 0}
              </span>
            </span>
            {emergencyCount > 0 ? (
              <span className="rounded-md bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400">
                {tr('emergencyCount', { count: emergencyCount })}
              </span>
            ) : null}
          </div>
        </header>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          {rows === undefined ? (
            <TableSkeleton/>
          ) : rows.length === 0 ? (
            <EmptyState tr={tr}/>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <Th>{tr('thPatient')}</Th>
                    <Th>{tr('thFacility')}</Th>
                    <Th>{tr('thToken')}</Th>
                    <Th>{tr('thUrgency')}</Th>
                    <Th>{tr('thStatus')}</Th>
                    <Th className="text-right">{tr('thRaised')}</Th>
                    <Th className="text-right">{tr('thAction')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border last:border-b-0 transition-colors hover:bg-secondary/40"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-white block">
                          {row.patientName}
                        </span>
                        <a
                          href={`/${locale}/dashboard/worker/patient/${row.patient_id}`}
                          className="text-[10px] text-emerald-400 hover:underline mt-1 inline-block"
                        >
                          View 360 Record
                        </a>
                        <span className="mt-1 block font-mono text-xs text-muted-foreground">
                          #{row.id.slice(0, 8)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.target_facility === 'PENDING_ASSIGNMENT' ? (
                          <div className="flex flex-col gap-1">
                              <span className="text-orange-400 text-xs italic">{tc('pending')}</span>
                              <button onClick={() => handleAssignClick(row.id)} className="bg-blue-600 text-white text-xs px-2 py-1 rounded hover:bg-blue-700 w-fit">{tc('assign')}</button>
                            </div>
                        ) : (
                          row.target_facility
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {row.queue_token ? (
                          <span className="font-mono bg-blue-500/20 text-blue-300 px-2 py-1 rounded text-xs font-bold">{row.queue_token}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs italic">{tr('unscheduled')}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${URGENCY_BADGE[row.urgency]}`}
                        >
                          {row.urgency}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/60 px-2 py-1 text-xs font-medium text-muted-foreground">
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-secondary"
                            aria-hidden="true"
                          />
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                        {formatWhen(row.sortKey, locale)}
                      </td>
                      <td className="px-4 py-3 flex gap-2 justify-end">
                        <button
                          onClick={() => setSelectedQr(row.id)}
                          className="px-3 py-1.5 bg-secondary text-white text-xs font-semibold rounded-md hover:bg-secondary/80 transition-colors"
                        >
                          Show QR
                        </button>
                        <button
                          onClick={() => fetchTimeline(row.id)}
                          className="px-3 py-1.5 border border-border text-white text-xs font-semibold rounded-md hover:bg-secondary transition-colors"
                        >
                          Timeline
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-4 text-xs text-muted-foreground">
          {tr('sortNote')}
        </p>

        {selectedQr && (
          <ReferralQrCode
            referralId={selectedQr}
            isSynthetic={true}
            onClose={() => setSelectedQr(null)}
          />
        )}

        {timelineRef && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
            <div className="bg-card p-6 rounded-2xl w-full max-w-sm border border-border shadow-2xl max-h-[80vh] overflow-y-auto">
              <h3 className="text-xl font-bold text-white mb-2">{tr('timelineTitle')}</h3>
              <p className="text-sm text-muted-foreground mb-6">{tr('timelineHint')}</p>

              <div className="space-y-4">
                {loadingTimeline ? (
                  <div className="text-center py-4 text-muted-foreground">{tr('loading')}</div>
                ) : timelineEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">{tr('noEvents')}</p>
                ) : (
                  <div className="relative border-l border-border ml-3 space-y-6">
                    {timelineEvents.map((ev, idx) => (
                      <div key={idx} className="pl-6 relative">
                        <span className="absolute -left-[5px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-background" />
                        <div className="text-sm font-semibold text-white">
                          {ev.action === 'CONSULTATION_OUTCOME' ? 'CONSULTATION OUTCOME' : ev.action}
                        </div>
                        <div className="text-xs text-muted-foreground mb-1">{new Date(ev.occurred_at).toLocaleString()}</div>
                        {ev.disposition && (
                          <div className="text-xs font-bold text-emerald-400 mt-1 uppercase">{tr('disposition')}: {ev.disposition.replace(/_/g, ' ')}</div>
                        )}
                        {ev.note && <div className="text-sm text-muted-foreground bg-secondary p-2 rounded-md mt-1">{ev.note}</div>}
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-4 mt-6 border-t border-border flex justify-end">
                  <button onClick={() => setTimelineRef(null)} className="px-4 py-2 bg-secondary text-white text-sm font-semibold rounded-md hover:bg-secondary/80">{tr('close')}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {showCatalogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border border-border">
            <h2 className="text-xl font-bold text-white mb-4">{tr('assignModalTitle')}</h2>

            <div className="mb-6 space-y-2 max-h-[60vh] overflow-y-auto">
              {facilities.length === 0 && !catalogSyncing && (
                <p className="text-sm text-muted-foreground">{tr('noFacilities')}</p>
              )}
              {catalogSyncing && (
                <p className="text-sm text-muted-foreground">{tr('syncing')}</p>
              )}
              {facilities.map(fac => (
                <div key={fac.id} className="flex items-center justify-between p-3 border border-border rounded-lg bg-secondary/40">
                  <div>
                    <h3 className="font-semibold text-white">{fac.name}</h3>
                    <p className="text-xs text-muted-foreground">{fac.type}</p>
                  </div>
                  <button
                    onClick={() => handleConfirmAssign(fac.id)}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-md text-sm font-medium"
                  >
                    {tr('confirm')}
                  </button>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center mt-4 pt-4 border-t border-border">
              <button
                onClick={handleSyncCatalog}
                className="text-xs text-indigo-400 hover:text-indigo-300"
                disabled={catalogSyncing}
              >
                {tr('syncCatalogNow')}
              </button>
              <button
                onClick={() => { setShowCatalogModal(false); setAssignTarget(null); }}
                className="bg-secondary hover:bg-secondary/80 text-white px-4 py-2 rounded-md font-medium"
              >
                {tr('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

function Th({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-border" aria-busy="true">
      {[0, 1, 2, 3].map((key) => (
        <div key={key} className="flex items-center gap-4 px-4 py-4">
          <div className="h-3 w-40 animate-pulse rounded bg-secondary" />
          <div className="h-3 w-32 animate-pulse rounded bg-secondary" />
          <div className="ml-auto h-5 w-20 animate-pulse rounded bg-secondary" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ tr }: { tr: (key: string) => string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-secondary/40">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6 text-muted-foreground"
          aria-hidden="true"
        >
          <path d="M9 12h6M12 9v6" />
          <path d="M20 12a8 8 0 1 1-8-8 8 8 0 0 1 8 8Z" />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-white">{tr('emptyTitle')}</h2>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {tr('emptyDesc')}
      </p>
    </div>
  );
}
