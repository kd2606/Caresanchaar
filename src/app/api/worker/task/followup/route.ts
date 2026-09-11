import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth()!.verifyIdToken(token);
    
    const role = decodedToken.role;
    if (!role || (role !== 'worker' && role !== 'asha')) {
       return NextResponse.json({ error: 'Forbidden: Worker Role Required' }, { status: 403 });
    }

    const body = await request.json();
    const { 
      taskId, 
      referralId, 
      followUpType, 
      vitals, 
      symptoms, 
      adherence, 
      outcomeNotes,
      idempotencyKey 
    } = body;

    if (!taskId || !referralId || !idempotencyKey) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const taskDocRef = adminDb()!.collection('worker_tasks').doc(taskId);
    const refDocRef = adminDb()!.collection('referrals').doc(referralId);
    
    // Hash the idempotency key for safe storage lookup
    const idempHash = crypto.createHash('sha256').update(idempotencyKey).digest('hex');
    const idempDocRef = adminDb()!.collection('idempotency_keys').doc(idempHash);

    await adminDb()!.runTransaction(async (t) => {
      // 1. Idempotency Check
      const idempSnap = await t.get(idempDocRef);
      if (idempSnap.exists) {
         // Already processed successfully, exit safely
         return;
      }

      // 2. Fetch and Validate Task
      const taskSnap = await t.get(taskDocRef);
      if (!taskSnap.exists) throw new Error('TASK_NOT_FOUND');
      
      const taskData = taskSnap.data();
      if (taskData?.worker_uid !== decodedToken.uid) {
         throw new Error('SCOPE_ERROR: Task does not belong to this worker');
      }
      if (taskData?.status === 'COMPLETED') {
         throw new Error('VALIDATION_ERROR: Task is already completed');
      }

      // 3. Fetch and Validate Referral
      const refSnap = await t.get(refDocRef);
      if (!refSnap.exists) throw new Error('REFERRAL_NOT_FOUND');
      
      const refData = refSnap.data();
      if (refData?.status === 'CLOSED') {
         throw new Error('VALIDATION_ERROR: Cannot modify a closed referral');
      }

      // 4. Create the Structured Follow-up Record (Longitudinal Integration)
      const followUpRef = adminDb()!.collection('followup_records').doc();
      const followUpPayload = {
         task_id: taskId,
         referral_id: referralId,
         worker_uid: decodedToken.uid,
         patient_id: refData?.patient_id || null,
         follow_up_type: followUpType || 'GENERAL',
         vitals: vitals || {},
         symptoms: symptoms || [],
         adherence: adherence || 'UNKNOWN',
         notes: outcomeNotes || '',
         created_at: FieldValue.serverTimestamp()
      };
      t.set(followUpRef, followUpPayload);

      // 5. Update Task
      t.update(taskDocRef, {
         status: 'COMPLETED',
         resolved_at: FieldValue.serverTimestamp(),
         resolution_note: 'Structured follow-up completed.',
         followup_record_id: followUpRef.id
      });

      // 6. Transition Referral back to MO Review (CREATED queue)
      // This allows the MO to review the submitted follow-up info
      t.update(refDocRef, {
         status: 'CREATED',
         updated_at: FieldValue.serverTimestamp(),
         rev: (refData?.rev || 0) + 1
      });

      // 7. Write Audit Event
      const auditRef = adminDb()!.collection('referral_events').doc();
      t.set(auditRef, {
         referral_id: referralId,
         actor_uid: decodedToken.uid,
         action: 'FOLLOW_UP_SUBMITTED',
         note: `Structured follow-up completed for type: ${followUpType || 'GENERAL'}`,
         occurred_at: FieldValue.serverTimestamp()
      });

      // 8. Consume Idempotency Key
      t.set(idempDocRef, {
         used_at: FieldValue.serverTimestamp(),
         action: 'FOLLOW_UP_SUBMITTED',
         task_id: taskId
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Follow-up Submit Error:', error);
    
    if (error.message.includes('NOT_FOUND')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message.startsWith('VALIDATION_ERROR') || error.message.startsWith('SCOPE_ERROR')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
