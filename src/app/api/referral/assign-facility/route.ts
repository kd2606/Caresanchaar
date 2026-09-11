import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth()!.verifyIdToken(token);
    
    const role = decodedToken.role; 
    if (!role || typeof role !== 'string') {
       return NextResponse.json({ error: 'Forbidden: Missing Role' }, { status: 403 });
    }

    const allowedRoles = ['mo', 'district_admin', 'admin', 'worker', 'asha'];
    if (!allowedRoles.includes(role)) {
       return NextResponse.json({ error: 'Forbidden: Invalid Role' }, { status: 403 });
    }

    const body = await request.json();
    const { referralId, facilityId } = body;

    if (!referralId || !facilityId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Validate facility exists and is active
    if (facilityId !== 'PENDING_ASSIGNMENT') {
        const facilityDoc = await adminDb()!.collection('facilities').doc(facilityId).get();
        if (!facilityDoc.exists) {
            return NextResponse.json({ error: 'Facility not found' }, { status: 404 });
        }
        const facilityData = facilityDoc.data();
        if (facilityData?.status === 'INACTIVE') {
            return NextResponse.json({ error: 'Cannot assign to an inactive facility' }, { status: 400 });
        }

        // Validate scope
        const userDistrict = decodedToken.district_id;
        if (userDistrict && facilityData?.districtId !== userDistrict) {
            return NextResponse.json({ error: 'Forbidden: Facility outside authorized district' }, { status: 403 });
        }

        if (role === 'mo' && decodedToken.facility_id && facilityId !== decodedToken.facility_id) {
            return NextResponse.json({ error: 'Forbidden: MO can only assign to their own facility' }, { status: 403 });
        }
    }

    const refDoc = adminDb()!.collection('referrals').doc(referralId);
    
    await adminDb()!.runTransaction(async (t) => {
      const docSnap = await t.get(refDoc);
      if (!docSnap.exists) {
        throw new Error('NOT_FOUND');
      }

      const data = docSnap.data();
      
      // Idempotency: if already assigned to this facility, do nothing
      if (data?.target_facility === facilityId) {
        return;
      }

      // Scope checking for worker
      if ((role === 'worker' || role === 'asha') && (data?.created_by !== decodedToken.uid && data?.owner_uid !== decodedToken.uid)) {
         throw new Error('SCOPE_ERROR: Worker does not own this referral');
      }

      t.update(refDoc, {
        target_facility: facilityId,
        updated_at: FieldValue.serverTimestamp(),
        rev: (data?.rev || 0) + 1
      });

      // Write audit event without PII
      const auditRef = adminDb()!.collection('referral_events').doc();
      t.set(auditRef, {
        referral_id: referralId,
        actor_uid: decodedToken.uid,
        action: 'FACILITY_ASSIGNED',
        note: `Assigned to facility: ${facilityId}`,
        occurred_at: FieldValue.serverTimestamp()
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Assign Facility Error:', error);
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }
    if (error.message.startsWith('SCOPE_ERROR')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
