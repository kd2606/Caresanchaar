import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return NextResponse.json({ error: 'no token' }, { status: 401 });
  try {
    const decoded = await adminAuth()!.verifyIdToken(token);
    return NextResponse.json({ uid: decoded.uid, email: decoded.email, claims: decoded });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
}
