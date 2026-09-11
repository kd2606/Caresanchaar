import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth()!.verifyIdToken(token);
    const role = decodedToken.role;
    const uid = decodedToken.uid;

    if (!role || typeof role !== 'string') {
       return NextResponse.json({ error: 'Forbidden: Missing Role' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');
    if (!patientId) {
      return NextResponse.json({ error: 'Missing patientId' }, { status: 400 });
    }

    // 1. Fetch Patient Record
    const patientSnap = await adminDb()!.collection('patients').doc(patientId).get();
    if (!patientSnap.exists) {
      return NextResponse.json({ error: 'Patient not found' }, { status: 404 });
    }
    const patientData = patientSnap.data();

    // 2. Fetch Consent from standardized 'consents' collection
    const consentQueryTop = await adminDb()!.collection('consents')
       .where('patient_id', '==', patientId)
       .orderBy('timestamp', 'desc')
       .limit(1)
       .get();
    const consentData: any = consentQueryTop.empty ? null : consentQueryTop.docs[0].data();
    const hasActiveConsent = consentData?.status === 'ACTIVE' && consentData?.validity_until >= Date.now();

    // 3. Authorization & Purpose Scope Verification
    let authorized = false;
    let accessPurpose = '';

    if (role === 'worker' || role === 'asha') {
       // Worker authorization: must be the creator of the patient record
       if (patientData?.created_by === uid || patientData?.owner_uid === uid) {
          authorized = true;
          accessPurpose = 'CARE_CONTINUITY_OWNER';
       }
    } else if (role === 'mo') {
       // MO authorization: patient must have an active/past referral assigned to this MO's facility
       if (!decodedToken.facility_id) {
          return NextResponse.json({ error: 'Forbidden: Medical Officer missing facility claim' }, { status: 403 });
       }
       const refSnap = await adminDb()!.collection('referrals')
          .where('patient_id', '==', patientId)
          .where('target_facility', '==', decodedToken.facility_id)
          .limit(1)
          .get();

       if (!refSnap.empty) {
           // MO authorized via active referral to their facility
          authorized = true;
          accessPurpose = 'FACILITY_REFERRAL_TREATMENT';
       }
    } else if (role === 'district_admin' || role === 'admin') {

         // District Admin Authorization via Consent Infrastructure
         if (!hasActiveConsent) {
            return NextResponse.json({ error: 'Forbidden: District Admin requires active consent.' }, { status: 403 });
         }

         // District boundary check
         if (role === 'district_admin' && decodedToken.district_id && patientData?.districtId && patientData.districtId !== decodedToken.district_id) {
            return NextResponse.json({ error: 'Forbidden: Cross-district access denied.' }, { status: 403 });
         }

         if (consentData.scope === 'DISTRICT_LEVEL' || consentData.purpose === 'BREAK_GLASS') {
            authorized = true;
            accessPurpose = consentData.purpose;
         } else {
            return NextResponse.json({ error: 'Forbidden: Consent scope insufficient.' }, { status: 403 });
         }

    }

    if (!authorized) {
       return NextResponse.json({ error: 'Forbidden: You do not have authorization or consent to view this patient timeline.' }, { status: 403 });
    }

    // 4. Fetch Timeline Events (Chronological Data Collection)

    // A. Referrals
    const referralsSnap = await adminDb()!.collection('referrals').where('patient_id', '==', patientId).get();
    const referrals = referralsSnap.docs.map(d => ({ id: d.id, _type: 'REFERRAL', ...d.data() }));

    // B. Referral Events (Audits)
    const refIds = referrals.map(r => r.id);
    let referralEvents: any[] = [];
    if (refIds.length > 0) {
       // Batched IN query (max 30)
       for (let i = 0; i < refIds.length; i += 30) {
          const chunk = refIds.slice(i, i + 30);
          const evSnap = await adminDb()!.collection('referral_events').where('referral_id', 'in', chunk).get();
          const evs = evSnap.docs.map(d => {
             const data = d.data();
             // Redact sensitive clinical notes from audit events if the viewer is not the MO or Worker assigned
             let note = data.note;
             if (role === 'district_admin' && !accessPurpose.includes('BREAK_GLASS')) {
                note = '[REDACTED FOR PRIVACY]';
             }
             return { id: d.id, _type: 'REFERRAL_EVENT', ...data, note };
          });
          referralEvents = [...referralEvents, ...evs];
       }
    }

    // C. Triage Records
    const triageSnap = await adminDb()!.collection('triage_records').where('patient_id', '==', patientId).get();
    const triageRecords = triageSnap.docs.map(d => ({ id: d.id, _type: 'TRIAGE', ...d.data() }));

    // D. Appointments
    const appointmentsSnap = await adminDb()!.collection('appointments').where('patient_id', '==', patientId).get();
    const appointments = appointmentsSnap.docs.map(d => ({ id: d.id, _type: 'APPOINTMENT', ...d.data() }));

    // E. Follow-up Records
    const followupsSnap = await adminDb()!.collection('followup_records').where('patient_id', '==', patientId).get();
    const followups = followupsSnap.docs.map(d => ({ id: d.id, _type: 'FOLLOW_UP_RECORD', ...d.data() }));

    // 5. Unify, Sort, and Redact Timeline
    const rawTimeline = [...referrals, ...referralEvents, ...triageRecords, ...appointments, ...followups];

    const sortedTimeline = rawTimeline.sort((a, b) => {
       const timeA = a.created_at?.toMillis?.() || a.timestamp || a.occurred_at?.toMillis?.() || 0;
       const timeB = b.created_at?.toMillis?.() || b.timestamp || b.occurred_at?.toMillis?.() || 0;
       return timeB - timeA; // Descending
    });

    // Strip unneeded/sensitive PII from timeline payload if role isn't the primary owner
    const sanitizedPatient = {
       id: patientId,
       name: patientData?.name || 'Unknown Patient',
       age: patientData?.age || 'Unknown',
       gender: patientData?.gender || 'Unknown',
       // Do not send exact coordinates unless absolutely necessary
       village: patientData?.village || 'Unknown Location',
       abha_id: role === 'worker' || accessPurpose === 'FACILITY_REFERRAL_TREATMENT' ? (patientData?.abha_id || null) : '[REDACTED]'
    };

    return NextResponse.json({
       success: true,
       patient: sanitizedPatient,
       consentStatus: consentData?.status,
       accessPurpose,
       timeline: sortedTimeline
    });

  } catch (error: any) {
    console.error('Timeline API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
