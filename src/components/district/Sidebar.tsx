'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  LayoutDashboard,
  Stethoscope,
  Ambulance,
  ClipboardList,
  BarChart3,
  Settings,
  LogOut,
  Loader2,
} from 'lucide-react';
import { useAuthClaims } from '@/hooks/useAuthClaims';

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

/** next-intl throws on a missing key. During a live demo we never want a
 *  missing translation to blank the sidebar, so every lookup is guarded. */
function useSafeT(namespace?: string) {
  const t = useTranslations(namespace as never);
  return useCallback(
    (key: string, fallback: string) => {
      try {
        const value = t(key as never) as unknown as string;
        if (!value || value.includes(key)) return fallback;
        return value;
      } catch {
        return fallback;
      }
    },
    [t]
  );
}

const HONORIFICS = new Set(['dr', 'dr.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'shri', 'smt', 'prof', 'prof.']);

/** "Dr. Jaskeerat Singh Rangi" -> "JR" ; "singhrangijaskeerat" -> "SI" */
export function getInitials(name?: string | null): string {
  if (!name) return '';
  const parts = name
    .replace(/[^\p{L}\p{N}\s.'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((p) => !HONORIFICS.has(p.toLowerCase()));

  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "singhrangijaskeerat@gmail.com" -> "Singhrangijaskeerat"
 *  "jaskeerat.singh@x.in"          -> "Jaskeerat Singh"            */
export function nameFromEmail(email?: string | null): string | null {
  if (!email || !email.includes('@')) return null;
  const local = email.split('@')[0];
  if (!local) return null;
  return local
    .split(/[._\-+]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** The hook shape can vary between builds, so read it defensively. */
function useResolvedIdentity() {
  const raw = useAuthClaims() as Record<string, any> | null | undefined;

  const [fallbackUser, setFallbackUser] = useState<{
    displayName: string | null;
    email: string | null;
  } | null>(null);

  const user = raw?.user ?? raw?.currentUser ?? null;
  const claims = raw?.claims ?? raw?.customClaims ?? raw?.token ?? raw ?? null;
  const loading = Boolean(raw?.loading ?? raw?.isLoading ?? false);

  // Direct Firebase fallback if the hook hasn't hydrated a user object.
  useEffect(() => {
    if (user) return;
    let cancelled = false;
    (async () => {
      try {
        const { getAuth, onAuthStateChanged } = await import('firebase/auth');
        const auth = getAuth();
        const unsub = onAuthStateChanged(auth, (u) => {
          if (cancelled) return;
          setFallbackUser(u ? { displayName: u.displayName, email: u.email } : null);
        });
        return () => unsub();
      } catch {
        /* firebase not ready on this route – ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const displayName: string | null =
    claims?.name ??
    claims?.displayName ??
    user?.displayName ??
    fallbackUser?.displayName ??
    null;

  const email: string | null = claims?.email ?? user?.email ?? fallbackUser?.email ?? null;

  const role: string | null = claims?.role ?? (Array.isArray(claims?.roles) ? claims.roles[0] : null) ?? null;
  const district: string | null = claims?.district ?? null;

  return { displayName, email, role, district, loading };
}

/* ------------------------------------------------------------------ *
 * Component
 * ------------------------------------------------------------------ */

type NavItem = { key: string; fallback: string; href: string; icon: React.ElementType };

const NAV_ITEMS: NavItem[] = [
  { key: 'nav.overview',  fallback: 'Command Overview', href: '/dashboard/district',            icon: LayoutDashboard },
  { key: 'nav.referrals', fallback: 'Referrals',        href: '/dashboard/district/referrals',  icon: ClipboardList },
  { key: 'nav.transport', fallback: 'Transport',        href: '/dashboard/district/transport',  icon: Ambulance },
  { key: 'nav.catalog',   fallback: 'Service Catalog',  href: '/dashboard/district/catalog',    icon: Stethoscope },
  { key: 'nav.analytics', fallback: 'Analytics',        href: '/dashboard/district/analytics',  icon: BarChart3 },
  { key: 'nav.settings',  fallback: 'Settings',         href: '/dashboard/district/settings',   icon: Settings },
];

export default function Sidebar() {
  const tx = useSafeT('district.sidebar');
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const { displayName, email, role, district, loading } = useResolvedIdentity();
  const [signingOut, setSigningOut] = useState(false);

  const resolvedName = useMemo(() => {
    return (
      displayName?.trim() ||
      nameFromEmail(email) ||
      tx('fallbackName', 'District Admin')
    );
  }, [displayName, email, tx]);

  const initials = useMemo(() => {
    return getInitials(resolvedName) || getInitials(nameFromEmail(email)) || 'DA';
  }, [resolvedName, email]);

  const roleLabel = useMemo(() => {
    const r = (role ?? '').toLowerCase();
    const base =
      r === 'mo'
        ? tx('role.mo', 'Medical Officer')
        : r === 'admin'
        ? tx('role.admin', 'Administrator')
        : r
        ? r.toUpperCase()
        : tx('role.default', 'District Admin');
    return district ? `${base} · ${district}` : base;
  }, [role, district, tx]);

  const isActive = useCallback(
    (href: string) => {
      const full = `/${locale}${href}`;
      if (href === '/dashboard/district') return pathname === full || pathname === `${full}/`;
      return pathname?.startsWith(full);
    },
    [pathname, locale]
  );

  const handleSignOut = useCallback(async () => {
    setSigningOut(true);
    try {
      const { getAuth, signOut } = await import('firebase/auth');
      await signOut(getAuth());
    } catch {
      /* fall through to redirect regardless */
    } finally {
      router.push(`/${locale}/login`);
    }
  }, [router, locale]);

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white">
      {/* Brand */}
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600 text-sm font-bold text-white">
          CS
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">
            {tx('brand', 'CareSanchaar')}
          </p>
          <p className="text-xs text-slate-500">
            {tx('subtitle', 'District Command')}
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map(({ key, fallback, href, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={`/${locale}${href}`}
              aria-current={active ? 'page' : undefined}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-teal-50 font-medium text-teal-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
              ].join(' ')}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{tx(key, fallback)}</span>
            </Link>
          );
        })}
      </nav>

      {/* User card — fully dynamic */}
      <div className="border-t border-slate-200 p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-semibold text-white"
            aria-hidden
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900" title={resolvedName}>
              {loading ? tx('loading', 'Loading…') : resolvedName}
            </p>
            <p className="truncate text-xs text-slate-500" title={email ?? undefined}>
              {roleLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label={tx('signOut', 'Sign out')}
            title={tx('signOut', 'Sign out')}
            className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
          >
            {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
}
