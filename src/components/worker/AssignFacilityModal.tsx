'use client';

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase/client';

type Facility = { id: string; name: string; type?: string; block?: string };

export function useFacilityCatalog(open: boolean) {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setState('loading');
      try {
        const token = await auth.currentUser?.getIdToken(true); // fresh claims
        const res = await fetch('/api/facility/list', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        const list: Facility[] = Array.isArray(data) ? data : data.facilities ?? [];
        if (cancelled) return;
        setFacilities(list);
        setState('ready'); // empty list is a valid state, not an error
      } catch {
        if (!cancelled) { setFacilities([]); setState('error'); }
      }
    })();

    return () => { cancelled = true; };
  }, [open]);

  return { facilities, state };
}
