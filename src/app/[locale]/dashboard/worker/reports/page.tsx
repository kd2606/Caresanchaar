"use client";
﻿import { useTranslations } from "next-intl";

import { useLiveQuery } from 'dexie-react-hooks';
import { getOfflineDb } from '@/lib/db/offline-db';
import { SyncStatusBar } from '@/components/sync-status-bar';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type RiskLevel = 'RED' | 'YELLOW' | 'GREEN';

interface PatientRow {
  id: string;
  name: string;
  gender: string;
}

interface TriageRow {
  id: string;
  patient_id: string;
  risk_level: RiskLevel;
  timestamp: number | string | Date;
}

interface ReferralRow {
  id: string;
  patient_id: string;
  urgency: string;
  status: string;
}

interface FollowUp {
  triageId: string;
  patientId: string;
  patientName: string;
  riskLevel: Exclude<RiskLevel, 'GREEN'>;
  screenedAt: number;
}

interface ReportSnapshot {
  totalScreenings: number;
  highRiskCases: number;
  activeReferrals: number;
  followUps: readonly FollowUp[];
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const DATE_FORMATTER = new Intl.DateTimeFormat('en-IN', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function toMillis(value: TriageRow['timestamp']): number {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  const parsed = Date.parse(value as string);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function isFollowUpRisk(risk: RiskLevel): risk is Exclude<RiskLevel, 'GREEN'> {
  return risk === 'RED' || risk === 'YELLOW';
}

const RISK_WEIGHT: Record<Exclude<RiskLevel, 'GREEN'>, number> = {
  RED: 0,
  YELLOW: 1,
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function WorkerReportsPage(): React.JSX.Element {
  const t = useTranslations("worker.inbox");

  const report = useLiveQuery<ReportSnapshot | undefined>(async () => {
    const db = getOfflineDb();

    const [triageRecords, referrals] = await Promise.all([
      db.table<TriageRow>('triage_records').toArray(),
      db.table<ReferralRow>('referrals').toArray(),
    ]);

    const totalScreenings = triageRecords.length;
    const highRiskCases = triageRecords.filter(
      (record) => record.risk_level === 'RED',
    ).length;

    const activeReferrals = referrals.filter(
      (referral) => (referral.status ?? '').toUpperCase() !== 'CLOSED',
    ).length;

    const pending = triageRecords.filter((record) =>
      isFollowUpRisk(record.risk_level),
    );

    const patientIds = Array.from(
      new Set(pending.map((record) => record.patient_id)),
    );
    const patients = await db.table<PatientRow>('patients').bulkGet(patientIds);

    const nameById = new Map<string, string>();
    patientIds.forEach((id, index) => {
      const patient = patients[index];
      nameById.set(id, patient?.name ?? 'Unknown patient');
    });

    const followUps: FollowUp[] = pending
      .map((record) => ({
        triageId: record.id,
        patientId: record.patient_id,
        patientName: nameById.get(record.patient_id) ?? 'Unknown patient',
        riskLevel: record.risk_level as Exclude<RiskLevel, 'GREEN'>,
        screenedAt: toMillis(record.timestamp),
      }))
      .sort(
        (a, b) =>
          RISK_WEIGHT[a.riskLevel] - RISK_WEIGHT[b.riskLevel] ||
          b.screenedAt - a.screenedAt,
      );

    return { totalScreenings, highRiskCases, activeReferrals, followUps };
  }, []);

  const isLoading = report === undefined;

  function handleLogVisit(followUp: FollowUp): void {
    void followUp;
  }

  return (
    <div className="min-h-screen bg-background">
      <SyncStatusBar/>
      <main className="px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto w-full max-w-6xl">
          <header className="mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Reports &amp; Follow-ups
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Live figures computed from this device&apos;s offline records. Works
              without a network connection.
            </p>
          </header>

          {/* ---------------- Metric cards ---------------- */}
          <section
            aria-label="Key metrics"
            className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {isLoading ? (
              <>
                <MetricCardSkeleton/>
                <MetricCardSkeleton/>
                <MetricCardSkeleton/>
              </>
            ) : (
              <>
                <MetricCard hint="All triage records on this device" label="Total Screenings" value={report.totalScreenings}/>
                <MetricCard accent="red" hint="Triaged as RED" label="High-Risk Cases" value={report.highRiskCases}/>
                <MetricCard accent="yellow" hint="Referrals not yet closed" label="Active Referrals" value={report.activeReferrals}/>
              </>
            )}
          </section>

          {/* ---------------- Follow-up list ---------------- */}
          <section aria-label="High-risk follow-ups" className="mt-10">
            <div className="rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
                <h2 className="text-base font-medium text-white">
                  High-Risk Follow-ups Required
                </h2>
                <span className="text-xs text-muted-foreground">
                  {isLoading
                    ? 'LoadingÃ¢â‚¬Â¦'
                    : `${report.followUps.length} patient${
                        report.followUps.length === 1 ? '' : 's'
                      } pending`}
                </span>
              </div>

              {isLoading ? (
                <TableSkeleton/>
              ) : report.followUps.length === 0 ? (
                <EmptyState/>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th
                          scope="col"
                          className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          Patient
                        </th>
                        <th
                          scope="col"
                          className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          Risk Level
                        </th>
                        <th
                          scope="col"
                          className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          Date of Screening
                        </th>
                        <th
                          scope="col"
                          className="px-5 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground"
                        >
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.followUps.map((followUp) => (
                        <tr
                          key={followUp.triageId}
                          className="border-b border-border last:border-b-0"
                        >
                          <td className="px-5 py-4 font-medium text-white">
                            {followUp.patientName}
                          </td>
                          <td className="px-5 py-4">
                            <RiskBadge risk={followUp.riskLevel}/>
                          </td>
                          <td className="px-5 py-4 text-muted-foreground">
                            {followUp.screenedAt === 0
                              ? 'Ã¢â‚¬â€'
                              : DATE_FORMATTER.format(new Date(followUp.screenedAt))}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleLogVisit(followUp)}
                              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-white transition-colors hover:border-border focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600"
                            >
                              Log Visit
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Presentational sub-components                                       */
/* ------------------------------------------------------------------ */

interface MetricCardProps {
  label: string;
  value: number;
  hint: string;
  accent?: 'red' | 'yellow';
}

function MetricCard({
  label,
  value,
  hint,
  accent,
}: MetricCardProps): React.JSX.Element {
  const accentDot =
    accent === 'red'
      ? 'bg-red-400'
      : accent === 'yellow'
        ? 'bg-yellow-400'
        : 'bg-secondary';

  return (
    <article className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 rounded-full ${accentDot}`} aria-hidden />
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-4 text-3xl font-semibold tabular-nums tracking-tight text-white">
        {value.toLocaleString('en-IN')}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </article>
  );
}

function MetricCardSkeleton(): React.JSX.Element {
  return (
    <div
      aria-hidden
      className="animate-pulse rounded-xl border border-border bg-card p-5"
    >
      <div className="h-3 w-28 rounded bg-secondary" />
      <div className="mt-5 h-8 w-20 rounded bg-secondary" />
      <div className="mt-3 h-3 w-36 rounded bg-secondary" />
    </div>
  );
}

function RiskBadge({
  risk,
}: {
  risk: Exclude<RiskLevel, 'GREEN'>;
}): React.JSX.Element {
  const styles =
    risk === 'RED'
      ? 'bg-red-500/10 text-red-400'
      : 'bg-yellow-500/10 text-yellow-400';
  const label = risk === 'RED' ? 'High Risk' : 'Monitor';

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${styles}`}
    >
      {label}
    </span>
  );
}

function TableSkeleton(): React.JSX.Element {
  return (
    <div aria-hidden className="animate-pulse divide-y divide-border">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex items-center gap-4 px-5 py-4">
          <div className="h-4 w-40 rounded bg-secondary" />
          <div className="h-5 w-20 rounded-full bg-secondary" />
          <div className="h-4 w-32 rounded bg-secondary" />
          <div className="ml-auto h-7 w-20 rounded-lg bg-secondary" />
        </div>
      ))}
    </div>
  );
}

function EmptyState(): React.JSX.Element {
  const t = useTranslations("worker.inbox");
  return (
    <div className="px-5 py-12 text-center">
      <p className="text-sm font-medium text-white">{t("noTasks")}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        Every screened patient is currently marked low risk.
      </p>
    </div>
  );
}
