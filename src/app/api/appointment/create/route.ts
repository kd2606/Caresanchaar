import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth()!.verifyIdToken(token);
    
    const role = decodedToken.role;
    const allowedRoles = ['mo', 'district_admin', 'admin']; // Only facility staff can schedule an appointment for now
    if (!role || typeof role !== 'string' || !allowedRoles.includes(role)) {
       return NextResponse.json({ error: 'Forbidden: Invalid Role' }, { status: 403 });
    }

    const body = await request.json();
    const { referralId, serviceId, dateSlot, timeSlot, idempotencyKey } = body;

    if (!referralId || !serviceId || !dateSlot || !timeSlot || !idempotencyKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const refDoc = adminDb()!.collection('referrals').doc(referralId);
    
    // We will do this in a transaction to ensure idempotency and stable token generation
    const result = await adminDb()!.runTransaction(async (t) => {
      const docSnap = await t.get(refDoc);
      if (!docSnap.exists) {
        throw new Error('NOT_FOUND');
      }

      const refData = docSnap.data();
      const facilityId = refData?.target_facility;

      if (!facilityId || facilityId === 'PENDING_ASSIGNMENT') {
         throw new Error('VALIDATION_ERROR: Cannot schedule appointment without an assigned facility.');
      }

      // Check for existing appointment via idempotency key
      const querySnap = await t.get(
        adminDb()!.collection('appointments').where('idempotency_key', '==', idempotencyKey).limit(1)
      );

      if (!querySnap.empty) {
        return querySnap.docs[0].data(); // Return existing
      }

      // Generate a simple token: e.g. based on time or random string. 
      // In a real system, you might increment a daily counter per facility.
      const dailyCounterRef = adminDb()!.collection('facility_stats').doc(`${facilityId}_${dateSlot}`);
      const counterSnap = await t.get(dailyCounterRef);
      const currentCount = counterSnap.exists ? (counterSnap.data()?.token_count || 0) : 0;
      const nextCount = currentCount + 1;
      
      const queueToken = `T-${nextCount.toString().padStart(3, '0')}`;

      // Update counter
      t.set(dailyCounterRef, { token_count: nextCount }, { merge: true });

      const appointmentId = randomUUID();
      const apptRef = adminDb()!.collection('appointments').doc(appointmentId);
      
      const newAppt = {
        id: appointmentId,
        schema_version: 1,
        referral_id: referralId,
        patient_id: refData?.patient_id,
        facility_id: facilityId,
        service_id: serviceId,
        status: 'SCHEDULED',
        date_slot: dateSlot,
        time_slot: timeSlot,
        queue_token: queueToken,
        created_by_uid: decodedToken.uid,
        idempotency_key: idempotencyKey,
        created_at: FieldValue.serverTimestamp(),
        updated_at: FieldValue.serverTimestamp()
      };

      t.set(apptRef, newAppt);
      
      // We also update the referral to easily track its linked appointment
      t.update(refDoc, {
        appointment_id: appointmentId,
        queue_token: queueToken,
        updated_at: FieldValue.serverTimestamp()
      });

      return newAppt;
    });

    return NextResponse.json({ success: true, appointment: result });
  } catch (error: any) {
    console.error('Create Appointment Error:', error);
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }
    if (error.message.startsWith('VALIDATION_ERROR')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
