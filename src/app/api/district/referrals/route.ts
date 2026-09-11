// src/app/api/district/referrals/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminInitError } from '@/lib/firebase/admin';

// Firebase Admin uses Node built-ins (crypto, fs, net) and cannot run on Edge.
export const runtime = 'nodejs';
// Never let Next.js cache or statically prerender this handler at build time.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const maxDuration = 30;

// Backward-compatible type re-export consumed by useDistrictReferrals and other
// client-side code. Kept as a superset so existing UI code doesn't break.
export type ReferralRow = {
  id: string;
  patientName: string;
  age: number | null;
  gender: string;
  village: string;
  ashaName: string;
  reason: string;
  urgency: 'critical' | 'high' | 'routine';
  status: 'pending' | 'acknowledged' | 'in_transit' | 'admitted' | 'completed' | 'cancelled';
  facilityId: string;
  createdAt: string | null;
  updatedAt: string | null;
  ageMinutes: number | null;
  slaBreached: boolean;
};

type Referral = {
  id: string;
  districtId: string | null;
  patientName: string | null;
  facility: string | null;
  reason: string | null;
  status: string | null;
  priority: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ReferralsResponse = {
  ok: boolean;
  data: Referral[];
  count: number;
  degraded: boolean;
  error: string | null;
  code:
    | 'OK'
    | 'ADMIN_UNAVAILABLE'
    | 'UNAUTHENTICATED'
    | 'QUERY_FAILED'
    | 'UNEXPECTED';
};

const NO_STORE = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
} as const;

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null) {
    const maybe = value as { toDate?: () => Date; _seconds?: number };
    if (typeof maybe.toDate === 'function') {
      try {
        return maybe.toDate().toISOString();
      } catch {
        return null;
      }
    }
    if (typeof maybe._seconds === 'number') {
      return new Date(maybe._seconds * 1000).toISOString();
    }
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Every response leaves this handler with HTTP 200 by design. */
function ok(body: ReferralsResponse) {
  return NextResponse.json(body, { status: 200, headers: NO_STORE });
}

export async function GET(request: NextRequest) {
  try {
    const db = getAdminDb();

    if (!db) {
      console.error(
        '[api/district/referrals] Admin SDK unavailable:',
        getAdminInitError(),
      );
      return ok({
        ok: false,
        data: [],
        count: 0,
        degraded: true,
        error: 'Referral service is temporarily unavailable.',
        code: 'ADMIN_UNAVAILABLE',
      });
    }

    const url = new URL(request.url);
    const limitParam = Number.parseInt(url.searchParams.get('limit') ?? '', 10);
    const limit =
      Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, 200)
        : 50;
    const statusFilter = url.searchParams.get('status');
    let districtId = url.searchParams.get('districtId');

    // Optional bearer-token scoping. A missing/invalid token degrades to the
    // districtId query param rather than failing the request.
    const authHeader = request.headers.get('authorization') ?? '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
      const token = authHeader.slice(7).trim();
      const auth = getAdminAuth();
      if (auth && token) {
        try {
          const decoded = await auth.verifyIdToken(token);
          const claimDistrict = decoded.districtId;
          if (typeof claimDistrict === 'string' && claimDistrict) {
            districtId = claimDistrict;
          }
        } catch (err) {
          console.warn(
            '[api/district/referrals] Token verification failed:',
            err instanceof Error ? err.message : err,
          );
        }
      }
    }

    try {
      let query = db.collection('referrals').limit(limit);
      if (districtId) query = query.where('districtId', '==', districtId);
      if (statusFilter) query = query.where('status', '==', statusFilter);

      const snapshot = await query.get();

      const data: Referral[] = snapshot.docs.map((doc) => {
        const d = doc.data() as Record<string, unknown>;
        return {
          id: doc.id,
          districtId: str(d.districtId),
          patientName: str(d.patientName),
          facility: str(d.facility),
          reason: str(d.reason),
          status: str(d.status) ?? 'pending',
          priority: str(d.priority) ?? 'normal',
          createdAt: toIso(d.createdAt),
          updatedAt: toIso(d.updatedAt),
        };
      });

      data.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

      return ok({
        ok: true,
        data,
        count: data.length,
        degraded: false,
        error: null,
        code: 'OK',
      });
    } catch (err) {
      console.error(
        '[api/district/referrals] Firestore query failed:',
        err instanceof Error ? err.stack : err,
      );
      return ok({
        ok: false,
        data: [],
        count: 0,
        degraded: true,
        error: 'Could not load referrals right now.',
        code: 'QUERY_FAILED',
      });
    }
  } catch (err) {
    console.error(
      '[api/district/referrals] Unexpected failure:',
      err instanceof Error ? err.stack : err,
    );
    return ok({
      ok: false,
      data: [],
      count: 0,
      degraded: true,
      error: 'Unexpected server error.',
      code: 'UNEXPECTED',
    });
  }
}
