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
    const allowedRoles = ['mo', 'district_admin', 'admin'];
    if (!role || typeof role !== 'string' || !allowedRoles.includes(role)) {
       return NextResponse.json({ error: 'Forbidden: Invalid Role' }, { status: 403 });
    }

    const body = await request.json();
    const { referralId, disposition, notes, dueDate } = body;

    if (!referralId || !disposition) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const refDoc = adminDb()!.collection('referrals').doc(referralId);
    
    await adminDb()!.runTransaction(async (t) => {
      const docSnap = await t.get(refDoc);
      if (!docSnap.exists) {
        throw new Error('NOT_FOUND');
      }

      const data = docSnap.data();
      const currentStatus = data?.status || 'CREATED';
      
      if (currentStatus === 'CLOSED') {
        throw new Error('VALIDATION_ERROR: Cannot modify a closed referral.');
      }
      
      // Ensure the MO actually has scope to this referral's facility
      if (role === 'mo' && decodedToken.facility_id && data?.target_facility !== decodedToken.facility_id) {
         throw new Error('SCOPE_ERROR: Referral target facility does not match Medical Officer facility');
      }

      const nextStatus = (disposition === 'unable_to_attend' || disposition === 'treated' || disposition === 'referred_onward') ? 'CLOSED' : 'INFO_REQUESTED'; 
      // If follow_up_required, we keep it active (INFO_REQUESTED is closest to worker follow-up).
      // Or we can set it to CLOSED if follow up is a separate task. Let's make follow up keep it active for the worker to address, or we can close it and let the worker start a new one.
      // Instructions: "Allow closure only after a consultation/outcome exists, or clearly record an approved exception such as unable-to-attend."
      
      const updateData: any = {
        status: nextStatus,
        outcome_disposition: disposition,
        outcome_notes: notes || '',
        updated_at: FieldValue.serverTimestamp(),
        rev: (data?.rev || 0) + 1
      };

      t.update(refDoc, updateData);

      // Also update the appointment if one exists
      if (data?.appointment_id) {
         const apptDoc = adminDb()!.collection('appointments').doc(data.appointment_id);
         t.update(apptDoc, {
            status: 'COMPLETED',
            updated_at: FieldValue.serverTimestamp()
         });
      }

      // Audit event
      const auditRef = adminDb()!.collection('referral_events').doc();
      t.set(auditRef, {
        referral_id: referralId,
        actor_uid: decodedToken.uid,
        action: 'CONSULTATION_OUTCOME',
        disposition: disposition,
        note: notes || '',
        occurred_at: FieldValue.serverTimestamp()
      });

      // If follow up required, create a worker task
      if (disposition === 'follow_up_required') {
         const newTaskRef = adminDb()!.collection('worker_tasks').doc();
         t.set(newTaskRef, {
            worker_uid: data?.created_by || data?.owner_uid,
            referral_id: referralId,
            type: 'FOLLOW_UP',
            status: 'PENDING',
            note: notes || `Follow-up required for referral ${referralId}`,
            due_date: dueDate || null,
            created_at: FieldValue.serverTimestamp()
         });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Outcome Error:', error);
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }
    if (error.message.startsWith('VALIDATION_ERROR') || error.message.startsWith('SCOPE_ERROR')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
