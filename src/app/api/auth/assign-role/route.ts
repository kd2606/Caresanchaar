import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

const DEMO_EMAIL = 'demo@caresanchaarai.in';

/**
 * Assigns a Firebase custom-claim role to a user.
 * For demo users, the role is inferred from the requested dashboard path.
 * For real users, this should only be called during signup/onboarding.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { idToken, role } = body;

    if (!idToken || !role) {
      return NextResponse.json({ error: 'missing idToken or role' }, { status: 400 });
    }

    const validRoles = ['patient', 'worker', 'asha', 'district_admin', 'mo', 'admin', 'district'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'invalid role' }, { status: 400 });
    }

    // Verify the token to get the UID
    let uid = '';
    
    // If FIREBASE_PRIVATE_KEY is missing, we are likely in a local/demo environment
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      console.warn('ASSIGN-ROLE: FIREBASE_PRIVATE_KEY is missing. Skipping token verification and custom claims for local dev.');
      // Extract UID from token payload manually (unsafe for prod, fine for local mock)
      try {
        const payloadBase64 = idToken.split('.')[1];
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
        uid = payload.user_id || payload.sub;
      } catch (e) {
        uid = 'demo_uid';
      }
      return NextResponse.json({ ok: true, role, warning: 'mocked' });
    }

    try {
      const decoded = await adminAuth()!.verifyIdToken(idToken);
      uid = decoded.uid;

      // Set the custom claim (preserve any existing claims)
      const existingUser = await adminAuth()!.getUser(uid);
      const existingClaims = existingUser.customClaims || {};

      // SECURITY FIX: Prevent privilege escalation
      if (['admin', 'district_admin', 'mo', 'district'].includes(role)) {
        if (existingClaims.role !== 'admin') {
           return NextResponse.json({ error: 'Unauthorized: Only admins can assign elevated roles' }, { status: 403 });
        }
      } else if (role === 'worker' || role === 'asha') {
        // Allow self-assignment of 'worker' only if they don't have a role yet
        if (existingClaims.role && existingClaims.role !== 'worker' && existingClaims.role !== 'asha') {
           return NextResponse.json({ error: 'Unauthorized: User already has an assigned role' }, { status: 403 });
        }
      }

      const newClaims: any = { ...existingClaims, role };
      
      // For demo purposes, inject a demo district scope so backend lists work
      if (!newClaims.district_id) {
        newClaims.district_id = 'demo_khordha_01'; // Default demo scope
      }
      
      await adminAuth()!.setCustomUserClaims(uid, newClaims);

      return NextResponse.json({ ok: true, role });
    } catch (adminError: any) {
      console.error('ASSIGN-ROLE ADMIN ERROR:', adminError);
      return NextResponse.json({ success: false, error: "Admin SDK missing/failed, role assignment skipped" }, { status: 200 });
    }
  } catch (error: any) {
    console.error('ASSIGN-ROLE ERROR:', error);
    return NextResponse.json({ success: false, error: "Admin SDK missing/failed, role assignment skipped" }, { status: 200 });
  }
}
