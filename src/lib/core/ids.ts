declare const __brand: unique symbol;

export type Branded<T, B extends string> = T & { readonly [__brand]: B };

export type PatientId = Branded<string, 'PatientId'>;
export type TriageRecordId = Branded<string, 'TriageRecordId'>;
export type ReferralId = Branded<string, 'ReferralId'>;
export type DeviceId = Branded<string, 'DeviceId'>;

function randomUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Deterministic-length fallback for older Android WebViews (very common on
  // ASHA-issued handsets). Uses CSPRNG bytes, not Math.random().
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const newPatientId = (): PatientId => randomUuid() as PatientId;
export const newTriageRecordId = (): TriageRecordId => randomUuid() as TriageRecordId;
export const newReferralId = (): ReferralId => randomUuid() as ReferralId;

const DEVICE_ID_KEY = 'caresanchaar.device_id';

/** Stable per-install identifier used for audit trails and conflict tie-breaks. */
export function getDeviceId(): DeviceId {
  if (typeof localStorage === 'undefined') return 'server' as DeviceId;
  const existing = localStorage.getItem(DEVICE_ID_KEY);
  if (existing !== null && existing.length > 0) return existing as DeviceId;
  const created = randomUuid();
  localStorage.setItem(DEVICE_ID_KEY, created);
  return created as DeviceId;
}
