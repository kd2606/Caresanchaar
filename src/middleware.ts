import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { verifySessionCookie } from './lib/auth/verify-session';

const handleI18n = createMiddleware(routing);
const SESSION_COOKIE = '__session';

/**
 * Normalise Firebase custom-claim role strings to the three dashboard
 * segments the app actually uses.  Firebase claims use values like
 * 'district_admin', 'mo', 'admin', 'asha', 'worker', 'patient'.
 * Returns null for unknown / missing roles so we never silently
 * default to 'patient'.
 */
type DashboardRole = 'patient' | 'worker' | 'district';

function normalisedRole(claimRole: string | undefined): DashboardRole | null {
  if (!claimRole) return null;
  if (claimRole === 'patient') return 'patient';
  if (claimRole === 'worker' || claimRole === 'asha') return 'worker';
  if (claimRole === 'district_admin' || claimRole === 'mo' || claimRole === 'admin' || claimRole === 'district') return 'district';
  return null;
}

const HOME_FOR: Record<DashboardRole, string> = {
  patient: '/dashboard/patient',
  worker: '/dashboard/worker',
  district: '/dashboard/district',
};

function stripLocale(pathname: string) {
  const [, maybeLocale, ...rest] = pathname.split('/');
  if ((routing.locales as readonly string[]).includes(maybeLocale)) {
    return { locale: maybeLocale, path: '/' + rest.join('/') };
  }
  return { locale: routing.defaultLocale, path: pathname };
}

function localized(locale: string, path: string) {
  return `/${locale}${path}`;
}

export default async function proxy(request: NextRequest) {
  const { locale, path } = stripLocale(request.nextUrl.pathname);

  if (!path.startsWith('/dashboard')) {
    return handleI18n(request);
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? await verifySessionCookie(token) : null;

  if (!claims) {
    const url = request.nextUrl.clone();
    // For generic /dashboard with no session, send to landing page (neutral)
    // For role-specific dashboard paths, send to the matching auth page
    let authPath = '/';
    if (path.startsWith('/dashboard/patient')) {
      authPath = '/auth/patient';
    } else if (path.startsWith('/dashboard/worker')) {
      authPath = '/auth/worker';
    } else if (path.startsWith('/dashboard/district')) {
      authPath = '/auth/district';
    }
    url.pathname = localized(locale, authPath);
    url.search = authPath === '/' ? '' : `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  let role = normalisedRole(claims.role as string | undefined);

  // If role is missing from claims, infer from the dashboard path the user is
  // trying to reach. This covers demo users and newly signed-up users whose
  // custom claims haven't propagated to the session cookie yet.
  if (!role) {
    if (path.startsWith('/dashboard/worker')) {
      role = 'worker';
    } else if (path.startsWith('/dashboard/district')) {
      role = 'district';
    } else if (path.startsWith('/dashboard/patient')) {
      role = 'patient';
    }
  }

  // Still unknown — clear session, send to landing
  if (!role) {
    const url = request.nextUrl.clone();
    url.pathname = localized(locale, '/');
    url.search = '';
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  

  const allowed =
    
    (role === 'patient' && path.startsWith('/dashboard/patient')) ||
    (role === 'worker' && path.startsWith('/dashboard/worker')) ||
    (role === 'district' &&
      (path.startsWith('/dashboard/district') || path.startsWith('/dashboard/worker')));

  if (path === '/dashboard' || path === '/dashboard/' || !allowed) {
    const url = request.nextUrl.clone();
    url.pathname = localized(locale, HOME_FOR[role]);
    url.search = '';
    return NextResponse.redirect(url);
  }

  return handleI18n(request);
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
