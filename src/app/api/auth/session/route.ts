import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const SESSION_COOKIE = '__session';
const EXPIRES_IN_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const idToken = body?.idToken;
    if (!idToken) return NextResponse.json({ error: 'missing idToken' }, { status: 400 });

    let maxAge = 3600; // fallback to 1 hour
    try {
      const payloadBase64 = idToken.split('.')[1];
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf8'));
      if (payload.exp) {
        const now = Math.floor(Date.now() / 1000);
        maxAge = Math.max(0, payload.exp - now);
      }
    } catch (e) {
      console.warn("Failed to decode token exp for cookie maxAge", e);
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
