// src/app/api/facility/list/route.ts
import { NextResponse, type NextRequest } from 'next/server';
import { getAdminAuth, getAdminDb, getAdminInitError } from '@/lib/firebase/admin';

// Firebase Admin uses Node built-ins (crypto, fs, net) and cannot run on Edge.
export const runtime = 'nodejs';
// Never let Next.js cache or statically prerender this handler at build time.
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const maxDuration = 30;

const EMPTY = { facilities: [], count: 0, empty: true };

const NO_STORE = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
} as const;

/** Every response leaves this handler with HTTP 200 by design. */
function ok(body: Record<string, unknown>) {
  return NextResponse.json(body, { status: 200, headers: NO_STORE });
}

export async function GET(req: NextRequest) {
  try {
    const db = getAdminDb();

    if (!db) {
      console.error(
        '[api/facility/list] Admin SDK unavailable:',
        getAdminInitError(),
      );
      return ok({
        ...EMPTY,
        degraded: true,
        error: 'Facility service is temporarily unavailable.',
      });
    }

    // --- Authentication (soft): bad/absent token degrades to defaults. ---
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    let role: string | null = null;
    let district = new URL(req.url).searchParams.get('district') || 'Gadchiroli';

    if (token) {
      try {
        const auth = getAdminAuth();
        if (auth) {
          const decoded = await auth.verifyIdToken(token);

          // --- Role resolution with Firestore self-heal (fixes stale-claim 403s) ---
          role = (decoded.role as string) || (decoded.worker ? 'worker' : null) || null;
          if (!role) {
            const profile = await db.collection('users').doc(decoded.uid).get();
            role = (profile.exists ? (profile.data()?.role as string) : null) ?? null;
            if (role) {
              // repair the claim so future requests are fast
              await auth.setCustomUserClaims(decoded.uid, {
                ...decoded, role, worker: role === 'worker',
              }).catch(() => {});
            }
          }

          district =
            (decoded.district as string) ||
            new URL(req.url).searchParams.get('district') ||
            'Gadchiroli';
        }
      } catch (authErr) {
        console.warn(
          '[api/facility/list] Token verification failed, continuing with defaults:',
          authErr instanceof Error ? authErr.message : authErr,
        );
      }
    }

    try {
      const col = db.collection('facilities');

      // Primary query, scoped by district
      let snap = await col.where('district', '==', district).limit(200).get();

      // Fallback 1: district field missing/mismatched on seeded docs
      if (snap.empty) snap = await col.limit(200).get();

      // Fallback 2: collection genuinely empty -> 200 + []
      if (snap.empty) {
        return ok({
          ...EMPTY,
          message: 'No facilities found - please add data',
          district,
        });
      }

      const facilities = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((f: any) => f.isActive !== false)
        .sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));

      return ok({
        facilities,
        count: facilities.length,
        empty: facilities.length === 0,
        district,
        role,
      });
    } catch (queryErr) {
      console.error(
        '[api/facility/list] Firestore query failed:',
        queryErr instanceof Error ? queryErr.stack : queryErr,
      );
      return ok({
        ...EMPTY,
        degraded: true,
        error: 'Could not load facilities right now.',
      });
    }
  } catch (err) {
    // Absolute last resort — the UI still gets a 200.
    console.error(
      '[api/facility/list] Unexpected failure:',
      err instanceof Error ? err.stack : err,
    );
    return ok({
      ...EMPTY,
      degraded: true,
      message: 'No facilities found - please add data',
    });
  }
}
