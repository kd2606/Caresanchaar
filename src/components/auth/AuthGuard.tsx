'use client';

import { useEffect, useState } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { auth } from '@/firebase/clientApp';
import { useRouter, usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import FullScreenLoader from './FullScreenLoader';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const t = useTranslations('worker.errors');
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<'checking' | 'authorized' | 'redirecting' | 'unauthorized'>('checking');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    const unsubscribe = onIdTokenChanged(auth, async (user: User | null) => {
      if (cancelled) return;

      const currentLocale = pathname.split('/')[1] || 'en';
      const purePath = pathname.replace(new RegExp('^/' + currentLocale), '') || '/';

      if (!user) {
        setState('redirecting');
        await fetch('/api/auth/session', { method: 'DELETE' });

        let authPath = '/';
        if (purePath.startsWith('/dashboard/worker')) {
          authPath = '/auth/worker';
        } else if (purePath.startsWith('/dashboard/district')) {
          authPath = '/auth/district';
        }

        router.replace('/' + currentLocale + (authPath === '/' ? '' : authPath + '?next=' + encodeURIComponent(pathname)));
        return;
      }

      let result = await user.getIdTokenResult();
      if (cancelled) return;

      let role = result.claims.role as string | undefined;
      let effectiveRole = role;
      let homePath = '';

      if (role === 'patient') {
        homePath = '/dashboard/patient';
      } else if (role === 'worker' || role === 'asha') {
        homePath = '/dashboard/worker';
      } else if (role === 'district_admin' || role === 'mo' || role === 'admin' || role === 'district') {
        homePath = '/dashboard/district';
      }

      // If role is missing, infer from the current dashboard path and ASSIGN BEFORE setting session
      if (!homePath) {
        if (purePath.startsWith('/dashboard/worker')) {
          homePath = '/dashboard/worker';
          effectiveRole = 'worker';
        } else if (purePath.startsWith('/dashboard/district')) {
          homePath = '/dashboard/district';
          effectiveRole = 'district_admin';
        } else if (purePath.startsWith('/dashboard/patient')) {
          homePath = '/dashboard/patient';
          effectiveRole = 'patient';
        }

        if (effectiveRole && effectiveRole !== role) {
          if (!sessionStorage.getItem('role_assign_attempted')) {
            sessionStorage.setItem('role_assign_attempted', 'true');
            try {
              const token = await user.getIdToken();
              await fetch('/api/auth/assign-role', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ idToken: token, role: effectiveRole }),
              });
              // Force refresh token to get the newly assigned custom claims
              await user.getIdToken(true);
              result = await user.getIdTokenResult();
              role = result.claims.role as string | undefined;
            } catch (e) {
              console.warn("Role assignment failed:", e);
            }
          } else {
            console.warn("Role assignment already attempted this session. Skipping to avoid infinite loop.");
          }
        }
      }

      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: result.token }),
      });

      // 3. Block missing/unknown roles completely (only if we can't infer either)
      if (!homePath) {
        if (!role) {
           setErrorMsg(t('missingRole'));
        } else {
           setErrorMsg(t('unknownRole'));
        }
        setState('unauthorized');
        await auth.signOut();
        return;
      }

      // 4. Root dashboard redirect
      if (purePath === '/dashboard' || purePath === '/dashboard/') {
        setState('redirecting');
        router.replace('/' + currentLocale + homePath);
        return;
      }

      // 5. Strict path isolation (use effectiveRole for checking)
      let isAllowed = false;
      if (effectiveRole === 'patient') {
        isAllowed = purePath.startsWith('/dashboard/patient');
      } else if (effectiveRole === 'worker' || effectiveRole === 'asha') {
        isAllowed = purePath.startsWith('/dashboard/worker');
      } else if (effectiveRole === 'district_admin' || effectiveRole === 'mo' || effectiveRole === 'admin' || effectiveRole === 'district') {
        isAllowed = purePath.startsWith('/dashboard/district') || purePath.startsWith('/dashboard/worker');
      }

      if (!isAllowed) {
        setState('redirecting');
        router.replace('/' + currentLocale + homePath);
        return;
      }

      setState('authorized');
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [pathname, router]);

  if (state === 'unauthorized') {
     return (
       <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
         <div className="bg-white rounded-xl shadow p-6 max-w-md w-full text-center border border-red-100">
           <h2 className="text-xl font-bold text-slate-800 mb-2">{t('accessDenied')}</h2>
           <p className="text-slate-600 mb-6">{errorMsg}</p>
           <button
             onClick={() => router.push('/')}
             className="w-full bg-slate-900 text-white rounded-lg py-2 font-medium hover:bg-slate-800"
           >
             {t('returnHome')}
           </button>
         </div>
       </div>
     );
  }

  if (state !== 'authorized') return <FullScreenLoader />;
  return <>{children}</>;
}
