'use client';

import { useCallback, useMemo, useState, type FormEvent, type ReactNode } from 'react';

import { useTranslations } from 'next-intl';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { saveIntakeOffline } from '@/lib/services/intake.service';
import { runWorkerTriage } from '@/ai/flows/worker-triage';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AIAssistantFAB, type ParsedIntakeData } from '@/components/worker/AIAssistantFAB';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type Gender = 'MALE' | 'FEMALE' | 'OTHER';
type RiskLevel = 'RED' | 'YELLOW' | 'GREEN';

interface AiTriageResult {
  risk_level: RiskLevel;
  risk_score: string;
  explanation: string;
  health_concerns: string[];
  recommended_action: string;
  missing_info: string[];
  referral_urgency: string;
}

interface PatientPayload {
  name: string;
  abha_id?: string;
  gender: Gender;
  dob?: string | null;
  age_years?: number | null;
  phone?: string;
}

interface TriagePayload {
  symptoms: string[];
  vitals: {
    temperature_f: number;
    systolic_bp: number;
    diastolic_bp: number;
  };
  risk_level: RiskLevel;
  recommended_action: string;
}

interface IntakeFormState {
  name: string;
  abha_id: string;
  gender: Gender | '';
  dob: string;
  age_years: string;
  phone: string;
  symptoms: string;
  temperature_f: string;
  systolic_bp: string;
  diastolic_bp: string;
  o2_saturation: string;
  duration: string;
  pregnancy_context: boolean;
  risk_level: RiskLevel | '';
  recommended_action: string;
  consent_granted: boolean;
}

type FieldErrors = Partial<Record<keyof IntakeFormState, string>>;
type SubmitStatus = 'idle' | 'saving' | 'saved' | 'error';

/* -------------------------------------------------------------------------- */
/*                            Constants & helpers                             */
/* -------------------------------------------------------------------------- */

const RISK_DOT: Record<RiskLevel, string> = {
  RED: 'bg-red-500',
  YELLOW: 'bg-amber-400',
  GREEN: 'bg-emerald-500',
};

const INPUT_CLASS =
  'w-full rounded-lg border border-border/50 bg-card/50 px-4 py-3 text-sm text-foreground shadow-sm placeholder:text-muted-foreground outline-none transition-all duration-200 hover:border-border/80 focus:ring-1 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:cursor-not-allowed disabled:opacity-60 backdrop-blur-sm';

const LABEL_CLASS = 'block text-sm font-medium text-foreground mb-1.5';
const CARD_CLASS = 'rounded-xl border border-border bg-card p-5 sm:p-6';

function createInitialState(): IntakeFormState {
  return {
    name: '',
    abha_id: '',
    gender: '',
    dob: '',
    age_years: '',
    phone: '',
    symptoms: '',
    temperature_f: '',
    systolic_bp: '',
    diastolic_bp: '',
    o2_saturation: '',
    duration: '',
    pregnancy_context: false,
    risk_level: '',
    recommended_action: '',
    consent_granted: false,
  };
}

function parseSymptoms(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => {
      if (entry.length === 0) return false;
      const key = entry.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeAbha(raw: string): string {
  return raw.replace(/[\s-]/g, '');
}

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d]/g, '').slice(-10);
}

function toNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/* -------------------------------------------------------------------------- */
/*                              Field primitives                              */
/* -------------------------------------------------------------------------- */

interface FieldProps {
  id: string;
  label: string;
  children: ReactNode;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  optionalLabel?: string;
}

function Field({ id, label, children, required = false, hint, error, className, optionalLabel = 'Optional' }: FieldProps) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={LABEL_CLASS}>
          {label}
          {required ? <span className="ml-1 text-emerald-500">*</span> : null}
        </label>
        {!required ? <span className="text-xs text-muted-foreground">{optionalLabel}</span> : null}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-white" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Page                                    */
/* -------------------------------------------------------------------------- */

