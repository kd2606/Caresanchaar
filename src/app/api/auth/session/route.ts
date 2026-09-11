import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SESSION_COOKIE = '__session';
const EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const idToken = body?.idToken;
    if (!idToken) return NextResponse.json({ error: 'missing idToken' }, { status: 400 });

    // Verify the token securely before accepting it
    const { adminAuth } = await import('@/lib/firebase/admin');
    const auth = adminAuth();
    if (!auth) {
      return NextResponse.json({ error: 'Admin SDK not initialized' }, { status: 500 });
    }
    
    let decoded;
    try {
      decoded = await auth.verifyIdToken(idToken);
    } catch (e) {
      console.warn("Invalid ID token submitted to session endpoint");
      return NextResponse.json({ error: 'Invalid or expired idToken' }, { status: 401 });
    }

    let maxAge = 3600; // fallback to 1 hour
    if (decoded.exp) {
      const now = Math.floor(Date.now() / 1000);
      maxAge = Math.max(0, decoded.exp - now);
    }

    (await cookies()).set(SESSION_COOKIE, idToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: maxAge,
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("SESSION POST ERROR:", error);
    return NextResponse.json({ error: error.message || 'invalid token or server error' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    (await cookies()).delete(SESSION_COOKIE);
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("SESSION DELETE ERROR:", error);
    return NextResponse.json({ error: error.message || 'server error' }, { status: 500 });
  }
}
