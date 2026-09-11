import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * POST /api/referral/qr-lookup
 *
 * Securely resolves a referral from a QR payload.
 * The QR payload is opaque: "dv:ref:<firestore_document_id>"
 * No patient PII is encoded in the QR itself.
 *
 * Security:
 * - Requires valid Firebase ID token
 * - Enforces role (mo, district_admin, admin)
 * - Enforces facility scope for MOs
 * - Rejects CLOSED referrals
 * - Writes audit event for QR scan
 * - Returns only authorized data fields
 */

const DV_PREFIX = 'dv:ref:';

export async function POST(request: Request) {
  try {
    // 1. Authenticate
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await adminAuth()!.verifyIdToken(token);
    } catch {
      return NextResponse.json(
        { error: 'Invalid or expired session', code: 'AUTH_INVALID' },
        { status: 401 }
      );
    }

    // 2. Authorize role
    const role = decodedToken.role;
    if (!role || typeof role !== 'string') {
      return NextResponse.json(
        { error: 'No role assigned to this account', code: 'ROLE_MISSING' },
        { status: 403 }
      );
    }

    const allowedRoles = ['mo', 'district_admin', 'admin'];
    if (!allowedRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Your role does not have permission to scan referral QR codes', code: 'ROLE_UNAUTHORIZED' },
        { status: 403 }
      );
    }

    // 3. Parse and validate QR payload
    const body = await request.json();
    const { qrPayload } = body;

    if (!qrPayload || typeof qrPayload !== 'string') {
      return NextResponse.json(
        { error: 'Missing QR payload', code: 'PAYLOAD_MISSING' },
        { status: 400 }
      );
    }

    // Accept both raw referral IDs and prefixed payloads
    let referralId: string;
    if (qrPayload.startsWith(DV_PREFIX)) {
      referralId = qrPayload.slice(DV_PREFIX.length).trim();
    } else {
      // Allow manual ID entry without prefix
      referralId = qrPayload.trim();
    }

    if (!referralId || referralId.length < 4 || referralId.length > 128) {
      return NextResponse.json(
        { error: 'Invalid referral ID format', code: 'PAYLOAD_INVALID' },
        { status: 400 }
      );
    }

    // Sanitize: only allow alphanumeric, hyphens, underscores
    if (!/^[a-zA-Z0-9_-]+$/.test(referralId)) {
      return NextResponse.json(
        { error: 'Referral ID contains invalid characters', code: 'PAYLOAD_TAMPERED' },
        { status: 400 }
      );
    }

    // 4. Resolve referral from Firestore
    const refDoc = await adminDb()!.collection('referrals').doc(referralId).get();

    if (!refDoc.exists) {
      return NextResponse.json(
        { error: 'Referral not found', code: 'REFERRAL_NOT_FOUND' },
        { status: 404 }
      );
    }

    const refData = refDoc.data()!;

    // 5. Enforce facility scope for MOs
    if (role === 'mo' && decodedToken.facility_id) {
      if (refData.target_facility && refData.target_facility !== 'PENDING_ASSIGNMENT') {
        if (refData.target_facility !== decodedToken.facility_id) {
          return NextResponse.json(
            {
              error: 'This referral is assigned to a different facility. You do not have scope to view it.',
              code: 'SCOPE_FACILITY_MISMATCH',
            },
            { status: 403 }
          );
        }
      }
    }

    // 6. Check referral status
    if (refData.status === 'CLOSED') {
      return NextResponse.json(
        {
          error: 'This referral has already been closed',
          code: 'REFERRAL_CLOSED',
          referral: {
            id: referralId,
            status: 'CLOSED',
            outcome_disposition: refData.outcome_disposition || null,
          },
        },
        { status: 410 }
      );
    }

    // 7. Write audit event for QR scan
    try {
      await adminDb()!.collection('referral_events').add({
        referral_id: referralId,
        actor_uid: decodedToken.uid,
        action: 'QR_SCANNED',
        note: `QR scanned by ${role}`,
        occurred_at: FieldValue.serverTimestamp(),
      });
    } catch {
      // Non-critical — don't fail the lookup
      console.warn('Failed to write QR scan audit event');
    }

    // 8. Build authorized response (no raw PII unless role permits)
    const response: Record<string, any> = {
      id: referralId,
      status: refData.status || 'CREATED',
      urgency: refData.urgency || 'ROUTINE',
      tier: refData.tier || null,
      target_facility: refData.target_facility || 'PENDING_ASSIGNMENT',
      queue_token: refData.queue_token || null,
      care_category: refData.care_category || null,
      created_at: refData.created_at || null,
    };

    // Include patient name only for roles that need it for care delivery
    if (['mo', 'district_admin', 'admin'].includes(role)) {
      response.patientName = refData.patientName || refData.patient_name || null;
      response.patient_id = refData.patient_id || null;
    }

    return NextResponse.json({ success: true, referral: response });
  } catch (error: any) {
    console.error('QR Lookup Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