export default function NewIntakePage() {
  const t = useTranslations('worker.intake');
  const { syncPendingData } = useOfflineSync();

  const [form, setForm] = useState<IntakeFormState>(createInitialState);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [actionTouched, setActionTouched] = useState<boolean>(false);
  
  const [aiResult, setAiResult] = useState<AiTriageResult | null>(null);
  const [isAiRunning, setIsAiRunning] = useState(false);
  const [aiPendingOffline, setAiPendingOffline] = useState(false);

  const isSaving = status === 'saving';

  /* ---- Localized constants (must be inside component to access t()) ---- */

  const GENDER_OPTIONS: ReadonlyArray<{ value: Gender; label: string }> = useMemo(() => [
    { value: 'MALE', label: t('genderMale') },
    { value: 'FEMALE', label: t('genderFemale') },
    { value: 'OTHER', label: t('genderOther') },
  ], [t]);

  const RISK_OPTIONS: ReadonlyArray<{ value: RiskLevel; label: string; dot: string }> = useMemo(() => [
    { value: 'RED', label: t('riskRed'), dot: RISK_DOT.RED },
    { value: 'YELLOW', label: t('riskYellow'), dot: RISK_DOT.YELLOW },
    { value: 'GREEN', label: t('riskGreen'), dot: RISK_DOT.GREEN },
  ], [t]);

  const DEFAULT_ACTION: Record<RiskLevel, string> = useMemo(() => ({
    RED: t('defaultActionRed'),
    YELLOW: t('defaultActionYellow'),
    GREEN: t('defaultActionGreen'),
  }), [t]);

  /* ---- Localized validation ---- */

  const validate = useCallback((f: IntakeFormState): FieldErrors => {
    const errs: FieldErrors = {};

    if (f.name.trim().length < 2) {
      errs.name = t('validation.nameMin');
    }

    if (f.abha_id.trim() !== '' && !/^\d{14}$/.test(normalizeAbha(f.abha_id))) {
      errs.abha_id = t('validation.abhaInvalid');
    }

    if (f.gender === '') {
      errs.gender = t('validation.genderRequired');
    }

    if (f.dob !== '') {
      const dob = new Date(`${f.dob}

    if (f.age_years !== '') {
      const parsedAge = Number(f.age_years);
      if (!Number.isInteger(parsedAge) || parsedAge < 0 || parsedAge > 130) {
        errs.age_years = 'Invalid age (0-130)';
      }
    }T00:00:00`);
      if (Number.isNaN(dob.getTime())) {
        errs.dob = t('validation.dobInvalid');
      } else if (dob.getTime() > Date.now()) {
        errs.dob = t('validation.dobFuture');
      } else if (dob.getUTCFullYear() < 1900) {
        errs.dob = t('validation.dobTooOld');
      }
    }

    if (f.phone.trim() !== '' && !/^[6-9]\d{9}$/.test(normalizePhone(f.phone))) {
      errs.phone = t('validation.phoneInvalid');
    }

    if (parseSymptoms(f.symptoms).length === 0) {
      errs.symptoms = t('validation.symptomsRequired');
    }

    const temperature = toNumber(f.temperature_f);
    if (temperature === null) {
      errs.temperature_f = t('validation.temperatureRequired');
    } else if (temperature < 90 || temperature > 110) {
      errs.temperature_f = t('validation.temperatureRange');
    }

    const systolic = toNumber(f.systolic_bp);
    if (systolic === null) {
      errs.systolic_bp = t('validation.systolicRequired');
    } else if (!Number.isInteger(systolic) || systolic < 60 || systolic > 260) {
      errs.systolic_bp = t('validation.systolicRange');
    }

    const diastolic = toNumber(f.diastolic_bp);
    if (diastolic === null) {
      errs.diastolic_bp = t('validation.diastolicRequired');
    } else if (!Number.isInteger(diastolic) || diastolic < 30 || diastolic > 200) {
      errs.diastolic_bp = t('validation.diastolicRange');
    }

    if (systolic !== null && diastolic !== null && !errs.systolic_bp && !errs.diastolic_bp && systolic <= diastolic) {
      errs.diastolic_bp = t('validation.diastolicLower');
    }

    if (f.risk_level === '') {
      errs.risk_level = t('validation.riskRequired');
    }

    if (!f.consent_granted) {
      errs.consent_granted = t('validation.consentRequired');
    }

    return errs;
  }, [t]);

  const setField = useCallback(<K extends keyof IntakeFormState>(key: K, value: IntakeFormState[K]): void => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (prev[key] === undefined) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const handleRiskChange = useCallback(
    (value: RiskLevel | ''): void => {
      setField('risk_level', value);
      if (!actionTouched) {
        setField('recommended_action', value === '' ? '' : DEFAULT_ACTION[value]);
      }
    },
    [actionTouched, setField, DEFAULT_ACTION],
  );

  const resetForm = useCallback((): void => {
    setForm(createInitialState());
    setErrors({});
    setActionTouched(false);
    setStatus('idle');
    setMessage(null);
    setAiResult(null);
    setAiPendingOffline(false);
  }, []);

  const handleDataParsed = useCallback((data: ParsedIntakeData) => {
    if (data.name) setField('name', data.name);
    if (data.age_years) setField('age_years', String(data.age_years));
    if (data.gender) setField('gender', data.gender);
    if (data.symptoms) setField('symptoms', data.symptoms);
    if (data.temperature_f) setField('temperature_f', String(data.temperature_f));
    if (data.systolic_bp) setField('systolic_bp', String(data.systolic_bp));
    if (data.diastolic_bp) setField('diastolic_bp', String(data.diastolic_bp));
    if (data.risk_level) {
      setField('risk_level', data.risk_level);
      if (!actionTouched && DEFAULT_ACTION[data.risk_level]) {
        setField('recommended_action', DEFAULT_ACTION[data.risk_level]);
      }
    }
  }, [setField, actionTouched, DEFAULT_ACTION]);


  const age = useMemo<number | null>(() => {
    if (form.age_years !== '') {
      const parsedAge = Number(form.age_years);
      if (Number.isInteger(parsedAge) && parsedAge >= 0 && parsedAge <= 130) return parsedAge;
    }
    if (form.dob === '') return null;
    const dob = new Date(`${form.dob}T00:00:00`);
    if (Number.isNaN(dob.getTime())) return null;

    const today = new Date();
    let years = today.getFullYear() - dob.getFullYear();
    const monthDelta = today.getMonth() - dob.getMonth();
    if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dob.getDate())) {
      years -= 1;
    }
    return years >= 0 && years <= 130 ? years : null;
  }, [form.dob, form.age_years]);

  const symptomCount = useMemo<number>(() => parseSymptoms(form.symptoms).length, [form.symptoms]);

  const handleRunAiTriage = async () => {
    // Validate required inputs for AI
    const validationErrors = validate(form);
    const requiredForAi = ['symptoms', 'temperature_f', 'systolic_bp', 'diastolic_bp', 'gender'];
    const aiErrors = Object.keys(validationErrors).filter(k => requiredForAi.includes(k));
    if (aiErrors.length > 0) {
      setErrors(validationErrors);
      setMessage(t('validation.fixErrors'));
      return;
    }

    // Deterministic rules
    const temp = Number(form.temperature_f);
    const sys = Number(form.systolic_bp);
    const dia = Number(form.diastolic_bp);
    const symps = form.symptoms.toLowerCase();
    
    let isDeterministicRed = false;
    if (temp > 104 || sys > 180 || dia > 120 || sys < 90 || dia < 60 || symps.includes('bleed') || symps.includes('breath')) {
      isDeterministicRed = true;
      setField('risk_level', 'RED');
    }

    if (!navigator.onLine) {
      setAiPendingOffline(true);
      if (!isDeterministicRed) {
        // Fallback for offline if not red
        if (temp > 100.4 || sys > 140 || dia > 90) {
          setField('risk_level', 'YELLOW');
        } else {
          setField('risk_level', 'GREEN');
        }
      }
      return;
    }

    setIsAiRunning(true);
    setAiPendingOffline(false);
    setMessage(null);

    try {
      const result = await runWorkerTriage({
        symptoms: form.symptoms,
        temperature_f: temp,
        systolic_bp: sys,
        diastolic_bp: dia,
        age: age,
        gender: form.gender as string,
        duration: form.duration || undefined,
        pregnancyContext: form.pregnancy_context,
        o2Saturation: form.o2_saturation ? Number(form.o2_saturation) : undefined
      });

      // AI must NEVER downgrade a deterministic emergency/red flag
      if (isDeterministicRed) {
        result.risk_level = 'RED';
      }

      setAiResult(result as AiTriageResult);
      setField('risk_level', result.risk_level);
      if (!actionTouched) {
        setField('recommended_action', result.recommended_action);
      }
    } catch (err) {
      console.error(err);
      setMessage("AI Triage failed. Please proceed manually.");
    } finally {
      setIsAiRunning(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (isSaving) return;

    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      setStatus('error');
      setMessage(t('validation.fixErrors'));
      return;
    }

    setErrors({});
    setStatus('saving');
    setMessage(null);

    const abha = normalizeAbha(form.abha_id);
    const phone = normalizePhone(form.phone);

    const patientData: PatientPayload = {
      name: form.name.trim().replace(/\s+/g, ' '),
      gender: form.gender as Gender,
      dob: form.dob || null,
      age_years: form.age_years ? Number(form.age_years) : null,
      ...(abha !== '' ? { abha_id: abha } : {}),
      ...(phone !== '' ? { phone } : {}),
    };

    const riskLevel = form.risk_level as RiskLevel;

    const triageData: TriagePayload = {
      symptoms: parseSymptoms(form.symptoms),
      vitals: {
        temperature_f: Number(form.temperature_f),
        systolic_bp: Number(form.systolic_bp),
        diastolic_bp: Number(form.diastolic_bp),
      },
      risk_level: riskLevel,
      recommended_action: form.recommended_action.trim() || DEFAULT_ACTION[riskLevel],
    };

    try {
      await saveIntakeOffline(patientData, triageData, {
        triggerSync: true,
        consent: {
          purpose: 'CARE_DELIVERY',
          scope: 'DISTRICT_LEVEL',
          grantee: 'caresanchaar-network',
          notice_version: 'v1.0'
        }
      });

      setForm(createInitialState());
      setActionTouched(false);
      setStatus('saved');
      setMessage(
        t('success', { name: patientData.name }),
      );

      try {
        await syncPendingData('post-intake');
      } catch {
        /* queued for the next sync window */
      }
    } catch (error) {
      setStatus('error');
      setMessage(
        error instanceof Error
          ? error.message
          : t('offlineError'),
      );
    }
  };

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <AIAssistantFAB onDataParsed={handleDataParsed} />
      <div className="mx-auto w-full max-w-4xl">
        <header className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{t('fieldOps')}</p>
          <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{t('pageTitle')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('pageSubtitle')}
          </p>
        </header>

        {message !== null ? (
          <div
            role={status === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            className={
              status === 'error'
                ? 'mb-6 rounded-lg border border-red-900 bg-red-950/40 px-4 py-3 text-sm text-red-300'
                : 'mb-6 rounded-lg border border-emerald-800 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300'
            }
          >
            {message}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* ------------------------- Card 1: Patient ------------------------- */}
          <section className={CARD_CLASS} aria-labelledby="patient-details-heading">
            <div className="mb-5 border-b border-border pb-4">
              <h2 id="patient-details-heading" className="text-base font-semibold text-white">
                {t('patientDetails')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('patientDetailsHint')}</p>
            </div>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field className="sm:col-span-2" error={errors.name} id="name" label={t('fullName')} required optionalLabel={t('optional')}>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  placeholder={t('namePlaceholder')}
                  className={INPUT_CLASS}
                  value={form.name}
                  disabled={isSaving}
                  aria-invalid={errors.name !== undefined}
                  aria-describedby={errors.name !== undefined ? 'name-error' : undefined}
                  onChange={(event) => setField('name', event.target.value)}
                />
              </Field>

              <Field error={errors.abha_id} hint={t('abhaIdHint')} id="abha_id" label={t('abhaId')} optionalLabel={t('optional')}>
                <input
                  id="abha_id"
                  name="abha_id"
                  type="text"
                  inputMode="numeric"
                  placeholder={t("placeholderAbha")}
                  className={INPUT_CLASS}
                  value={form.abha_id}
                  disabled={isSaving}
                  aria-invalid={errors.abha_id !== undefined}
                  aria-describedby={errors.abha_id !== undefined ? 'abha_id-error' : 'abha_id-hint'}
                  onChange={(event) => setField('abha_id', event.target.value)}
                />
              </Field>

              <Field error={errors.gender} id="gender" label={t('gender')} required optionalLabel={t('optional')}>
                <Select
                  value={form.gender || undefined}
                  onValueChange={(value) => setField('gender', value as Gender)}
                  disabled={isSaving}
                >
                  <SelectTrigger
                    id="gender"
                    className={INPUT_CLASS}
                    aria-invalid={errors.gender !== undefined}
                    aria-describedby={errors.gender !== undefined ? 'gender-error' : undefined}
                  >
                    <SelectValue placeholder={t('selectGender')} />
                  </SelectTrigger>
                  <SelectContent>
                    {GENDER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field error={errors.dob} hint={age !== null && form.age_years === '' ? t('approximateAge', { age }) : undefined} id="dob" label={t('dob')} optionalLabel={t('optional')}>
                <input
                  id="dob"
                  name="dob"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  className={`${INPUT_CLASS} [color-scheme:dark]`}
                  value={form.dob}
                  disabled={isSaving}
                  aria-invalid={errors.dob !== undefined}
                  aria-describedby={errors.dob !== undefined ? 'dob-error' : age !== null && form.age_years === '' ? 'dob-hint' : undefined}
                  onChange={(event) => { setField('dob', event.target.value); if (event.target.value) setField('age_years', ''); }}
                />
              </Field>

              <Field error={errors.age_years} id="age_years" label="Age (Years)" optionalLabel={t('optional')}>
                <input
                  id="age_years"
                  name="age_years"
                  type="number"
                  min="0"
                  max="130"
                  placeholder="e.g. 45"
                  className={INPUT_CLASS}
                  value={form.age_years}
                  disabled={isSaving || form.dob !== ''}
                  aria-invalid={errors.age_years !== undefined}
                  onChange={(event) => setField('age_years', event.target.value)}
                />
              </Field>

              <Field error={errors.phone} id="phone" label={t('phone')} optionalLabel={t('optional')}>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder={t("placeholderPhone")}
                  className={INPUT_CLASS}
                  value={form.phone}
                  disabled={isSaving}
                  aria-invalid={errors.phone !== undefined}
                  aria-describedby={errors.phone !== undefined ? 'phone-error' : undefined}
                  onChange={(event) => setField('phone', event.target.value)}
                />
              </Field>
            </div>
          </section>

          {/* --------------------- Card 2: Vitals & Triage --------------------- */}
          <section className={CARD_CLASS} aria-labelledby="triage-heading">
            <div className="mb-5 border-b border-border pb-4">
              <h2 id="triage-heading" className="text-base font-semibold text-white">
                {t('triage')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t('triageHint')}
              </p>
            </div>

            <div className="space-y-5">
              <Field hint={symptomCount > 0 ? t('symptomsRecorded', { count: symptomCount }) : t('symptomsHint')} error={errors.symptoms} id="symptoms" label={t('symptoms')} required optionalLabel={t('optional')}>
                <textarea
                  id="symptoms"
                  name="symptoms"
                  rows={3}
                  placeholder={t('symptomsPlaceholder')}
                  className={`${INPUT_CLASS} resize-y`}
                  value={form.symptoms}
                  disabled={isSaving}
                  aria-invalid={errors.symptoms !== undefined}
                  aria-describedby={errors.symptoms !== undefined ? 'symptoms-error' : 'symptoms-hint'}
                  onChange={(event) => setField('symptoms', event.target.value)}
                />
              </Field>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <Field error={errors.temperature_f} id="temperature_f" label="Temperature (°F) *" required optionalLabel={t('optional')}>
                  <input
                    id="temperature_f"
                    name="temperature_f"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="90"
                    max="110"
                    placeholder={t("placeholderTemp")}
                    className={INPUT_CLASS}
                    value={form.temperature_f}
                    disabled={isSaving}
                    aria-invalid={errors.temperature_f !== undefined}
                    aria-describedby={errors.temperature_f !== undefined ? 'temperature_f-error' : undefined}
                    onChange={(event) => setField('temperature_f', event.target.value)}
                  />
                </Field>

                <Field error={errors.systolic_bp} id="systolic_bp" label={t('systolicBp')} required optionalLabel={t('optional')}>
                  <input
                    id="systolic_bp"
                    name="systolic_bp"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="60"
                    max="260"
                    placeholder={t("placeholderSys")}
                    className={INPUT_CLASS}
                    value={form.systolic_bp}
                    disabled={isSaving}
                    aria-invalid={errors.systolic_bp !== undefined}
                    aria-describedby={errors.systolic_bp !== undefined ? 'systolic_bp-error' : undefined}
                    onChange={(event) => setField('systolic_bp', event.target.value)}
                  />
                </Field>

                <Field error={errors.diastolic_bp} id="diastolic_bp" label={t('diastolicBp')} required optionalLabel={t('optional')}>
                  <input
                    id="diastolic_bp"
                    name="diastolic_bp"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="30"
                    max="200"
                    placeholder={t("placeholderDia")}
                    className={INPUT_CLASS}
                    value={form.diastolic_bp}
                    disabled={isSaving}
                    aria-invalid={errors.diastolic_bp !== undefined}
                    aria-describedby={errors.diastolic_bp !== undefined ? 'diastolic_bp-error' : undefined}
                    onChange={(event) => setField('diastolic_bp', event.target.value)}
                  />
                </Field>
                <Field id="o2_saturation" label="O2 Saturation (%)" optionalLabel={t('optional')}>
                  <input
                    id="o2_saturation"
                    name="o2_saturation"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="50"
                    max="100"
                    placeholder={t("placeholderSpo2")}
                    className={INPUT_CLASS}
                    value={form.o2_saturation}
                    disabled={isSaving}
                    onChange={(event) => setField('o2_saturation', event.target.value)}
                  />
                </Field>
                <Field id="duration" label="Duration of Symptoms" optionalLabel={t('optional')}>
                  <input
                    id="duration"
                    name="duration"
                    type="text"
                    placeholder={t("placeholderDuration")}
                    className={INPUT_CLASS}
                    value={form.duration}
                    disabled={isSaving}
                    onChange={(event) => setField('duration', event.target.value)}
                  />
                </Field>
                {form.gender === 'FEMALE' && (
                  <Field id="pregnancy_context" label="Pregnancy Context" optionalLabel={t('optional')}>
                    <label className="flex items-center gap-2 mt-2">
                      <input
                        type="checkbox"
                        checked={form.pregnancy_context}
                        onChange={(e) => setField('pregnancy_context', e.target.checked)}
                        className="w-4 h-4 bg-card border-border rounded text-emerald-600 focus:ring-emerald-600"
                        disabled={isSaving}
                      />
                      <span className="text-sm text-white">{t("patientIsPregnant")}</span>
                    </label>
                  </Field>
                )}
              </div>

              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={handleRunAiTriage}
                  disabled={isAiRunning || isSaving}
                  className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                >
                  {isAiRunning ? <Spinner /> : null}
                  {isAiRunning ? t('runningAi') : t('runAiTriage')}
                </button>
              </div>

              {aiPendingOffline && (
                <div className="mt-4 p-4 rounded-lg bg-amber-950 border border-amber-800 text-amber-200 text-sm">
                  {t('aiAnalysisPending')}
                </div>
              )}

              {aiResult && (
                <div className="mt-6 p-5 rounded-xl border border-indigo-500/30 bg-indigo-950/20 space-y-4">
                  <div className="flex items-center gap-3 border-b border-indigo-500/20 pb-3">
                    <span className="text-indigo-400 font-semibold">{t('aiAssistedTriage')}</span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs text-muted-foreground uppercase">{t('riskScore')}</h4>
                      <p className="text-sm text-white mt-1">{aiResult.risk_score}</p>
                    </div>
                    <div>
                      <h4 className="text-xs text-muted-foreground uppercase">{t('urgency')}</h4>
                      <p className="text-sm text-white mt-1">{aiResult.referral_urgency}</p>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs text-muted-foreground uppercase">{t('possibleHealthConcerns')}</h4>
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {aiResult.health_concerns.map((c, i) => (
                        <li key={i} className="text-xs bg-indigo-900/50 text-indigo-200 px-2 py-1 rounded border border-indigo-800/50">{c}</li>
                      ))}
                    </ul>
                  </div>

                  {aiResult.missing_info.length > 0 && (
                    <div>
                      <h4 className="text-xs text-muted-foreground uppercase">{t('missingInformation')}</h4>
                      <ul className="mt-1 list-disc list-inside text-sm text-amber-300/80">
                        {aiResult.missing_info.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    </div>
                  )}

                  <div className="bg-background/50 p-3 rounded-lg text-xs text-muted-foreground border border-border">
                    <strong>{t('safetyNote')}:</strong> {t('aiDisclaimer')}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 mt-6 border-t border-border pt-6">
                <Field error={errors.risk_level} id="risk_level" label={t('riskLevel')} required optionalLabel={t('optional')}>
                  <div className="relative">
                    <Select
                      value={form.risk_level || ""}
                      onValueChange={(value) => handleRiskChange(value as RiskLevel)}
                      disabled={true}
                    >
                      <SelectTrigger
                        id="risk_level"
                        className={INPUT_CLASS}
                        aria-invalid={errors.risk_level !== undefined}
                        aria-describedby={errors.risk_level !== undefined ? 'risk_level-error' : undefined}
                      >
                        <SelectValue placeholder={t('selectRiskLevel')} />
                      </SelectTrigger>
                      <SelectContent>
                        {RISK_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {form.risk_level !== '' ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 rounded-full ${
                          RISK_OPTIONS.find((option) => option.value === form.risk_level)?.dot ?? 'bg-secondary'
                        }`}
                      />
                      {t('triageFlagSet', { level: form.risk_level })}
                    </div>
                  ) : null}
                </Field>

                <Field error={errors.recommended_action} hint={t('actionHint')} id="recommended_action" label={t('recommendedAction')} optionalLabel={t('optional')}>
                  <textarea
                    id="recommended_action"
                    name="recommended_action"
                    rows={3}
                    disabled={true}
                    placeholder={t('actionPlaceholder')}
                    className={`${INPUT_CLASS} resize-y`}
                    value={form.recommended_action}
                    aria-describedby="recommended_action-hint"
                    onChange={(event) => {
                      setActionTouched(true);
                      setField('recommended_action', event.target.value);
                    }}
                  />
                </Field>
              </div>
            </div>
          </section>

          {/* ------------------------- Card 3: Consent ------------------------- */}
          <section className={CARD_CLASS} aria-labelledby="consent-heading">
            <div className="mb-5 border-b border-border pb-4">
              <h2 id="consent-heading" className="text-base font-semibold text-white">
                {t('consent')}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{t('consentHint')}</p>
            </div>

            <div className="rounded-lg bg-background p-4 border border-border mb-4">
              <p className="text-sm text-muted-foreground italic mb-3">
                &quot;{t('consentStatement')}&quot;
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  name="consent"
                  className="w-4 h-4 bg-card border-border rounded text-emerald-600 focus:ring-emerald-600 focus:ring-offset-background"
                  checked={form.consent_granted}
                  onChange={(e) => setField('consent_granted', e.target.checked)}
                  disabled={isSaving}
                />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">{t('consentCheckboxLabel')}</span>
                {errors.consent_granted && <span className="text-xs text-red-400 mt-1">{errors.consent_granted}</span>}
              </div>
            </label>
          </section>

          {/* ------------------------------ Actions ---------------------------- */}
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <p className="text-sm text-muted-foreground">
              {t('offlineNote')}
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={resetForm}
                disabled={isSaving}
                className="rounded-md border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t('clear')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? <Spinner/> : null}
                {isSaving ? t('savingIntake') : t('saveIntake')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </main>
  );
}
