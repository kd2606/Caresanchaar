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
      let homePath = '';

      if (role === 'worker' || role === 'asha') {
        homePath = '/dashboard/worker';
      } else if (role === 'district_admin' || role === 'mo' || role === 'admin' || role === 'district') {
        homePath = '/dashboard/district';
      }

      await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: result.token }),
      });

      // 3. Block missing/unknown roles completely
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

      // 5. Strict path isolation
      let isAllowed = false;
      if (role === 'worker' || role === 'asha') {
        isAllowed = purePath.startsWith('/dashboard/worker');
      } else if (role === 'district_admin' || role === 'mo' || role === 'admin' || role === 'district') {
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
