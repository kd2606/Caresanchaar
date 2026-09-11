import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

const TRANSITIONS: Record<string, Record<string, string[]>> = {
  mo: {
    CREATED: ['ACCEPTED', 'INFO_REQUESTED', 'REJECTED'],
    ACCEPTED: ['CLOSED'],
    INFO_REQUESTED: ['CLOSED', 'ACCEPTED'],
    REJECTED: ['CLOSED']
  },
  district_admin: {
    CREATED: ['ACCEPTED', 'INFO_REQUESTED', 'REJECTED', 'CLOSED'],
    ACCEPTED: ['CLOSED'],
    INFO_REQUESTED: ['CLOSED', 'ACCEPTED'],
    REJECTED: ['CLOSED']
  },
  worker: { // ASHA role name depends on custom claims, usually 'worker' or 'asha'
    INFO_REQUESTED: ['CREATED'],
    REJECTED: ['CREATED'] // Allow resubmission
  },
  asha: {
    INFO_REQUESTED: ['CREATED'],
    REJECTED: ['CREATED']
  }
};

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
    const { referralId, status, note, taskId } = body;

    if (!referralId || !status) {
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
      
      // Idempotency check: if status is already the requested status, do nothing (or return success).
      if (currentStatus === status) {
        return;
      }
      
      // Validate transition
      const roleTransitions = TRANSITIONS[role] || {};
      const allowedNextStates = roleTransitions[currentStatus] || [];
      if (!allowedNextStates.includes(status)) {
         throw new Error(`INVALID_TRANSITION: Cannot move from ${currentStatus} to ${status} as ${role}`);
      }

      // Scope checking for MO: ensure MO is assigned to the target_facility
      if (role === 'mo' && decodedToken.facility_id && data?.target_facility !== decodedToken.facility_id) {
         throw new Error('SCOPE_ERROR: Referral target facility does not match Medical Officer facility');
      }
      
      // Scope checking for worker: ensure the worker is the creator
      if ((role === 'worker' || role === 'asha') && (data?.created_by !== decodedToken.uid && data?.owner_uid !== decodedToken.uid)) {
         throw new Error('SCOPE_ERROR: Worker does not own this referral');
      }

      // Update Referral
      t.update(refDoc, {
        status,
        updated_at: FieldValue.serverTimestamp(),
        rev: (data?.rev || 0) + 1
      });

      // Write audit event
      const auditRef = adminDb()!.collection('referral_events').doc();
      t.set(auditRef, {
        referral_id: referralId,
        actor_uid: decodedToken.uid,
        action: status,
        note: note || '',
        occurred_at: FieldValue.serverTimestamp()
      });

      // Generate a follow-up task for the ASHA worker if requested info or rejected
      if (status === 'INFO_REQUESTED' || status === 'REJECTED') {
         const newTaskRef = adminDb()!.collection('worker_tasks').doc();
         t.set(newTaskRef, {
            worker_uid: data?.created_by || data?.owner_uid,
            referral_id: referralId,
            type: 'FOLLOW_UP',
            status: 'PENDING',
            note: note || `Follow up on referral ${referralId}`,
            created_at: FieldValue.serverTimestamp()
         });
      }
      
      // If the worker is responding to a task, mark it as completed
      if (taskId && status === 'CREATED' && (role === 'worker' || role === 'asha')) {
         const taskDoc = adminDb()!.collection('worker_tasks').doc(taskId);
         t.update(taskDoc, {
            status: 'COMPLETED',
            resolved_at: FieldValue.serverTimestamp(),
            resolution_note: note || ''
         });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Transition Error:', error);
    
    // Generic server errors for production
    if (error.message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Referral not found' }, { status: 404 });
    }
    if (error.message.startsWith('INVALID_TRANSITION') || error.message.startsWith('SCOPE_ERROR')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
