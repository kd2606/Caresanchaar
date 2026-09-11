// src/lib/logger.ts
// Thin structured logger. Console-based for now; wire to Sentry / Cloud Logging later.
// warn and error are always on. info is suppressed in production.

type LogContext = Record<string, unknown>;

const IS_PROD = process.env.NODE_ENV === 'production';

function formatArgs(message: string, ctx?: LogContext): [string, ...unknown[]] {
  if (!ctx || Object.keys(ctx).length === 0) return [message];
  return [message, ctx];
}

export const logger = {
  info(message: string, ctx?: LogContext): void {
    if (!IS_PROD) {
      console.info(`[INFO] ${message}`, ...formatArgs('', ctx).slice(1));
    }
  },

  warn(message: string, ctx?: LogContext): void {
    console.warn(`[WARN] ${message}`, ...formatArgs('', ctx).slice(1));
  },

  error(message: string, ctx?: LogContext): void {
    console.error(`[ERROR] ${message}`, ...formatArgs('', ctx).slice(1));
  },
} as const;
