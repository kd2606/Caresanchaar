// src/app/api/analytics/district/route.ts
import { NextRequest, NextResponse } from 'next/server';

import { Timestamp, type Firestore, type Query } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb, getAdminInitError } from '@/lib/firebase/admin';

// Firebase Admin uses Node built-ins (crypto, fs, net) and cannot run on Edge.
export const runtime = 'nodejs';
// Never let Next.js cache or statically prerender this handler at build time.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const maxDuration = 30;

/* ------------------------------------------------------------------ *
 * Types + guaranteed-safe fallback payload
 * ------------------------------------------------------------------ */

type DistrictAnalytics = {
  activeReferrals: number;
  breachedCases: number;
  incomingPatients: number;
  completedReferrals: number;
  avgResponseMinutes: number | null;
  byStatus: Record<string, number>;
};

const EMPTY_PAYLOAD: DistrictAnalytics = {
  activeReferrals: 0,
  breachedCases: 0,
  incomingPatients: 0,
  completedReferrals: 0,
  avgResponseMinutes: null,
  byStatus: {},
};

type Meta = {
  degraded: boolean;
  reason?: string;
  facilityId: string | null;
  district: string | null;
  startDate: string | null;
  endDate: string | null;
  generatedAt: string;
};

const NO_STORE = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
} as const;

/** Every response leaves this handler with HTTP 200 by design. */
function ok(payload: DistrictAnalytics | Record<string, unknown>, meta: Meta) {
  return NextResponse.json(
    { ...payload, meta },
    { status: 200, headers: NO_STORE },
  );
}

/* ------------------------------------------------------------------ *
 * Utilities
 * ------------------------------------------------------------------ */

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const asNumber = Number(value);
  const d = Number.isFinite(asNumber) && value.length >= 10 && !value.includes('-')
    ? new Date(asNumber)
    : new Date(value);
  return Number.isNaN(d.getTime()) ? fallback : d;
}

/** count() aggregation with a get().size fallback for emulators / old rules. */
async function safeCount(query: Query): Promise<number> {
  try {
    const agg = await query.count().get();
    const n = agg.data().count;
    return Number.isFinite(n) ? n : 0;
  } catch {
    try {
      const snap = await query.limit(2000).get();
      return snap.size ?? 0;
    } catch (err) {
      console.warn('[analytics/district] count fallback failed:', err);
      return 0;
    }
  }
}

const ACTIVE_STATUSES = ['pending', 'accepted', 'active', 'in_transit', 'en_route', 'assigned'];
const INCOMING_STATUSES = ['in_transit', 'en_route', 'dispatched'];

/* ------------------------------------------------------------------ *
 * GET
 * ------------------------------------------------------------------ */

export async function GET(request: NextRequest) {
  const now = new Date();
  const url = new URL(request.url);

  const startDate = parseDate(url.searchParams.get('startDate'), new Date(now.getTime() - 30 * 864e5));
  const endDate = parseDate(url.searchParams.get('endDate'), now);

  let facilityId = url.searchParams.get('facilityId');
  let district = url.searchParams.get('district');

  const baseMeta = (): Meta => ({
    degraded: true,
    facilityId,
    district,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
    generatedAt: new Date().toISOString(),
  });

  try {
    const db = getAdminDb();

    if (!db) {
      console.error(
        '[api/analytics/district] Admin SDK unavailable:',
        getAdminInitError(),
      );
      return ok(EMPTY_PAYLOAD, { ...baseMeta(), reason: 'admin-unavailable' });
    }

    // --- Identity (soft): scope the query to the caller's facility/district.
    // A bad/absent token yields zeros rather than a 401 that would blank the UI.
    try {
      const authHeader = request.headers.get('authorization') ?? '';
      const token = authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7).trim() : null;
      if (token) {
        const auth = getAdminAuth();
        if (auth) {
          const decoded = await auth.verifyIdToken(token);
          const isPrivileged = decoded.admin === true || decoded.role === 'mo';
          if (!isPrivileged) {
            return ok(EMPTY_PAYLOAD, { ...baseMeta(), reason: 'insufficient-claims' });
          }
          facilityId = facilityId ?? (decoded.facilityId as string | undefined) ?? null;
          district = district ?? (decoded.district as string | undefined) ?? null;
        }
      }
    } catch (authErr) {
      console.warn('[analytics/district] token verify failed, continuing unscoped:', authErr);
    }

    const start = Timestamp.fromDate(startDate);
    const end = Timestamp.fromDate(endDate);

    // Scope: facilityId is the primary partition key written by the ASHA portal.
    const scope = (col: string): Query => {
      let q: Query = db.collection(col);
      if (facilityId) q = q.where('facilityId', '==', facilityId);
      else if (district) q = q.where('district', '==', district);
      return q;
    };

    const referrals = scope('referrals');

    // Every branch is settled independently: one missing index or empty
    // collection can never take down the whole response.
    const [active, breached, incoming, completed, windowed] = await Promise.allSettled([
      safeCount(referrals.where('status', 'in', ACTIVE_STATUSES)),
      safeCount(referrals.where('slaBreached', '==', true)),
      safeCount(referrals.where('status', 'in', INCOMING_STATUSES)),
      safeCount(referrals.where('status', '==', 'completed')),
      referrals.where('createdAt', '>=', start).where('createdAt', '<=', end).limit(1000).get(),
    ]);

    const num = (r: PromiseSettledResult<number>) => (r.status === 'fulfilled' ? r.value : 0);

    const byStatus: Record<string, number> = {};
    let responseSum = 0;
    let responseCount = 0;

    if (windowed.status === 'fulfilled') {
      for (const doc of windowed.value.docs) {
        const d = doc.data() ?? {};
        const status = typeof d.status === 'string' ? d.status : 'unknown';
        byStatus[status] = (byStatus[status] ?? 0) + 1;

        const created = d.createdAt?.toDate?.() ?? null;
        const acked = (d.acknowledgedAt ?? d.acceptedAt)?.toDate?.() ?? null;
        if (created && acked && acked >= created) {
          responseSum += (acked.getTime() - created.getTime()) / 60000;
          responseCount += 1;
        }
      }
    } else {
      console.warn('[analytics/district] window query failed:', windowed.reason);
    }

    const anyFailure = [active, breached, incoming, completed, windowed].some((r) => r.status === 'rejected');

    const payload: DistrictAnalytics = {
      activeReferrals: num(active),
      breachedCases: num(breached),
      incomingPatients: num(incoming),
      completedReferrals: num(completed),
      avgResponseMinutes: responseCount > 0 ? Math.round(responseSum / responseCount) : null,
      byStatus,
    };

    return ok(payload, {
      ...baseMeta(),
      degraded: anyFailure,
      reason: anyFailure ? 'partial-data' : undefined,
    });
  } catch (err) {
    // Absolute last resort — the dashboard still gets a 200.
    console.error('[analytics/district] unhandled error:', err);
    return ok(EMPTY_PAYLOAD, { ...baseMeta(), reason: 'unhandled-error' });
  }
}
