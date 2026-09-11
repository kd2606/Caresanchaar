'use client';

import { useCallback, useState } from 'react';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { useTranslations } from 'next-intl';

interface SyncStatusBarProps {
  /** Optional label shown on the left (e.g. facility or worker name). */
  label?: string;
  className?: string;
}

export function SyncStatusBar({ label, className = '' }: SyncStatusBarProps) {
  const { isOnline, isSyncing, pendingCount, lastError, syncPendingData } = useOfflineSync();
  const t = useTranslations('worker.dashboard');

  const [isErrorOpen, setIsErrorOpen] = useState<boolean>(false);

  const handleSyncNow = useCallback(async (): Promise<void> => {
    if (isSyncing) return;
    try {
      await syncPendingData('manual');
    } catch {
      // Swallow: the hook surfaces failures through `lastError`.
    }
  }, [isSyncing, syncPendingData]);

  const isSyncDisabled: boolean = isSyncing || !isOnline;

  return (
    <div
      className={`w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur supports-[backdrop-filter]:bg-slate-900/60 ${className}`}
    >
      <div className="mx-auto flex h-12 w-full max-w-7xl items-center gap-3 px-4">
        {/* Network status */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2" aria-hidden="true">
            {isOnline ? (
              <>
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_2px_rgba(52,211,153,0.6)]" />
              </>
            ) : (
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400 shadow-[0_0_8px_2px_rgba(248,113,113,0.5)]" />
            )}
          </span>

          <span
            className={`text-xs font-medium tracking-wide ${
              isOnline ? 'text-emerald-400' : 'text-red-400'
            }`}
            role="status"
            aria-live="polite"
          >
            {isOnline ? t('online') : t('offline')}
          </span>
        </div>

        <span className="h-4 w-px bg-slate-800" aria-hidden="true" />

        {/* Pending queue */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">{t('queue')}</span>
          <span
            className={`inline-flex min-w-6 items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
              pendingCount > 0
                ? 'bg-yellow-500/10 text-yellow-400'
                : 'bg-emerald-500/10 text-emerald-400'
            }`}
          >
            {pendingCount}
          </span>
          {isSyncing ? (
            <span className="text-xs text-slate-400">Syncing…</span>
          ) : null}
        </div>

        {label ? (
          <>
            <span className="h-4 w-px bg-slate-800" aria-hidden="true" />
            <span className="truncate text-xs text-slate-400">{label}</span>
          </>
        ) : null}

        <div className="ml-auto flex items-center gap-2">
          {lastError ? (
            <button
              type="button"
              onClick={() => setIsErrorOpen((open) => !open)}
              className="rounded-md bg-red-500/10 px-2 py-1 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/40"
              aria-expanded={isErrorOpen}
            >
              {t('syncIssue')}
            </button>
          ) : null}

          <button
            type="button"
            onClick={handleSyncNow}
            disabled={isSyncDisabled}
            className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:border-slate-700 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            title={!isOnline ? 'Sync unavailable while offline' : 'Sync now'}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            >
              <path d="M21 12a9 9 0 1 1-3.2-6.9" />
              <path d="M21 4v5h-5" />
            </svg>
            {isSyncing ? t('syncing') : t('syncNow')}
          </button>
        </div>
      </div>

      {lastError && isErrorOpen ? (
        <div className="border-t border-slate-800 bg-slate-900 px-4 py-2">
          <p className="mx-auto max-w-7xl break-words text-xs text-red-400">
            {lastError}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export default SyncStatusBar;
