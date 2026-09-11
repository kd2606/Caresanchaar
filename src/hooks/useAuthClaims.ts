'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase/client';

type Claims = Record<string, any> | null;

export function useAuthClaims() {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Claims>(null);
  const [loading, setLoading] = useState(true);
  const forcedOnce = useRef<Set<string>>(new Set());

  useEffect(() => {
    // NOTE: getIdTokenResult(true) re-fires onIdTokenChanged.
    // The forcedOnce guard is what stops an infinite refresh loop.
    const unsub = onIdTokenChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setClaims(null);
        setLoading(false);
        return;
      }
      const force = !forcedOnce.current.has(u.uid);
      if (force) forcedOnce.current.add(u.uid);
      try {
        const res = await u.getIdTokenResult(force);
        setUser(u);
        setClaims(res.claims);
      } finally {
        setLoading(false);
      }
    });
    return unsub;
  }, []);

  /** Hard refresh: re-mint the token from Firebase servers, bypassing the 1h cache. */
  const refreshClaims = useCallback(async (attempts = 3): Promise<Claims> => {
    const u = auth.currentUser;
    if (!u) return null;
    for (let i = 0; i < attempts; i++) {
      await u.reload();
      const res = await u.getIdTokenResult(true);
      setClaims(res.claims);
      if (res.claims.worker || res.claims.role) return res.claims;
      await new Promise((r) => setTimeout(r, 800)); // claim propagation lag
    }
    return null;
  }, []);

  /** Self-heal: ask the server to (re)assign the role, then re-mint the token. */
  const ensureRole = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) return null;
    const token = await u.getIdToken();
    await fetch('/api/auth/assign-role', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestedRole: 'worker' }),
    }).catch(() => {});
    return refreshClaims();
  }, [refreshClaims]);

  const role = (claims?.role as string) ?? null;

  return {
    user,
    claims,
    loading,
    role,
    isWorker: Boolean(claims?.worker || role === 'worker'),
    isMO: Boolean(claims?.mo || claims?.admin || role === 'mo'),
    refreshClaims,
    ensureRole,
  };
}
