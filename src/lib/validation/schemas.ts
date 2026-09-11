import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ABHA_NUMBER = /^\d{14}$/;
const ABHA_ADDRESS = /^[a-zA-Z0-9._-]{4,}@[a-zA-Z]{3,}$/;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;

/** Free-text is trimmed and length-capped to bound IndexedDB growth. */
const cleanText = (max: number) =>
  z.string().trim().min(1).max(max);

export const abhaIdSchema = z
  .string()
  .trim()
  .refine(
    (value) => ABHA_NUMBER.test(value.replace(/\s|-/g, '')) || ABHA_ADDRESS.test(value),
    { message: 'Must be a 14-digit ABHA number or a valid ABHA address.' },
  )
  .transform((value) => (ABHA_NUMBER.test(value.replace(/\s|-/g, ''))
    ? value.replace(/\s|-/g, '')
    : value.toLowerCase()));

export const patientIntakeSchema = z.object({
  name: cleanText(120),
  abha_id: abhaIdSchema.nullable().default(null),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  dob: z
    .string()
    .regex(ISO_DATE, 'dob must be YYYY-MM-DD')
    .refine((value) => {
      if (!value) return true;
      const parsed = Date.parse(`${value}T00:00:00Z`);
      return Number.isFinite(parsed) && parsed <= Date.now();
    }, 'dob cannot be in the future')
    .nullable()
    .default(null),
  age_years: z.number().int().min(0).max(130).nullable().default(null),
  phone: z.string().trim().regex(INDIAN_MOBILE, 'Invalid Indian mobile number').nullable().default(null),
});

/**
 * Ranges are plausibility bounds, not clinical reference ranges: they exist to
 * catch unit-entry mistakes (e.g. temperature typed in Fahrenheit) at the point
 * of capture, while still admitting genuinely abnormal readings.
 */
export const vitalsSchema = z
  .object({
    temperature_f: z.number().min(90).max(110).optional(),
    systolic_bp: z.number().int().min(50).max(300).optional(),
    diastolic_bp: z.number().int().min(20).max(200).optional(),
    pulse_bpm: z.number().int().min(20).max(250).optional(),
    spo2_percent: z.number().int().min(40).max(100).optional(),
    respiratory_rate: z.number().int().min(5).max(80).optional(),
    blood_glucose_mgdl: z.number().min(20).max(700).optional(),
    weight_kg: z.number().min(0.5).max(300).optional(),
    height_cm: z.number().min(20).max(250).optional(),
    muac_cm: z.number().min(5).max(50).optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.systolic_bp === undefined ||
      v.diastolic_bp === undefined ||
      v.systolic_bp > v.diastolic_bp,
    { message: 'Systolic BP must exceed diastolic BP', path: ['systolic_bp'] },
  );

export const triageIntakeSchema = z.object({
  symptoms: z.array(cleanText(80)).min(1, 'At least one symptom is required').max(40),
  vitals: vitalsSchema,
  risk_level: z.enum(['RED', 'YELLOW', 'GREEN']),
  recommended_action: cleanText(500),
});

export const referralIntakeSchema = z.object({
  target_facility: cleanText(160),
  urgency: z.enum(['ROUTINE', 'URGENT', 'EMERGENCY']),
});

export type PatientIntakeInput = z.input<typeof patientIntakeSchema>;
export type TriageIntakeInput = z.input<typeof triageIntakeSchema>;
export type ReferralIntakeInput = z.input<typeof referralIntakeSchema>;
