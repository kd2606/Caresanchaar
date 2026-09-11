import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header.' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth()!.verifyIdToken(token);
    const role = decodedToken.role;
    
    // Authorization logic
    if (role !== 'mo' && role !== 'admin' && role !== 'district_admin') {
      return NextResponse.json({ error: 'Unauthorized role.' }, { status: 403 });
    }
    
    const facilityId = decodedToken.facility_id;
    const districtId = decodedToken.district_id;
    
    if (role === 'mo' && !facilityId) {
      return NextResponse.json({ error: 'MO token missing facility_id.' }, { status: 403 });
    }

    const body = await request.json();
    const action = body.action; // 'update_profile', 'add_service', 'update_service', 'deactivate_service'
    
    // For admins mapping, they must supply targetFacilityId if they manage multiple.
    // MOs can ONLY ever use their own facilityId.
    const targetFacilityId = role === 'mo' ? facilityId : (body.facilityId || facilityId);
    
    if (!targetFacilityId) {
       return NextResponse.json({ error: 'Missing target facility.' }, { status: 400 });
    }

    const facilityRef = adminDb()!.collection('facilities').doc(targetFacilityId);
    const facilitySnap = await facilityRef.get();
    
    if (!facilitySnap.exists) {
      return NextResponse.json({ error: 'Facility not found.' }, { status: 404 });
    }
    
    const facilityData = facilitySnap.data()!;
    // Ensure cross-district boundaries
    if (facilityData.districtId !== districtId && role !== 'admin') {
      return NextResponse.json({ error: 'Cannot manage facility outside your district.' }, { status: 403 });
    }
    
    if (action === 'update_profile') {
       const updates: any = {};
       if (body.name !== undefined) updates.name = body.name;
       if (body.type !== undefined) updates.type = body.type;
       if (body.status !== undefined) updates.status = body.status;
       if (body.operatingDays !== undefined) updates.operatingDays = body.operatingDays;
       if (body.operatingHours !== undefined) updates.operatingHours = body.operatingHours;
       if (body.address !== undefined) updates.address = body.address;
       if (body.contact !== undefined) updates.contact = body.contact;
       updates.lastUpdatedAt = FieldValue.serverTimestamp();
       
       await facilityRef.update(updates);
       
       // Write audit log (no PII)
       await adminDb()!.collection('audit_events').add({
          event_type: 'FACILITY_PROFILE_UPDATE',
          facility_id: targetFacilityId,
          performed_by: decodedToken.uid,
          timestamp: FieldValue.serverTimestamp(),
          changes: Object.keys(updates)
       });
       
       return NextResponse.json({ success: true });
       
    } else if (action === 'add_service' || action === 'update_service') {
       if (!body.serviceId || !body.serviceName || !body.category || !body.availabilityStatus) {
          return NextResponse.json({ error: 'Missing required service fields.' }, { status: 400 });
       }
       
       const serviceRef = facilityRef.collection('services').doc(body.serviceId);
       
       // Prevent duplicate ID if adding
       if (action === 'add_service') {
          const check = await serviceRef.get();
          if (check.exists) {
             return NextResponse.json({ error: 'Service ID already exists.' }, { status: 400 });
          }
       }
       
       const serviceData = {
          serviceName: body.serviceName,
          category: body.category,
          availabilityStatus: body.availabilityStatus,
          operatingDays: body.operatingDays || '',
          operatingHours: body.operatingHours || '',
          lastUpdatedAt: FieldValue.serverTimestamp(),
          updatedByUid: decodedToken.uid
       };
       
       await serviceRef.set(serviceData, { merge: true });
       
       await adminDb()!.collection('audit_events').add({
          event_type: action === 'add_service' ? 'SERVICE_ADDED' : 'SERVICE_UPDATED',
          facility_id: targetFacilityId,
          service_id: body.serviceId,
          performed_by: decodedToken.uid,
          timestamp: FieldValue.serverTimestamp()
       });
       
       return NextResponse.json({ success: true, serviceId: body.serviceId });
       
    } else if (action === 'deactivate_service') {
       if (!body.serviceId) {
          return NextResponse.json({ error: 'Missing serviceId.' }, { status: 400 });
       }
       
       const serviceRef = facilityRef.collection('services').doc(body.serviceId);
       await serviceRef.update({
          availabilityStatus: 'UNAVAILABLE',
          lastUpdatedAt: FieldValue.serverTimestamp(),
          updatedByUid: decodedToken.uid
       });
       
       await adminDb()!.collection('audit_events').add({
          event_type: 'SERVICE_DEACTIVATED',
          facility_id: targetFacilityId,
          service_id: body.serviceId,
          performed_by: decodedToken.uid,
          timestamp: FieldValue.serverTimestamp()
       });
       
       return NextResponse.json({ success: true });
    }
    
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });

  } catch (error: any) {
    console.error('API Error /facility/manage:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
