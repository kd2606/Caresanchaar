export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export type AppErrorCode =
  | 'VALIDATION_FAILED'
  | 'STORAGE_UNAVAILABLE'
  | 'STORAGE_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NETWORK_UNAVAILABLE'
  | 'REMOTE_REJECTED'
  | 'SYNC_BUSY'
  | 'UNKNOWN';

export interface AppError {
  readonly code: AppErrorCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>> | undefined;
  readonly cause?: unknown;
}

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E = AppError>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

export function appError(
  code: AppErrorCode,
  message: string,
  extra?: { details?: Readonly<Record<string, unknown>>; cause?: unknown },
): AppError {
  return {
    code,
    message,
    details: extra?.details,
    cause: extra?.cause,
  };
}

/** Never leak raw exception objects (may contain PHI) into logs or UI. */
export function describeUnknown(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'string') return error;
  return 'Unknown error';
}
