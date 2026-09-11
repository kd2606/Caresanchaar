export default function FullScreenLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-slate-900"
    >
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-emerald-500" />
      <p className="text-sm text-slate-400">Verifying your secure session…</p>
      <span className="sr-only">Loading</span>
    </div>
  );
}
