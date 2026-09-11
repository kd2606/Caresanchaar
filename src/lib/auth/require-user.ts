import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth } from '@/lib/firebase/admin';
import type { Role } from '@/lib/auth/verify-session';

export async function requireUser(allowed: Role[]) {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('__session')?.value;
  if (!cookie) redirect('/auth');

  try {
    const claims = await adminAuth()!.verifySessionCookie(cookie, true);
    const role = (claims.role as Role);
    if (!role || !allowed.includes(role)) redirect('/');
    return { uid: claims.sub, role, claims };
  } catch {
    redirect('/auth');
  }
}

