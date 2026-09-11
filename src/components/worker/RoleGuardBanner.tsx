'use client';

import { useState } from 'react';
import { useAuthClaims } from '@/hooks/useAuthClaims';

export function RoleGuardBanner() {
  const { loading, isWorker, ensureRole } = useAuthClaims();
  const [busy, setBusy] = useState(false);

  if (loading || isWorker) return null;

  return (
    <div className="flex items-center gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>Account lacks the worker role. Your session token may be stale.</span>
      <button
        className="rounded bg-red-600 px-3 py-1 font-medium text-white disabled:opacity-50"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try { await ensureRole(); } finally { setBusy(false); }
        }}
      >
        {busy ? 'Refreshing…' : 'Refresh session'}
      </button>
    </div>
  );
}
