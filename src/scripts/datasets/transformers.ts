/**
 * Dataset -> knowledge-document transformers.
 *
 * DESIGN RATIONALE (read before changing this file)
 * -------------------------------------------------
 * Only Columbia DBMI is narrative clinical knowledge. The UCI files are
 * tabular ML training sets: rows of individual anonymised patients. Embedding
 * raw rows produces useless retrieval ("patient 137, chol 244, target 1") and
 * encourages the model to generalise from one stranger's chart to the patient
 * in front of the health worker.
 *
 * We therefore compute DETERMINISTIC AGGREGATE documents at ingest time —
 * per-feature-band outcome prevalence with cohort sizes — and wrap every one in
 * explicit interpretation guards. No statistics are computed by the LLM.
 *
 * Chunking note: each emitted document is one self-contained semantic unit
 * (~200-900 chars). Fixed-window character chunking would slice a symptom list
 * or a prevalence table in half and is deliberately not used.
 */

import type { DatasetSource, RecordType } from '@/lib/env';

export interface KnowledgeDoc {
  datasetSource: DatasetSource;
  recordType: RecordType;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
}

export type CsvRow = Record<string, string>;

/** Strata smaller than this are statistically meaningless — suppressed. */
const MIN_STRATUM_SIZE = 10;

const MISSING_TOKENS = new Set(['', '?', 'na', 'n/a', 'nan', 'null', '-']);

const clean = (value: string | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim();

const isMissing = (value: string | undefined): boolean =>
  MISSING_TOKENS.has(clean(value).toLowerCase());

/** Tolerate the column-name drift between UCI CSV redistributions. */
function pickColumn(row: CsvRow, candidates: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const candidate of candidates) {
    const match = keys.find((k) => k.trim().toLowerCase() === candidate.toLowerCase());
    if (match) return row[match];
  }
  return undefined;
}

// ===========================================================================
// 1. Columbia DBMI Disease-Symptom Knowledge Database
// ===========================================================================

/**
 * The published CSV is sparse: the Disease and occurrence-count cells appear
 * once per disease block and are BLANK on the symptom rows that follow. We
 * forward-fill, then emit one document per disease.
 *
 * Values are UMLS-coded like `UMLS:C0011847_diabetes` — we strip the code into
 * metadata and keep the human-readable term in the embedded text.
 */
export function transformColumbiaDiseaseSymptom(rows: CsvRow[]): KnowledgeDoc[] {
  interface Block {
    disease: string;
    umlsCode?: string;
    occurrenceCount?: number;
    symptoms: Array<{ term: string; umlsCode?: string }>;
  }

  const splitUmls = (value: string): { term: string; umlsCode?: string } => {
    const match = value.match(/^UMLS:(C\d+)_(.+)$/i);
    if (match) return { umlsCode: match[1], term: match[2].replace(/_/g, ' ').trim() };
    return { term: value.replace(/_/g, ' ').trim() };
  };

  const blocks: Block[] = [];
  let current: Block | null = null;

  for (const row of rows) {
    const diseaseCell = clean(pickColumn(row, ['Disease', 'disease']));
    const countCell = clean(
      pickColumn(row, ['Count of Disease Occurrence', 'count of disease occurrence', 'count']),
    );
    const symptomCell = clean(pickColumn(row, ['Symptom', 'symptom']));

    if (diseaseCell) {
      const { term, umlsCode } = splitUmls(diseaseCell);
      current = {
        disease: term,
        umlsCode,
        occurrenceCount: countCell ? Number(countCell) || undefined : undefined,
        symptoms: [],
      };
      blocks.push(current);
    }
    if (symptomCell && current) current.symptoms.push(splitUmls(symptomCell));
  }

  return blocks
    .filter((block) => block.symptoms.length > 0)
    .map((block) => {
      const symptomList = block.symptoms.map((s) => s.term).join(', ');
      const content = [
        `Disease: ${block.disease}.`,
        `Symptoms documented in association with this disease: ${symptomList}.`,
        block.occurrenceCount
          ? `Recorded discharge-summary occurrences in the source corpus: ${block.occurrenceCount}.`
          : '',
        'Provenance: Columbia University DBMI Disease-Symptom Knowledge Database,',
        'derived from hospital discharge summaries. Interpretation guard: this is',
        'a documented symptom-disease co-occurrence list, not a diagnostic',
        'criterion set. Presence of listed symptoms does not establish this',
        'disease, and absence does not exclude it.',
      ]
        .filter(Boolean)
        .join(' ');

      return {
        datasetSource: 'columbia_dbmi_disease_symptom' as const,
        recordType: 'disease_symptom_profile' as const,
        title: `Symptom profile: ${block.disease}`,
        content,
        metadata: {
          disease: block.disease,
          diseaseUmls: block.umlsCode,
          symptomCount: block.symptoms.length,
          symptoms: block.symptoms.map((s) => s.term),
        },
      };
    });
}

// ===========================================================================
// 2. Generic labelled-tabular aggregator (Heart, CKD, labelled Diabetes)
// ===========================================================================

export interface NumericFeature {
  column: string;
  aliases?: string[];
  label: string;
  unit?: string;
  /** Ascending bin edges; open-ended at both extremes. */
  bins: number[];
}

export interface CategoricalFeature {
  column: string;
  aliases?: string[];
  label: string;
  valueMap?: Record<string, string>;
}

export interface TabularDatasetConfig {
  datasetSource: DatasetSource;
  /** File name expected inside /data. */
  file: string;
  cohortName: string;
  provenance: string;
  outcomeLabel: string;
  label: {
    column: string;
    aliases?: string[];
    isPositive: (raw: string) => boolean;
  };
  numeric: NumericFeature[];
  categorical: CategoricalFeature[];
}

interface Stratum {
  name: string;
  total: number;
  positive: number;
}

const pct = (positive: number, total: number): string =>
  total === 0 ? 'n/a' : `${((positive / total) * 100).toFixed(1)}%`;

function binName(bins: number[], index: number, unit?: string): string {
  const suffix = unit ? ` ${unit}` : '';
  if (index === 0) return `< ${bins[0]}${suffix}`;
  if (index === bins.length) return `>= ${bins[bins.length - 1]}${suffix}`;
  return `${bins[index - 1]} to < ${bins[index]}${suffix}`;
}

function binIndex(bins: number[], value: number): number {
  let index = 0;
  while (index < bins.length && value >= bins[index]) index++;
  return index;
}

/** Render one feature's strata into a grounded, guard-wrapped document. */
function renderFeatureDoc(
  config: TabularDatasetConfig,
  featureLabel: string,
  strata: Stratum[],
  cohortTotal: number,
  cohortPositive: number,
  extra: Record<string, unknown>,
): KnowledgeDoc | null {
  const reportable = strata.filter((s) => s.total >= MIN_STRATUM_SIZE);
  if (reportable.length < 2) return null; // nothing comparable to say

  const lines = reportable.map(
    (s) =>
      `  - ${s.name}: ${s.positive} of ${s.total} patients (${pct(s.positive, s.total)}) had ${config.outcomeLabel}`,
  );
  const suppressed = strata.length - reportable.length;

  const content = [
    `Cohort feature association — ${featureLabel} versus ${config.outcomeLabel}.`,
    `Cohort: ${config.cohortName}, n=${cohortTotal}, overall ${config.outcomeLabel} prevalence ${pct(cohortPositive, cohortTotal)}.`,
    `Observed distribution:`,
    lines.join('\n'),
    suppressed > 0
      ? `${suppressed} stratum/strata suppressed for having fewer than ${MIN_STRATUM_SIZE} patients.`
      : '',
    `Provenance: ${config.provenance}`,
    `Interpretation guard: these are retrospective, unadjusted associations from a single historical research cohort. They are NOT diagnostic thresholds, NOT causal, NOT adjusted for confounding, and NOT transferable to an individual patient's probability of disease. Use only to note which measured parameters warrant Medical Officer attention.`,
  ]
    .filter(Boolean)
    .join('\n');

  return {
    datasetSource: config.datasetSource,
    recordType: 'feature_risk_association',
    title: `${config.cohortName}: ${featureLabel} vs ${config.outcomeLabel}`,
    content,
    metadata: {
      cohort: config.cohortName,
      feature: featureLabel,
      cohortSize: cohortTotal,
      cohortPrevalence: cohortTotal ? cohortPositive / cohortTotal : null,
      strata: reportable,
      ...extra,
    },
  };
}

export function transformLabeledTable(
  config: TabularDatasetConfig,
  rows: CsvRow[],
): KnowledgeDoc[] {
  const labelled = rows.filter(
    (row) => !isMissing(pickColumn(row, [config.label.column, ...(config.label.aliases ?? [])])),
  );
  if (labelled.length === 0) {
    throw new Error(
      `[${config.datasetSource}] label column "${config.label.column}" not found or entirely empty. ` +
        `Check the CSV header row.`,
    );
  }

  const isPositive = (row: CsvRow): boolean =>
    config.label.isPositive(
      clean(pickColumn(row, [config.label.column, ...(config.label.aliases ?? [])])).toLowerCase(),
    );

  const cohortTotal = labelled.length;
  const cohortPositive = labelled.filter(isPositive).length;
  const docs: KnowledgeDoc[] = [];

  // --- Cohort overview -----------------------------------------------------
  docs.push({
    datasetSource: config.datasetSource,
    recordType: 'cohort_overview',
    title: `Cohort overview: ${config.cohortName}`,
    content: [
      `Cohort overview — ${config.cohortName}.`,
      `Total patients with a recorded outcome: ${cohortTotal}.`,
      `Patients with ${config.outcomeLabel}: ${cohortPositive} (${pct(cohortPositive, cohortTotal)}).`,
      `Measured parameters available in this cohort: ${[
        ...config.numeric.map((f) => f.label),
        ...config.categorical.map((f) => f.label),
      ].join(', ')}.`,
      `Provenance: ${config.provenance}`,
      `Interpretation guard: a small historical research cohort. Its prevalence is not a population base rate for any field deployment and must not be used as a prior for an individual patient.`,
    ].join('\n'),
    metadata: { cohortSize: cohortTotal, positives: cohortPositive },
  });

  // --- Numeric features ----------------------------------------------------
  for (const feature of config.numeric) {
    const strata: Stratum[] = Array.from({ length: feature.bins.length + 1 }, (_, i) => ({
      name: binName(feature.bins, i, feature.unit),
      total: 0,
      positive: 0,
    }));

    let parsedCount = 0;
    for (const row of labelled) {
      const raw = pickColumn(row, [feature.column, ...(feature.aliases ?? [])]);
      if (isMissing(raw)) continue;
      const value = Number(clean(raw));
      if (!Number.isFinite(value)) continue;
      parsedCount++;
      const stratum = strata[binIndex(feature.bins, value)];
      stratum.total++;
      if (isPositive(row)) stratum.positive++;
    }
    if (parsedCount < MIN_STRATUM_SIZE * 2) continue;

    const doc = renderFeatureDoc(config, feature.label, strata, cohortTotal, cohortPositive, {
      featureKind: 'numeric',
      unit: feature.unit ?? null,
      bins: feature.bins,
    });
    if (doc) docs.push(doc);
  }

  // --- Categorical features ------------------------------------------------
  for (const feature of config.categorical) {
    const buckets = new Map<string, Stratum>();
    for (const row of labelled) {
      const raw = pickColumn(row, [feature.column, ...(feature.aliases ?? [])]);
      if (isMissing(raw)) continue;
      const key = clean(raw);
      const name = feature.valueMap?.[key] ?? feature.valueMap?.[key.toLowerCase()] ?? key;
      const stratum = buckets.get(name) ?? { name, total: 0, positive: 0 };
      stratum.total++;
      if (isPositive(row)) stratum.positive++;
      buckets.set(name, stratum);
    }

    const doc = renderFeatureDoc(
      config,
      feature.label,
      [...buckets.values()].sort((a, b) => b.total - a.total),
      cohortTotal,
      cohortPositive,
      { featureKind: 'categorical' },
    );
    if (doc) docs.push(doc);
  }

  return docs;
}

// ===========================================================================
// 3. Dataset configurations
// ===========================================================================

/** UCI Heart Disease (ID 45) — Cleveland processed subset, 303 patients. */
export const HEART_DISEASE_CONFIG: TabularDatasetConfig = {
  datasetSource: 'uci_heart_disease_45',
  file: 'heart-disease.csv',
  cohortName: 'UCI Cleveland Heart Disease cohort',
  provenance:
    'UCI Machine Learning Repository, Heart Disease Data Set (ID 45), Cleveland Clinic Foundation, collected 1988.',
  outcomeLabel: 'angiographically confirmed coronary artery disease',
  // Original encoding: 0 = no disease, 1-4 = increasing severity.
  label: { column: 'num', aliases: ['target', 'class', 'diagnosis'], isPositive: (v) => Number(v) > 0 },
  numeric: [
    { column: 'age', label: 'Age', unit: 'years', bins: [40, 50, 60, 70] },
    { column: 'trestbps', label: 'Resting systolic blood pressure', unit: 'mmHg', bins: [120, 140, 160] },
    { column: 'chol', label: 'Serum cholesterol', unit: 'mg/dL', bins: [200, 240, 300] },
    { column: 'thalach', label: 'Maximum heart rate achieved on exercise testing', unit: 'bpm', bins: [120, 140, 160] },
    { column: 'oldpeak', label: 'Exercise-induced ST depression', unit: 'mm', bins: [0.5, 1.5, 2.5] },
  ],
  categorical: [
    { column: 'sex', label: 'Sex', valueMap: { '0': 'female', '1': 'male' } },
    {
      column: 'cp',
      label: 'Chest pain type',
      valueMap: {
        '1': 'typical angina',
        '2': 'atypical angina',
        '3': 'non-anginal pain',
        '4': 'asymptomatic',
        '0': 'typical angina (0-indexed variant)',
      },
    },
    { column: 'fbs', label: 'Fasting blood sugar above 120 mg/dL', valueMap: { '0': 'no', '1': 'yes' } },
    { column: 'exang', label: 'Exercise-induced angina', valueMap: { '0': 'absent', '1': 'present' } },
    {
      column: 'restecg',
      label: 'Resting electrocardiogram',
      valueMap: { '0': 'normal', '1': 'ST-T wave abnormality', '2': 'left ventricular hypertrophy' },
    },
    { column: 'ca', label: 'Number of major vessels with contrast-visible narrowing' },
  ],
};

/** UCI Chronic Kidney Disease (ID 336) — 400 patients, Apollo Hospitals. */
export const CKD_CONFIG: TabularDatasetConfig = {
  datasetSource: 'uci_chronic_kidney_disease_336',
  file: 'chronic-kidney-disease.csv',
  cohortName: 'UCI Chronic Kidney Disease cohort',
  provenance:
    'UCI Machine Learning Repository, Chronic Kidney Disease Data Set (ID 336), collected over two months at a hospital in Tamil Nadu, India.',
  outcomeLabel: 'a chronic kidney disease classification',
  label: {
    column: 'classification',
    aliases: ['class'],
    // Source file contains trailing-tab variants such as "ckd\t".
    isPositive: (v) => v.startsWith('ckd') && !v.startsWith('notckd'),
  },
  numeric: [
    { column: 'age', label: 'Age', unit: 'years', bins: [30, 45, 60, 75] },
    { column: 'bp', label: 'Diastolic blood pressure', unit: 'mmHg', bins: [70, 80, 90] },
    { column: 'bgr', label: 'Random blood glucose', unit: 'mg/dL', bins: [100, 140, 200] },
    { column: 'bu', label: 'Blood urea', unit: 'mg/dL', bins: [20, 40, 80] },
    { column: 'sc', label: 'Serum creatinine', unit: 'mg/dL', bins: [1.2, 2.0, 4.0] },
    { column: 'hemo', label: 'Haemoglobin', unit: 'g/dL', bins: [10, 12, 14] },
    { column: 'sod', label: 'Serum sodium', unit: 'mEq/L', bins: [135, 145] },
    { column: 'pot', label: 'Serum potassium', unit: 'mEq/L', bins: [3.5, 5.0] },
    { column: 'pcv', label: 'Packed cell volume', unit: '%', bins: [30, 38, 45] },
  ],
  categorical: [
    { column: 'al', label: 'Urine albumin grade' },
    { column: 'su', label: 'Urine sugar grade' },
    { column: 'rbc', label: 'Red blood cells on urine microscopy' },
    { column: 'pc', label: 'Pus cells on urine microscopy' },
    { column: 'htn', label: 'History of hypertension' },
    { column: 'dm', label: 'History of diabetes mellitus' },
    { column: 'cad', label: 'History of coronary artery disease' },
    { column: 'appet', label: 'Appetite' },
    { column: 'pe', label: 'Pedal oedema' },
    { column: 'ane', label: 'Anaemia' },
  ],
};

/**
 * Diabetes.
 *
 * IMPORTANT: UCI dataset ID 34 ("Diabetes", AIM '94) is 70 files of
 * time-stamped insulin-dose and glucose-measurement event codes for individual
 * patients. It has NO diagnostic outcome label, so no association document can
 * be derived from it and it does not belong in a retrieval corpus for triage.
 *
 * Point this config at a labelled diabetes CSV instead — the Pima Indians
 * Diabetes dataset (column names below) or UCI ID 529 "Early Stage Diabetes
 * Risk Prediction". Adjust `label`, `numeric` and `categorical` to match
 * whichever file you place in /data.
 */
export const DIABETES_CONFIG: TabularDatasetConfig = {
  datasetSource: 'uci_diabetes_labeled',
  file: 'diabetes.csv',
  cohortName: 'Pima Indians Diabetes cohort',
  provenance:
    'National Institute of Diabetes and Digestive and Kidney Diseases, Pima Indians Diabetes Database. Cohort restricted to adult female patients of Pima heritage — generalisability to other populations is limited.',
  outcomeLabel: 'a diabetes diagnosis',
  label: { column: 'Outcome', aliases: ['class', 'target', 'Value', 'Code'], isPositive: (v) => v === '1' || v === 'yes' || v === 'positive' },
  numeric: [
    { column: 'Age', label: 'Age', unit: 'years', bins: [30, 40, 50, 60] },
    { column: 'Glucose', label: 'Plasma glucose (2-hour OGTT)', unit: 'mg/dL', bins: [100, 126, 160] },
    { column: 'BloodPressure', label: 'Diastolic blood pressure', unit: 'mmHg', bins: [70, 80, 90] },
    { column: 'BMI', label: 'Body mass index', unit: 'kg/m2', bins: [23, 27.5, 32.5] },
    { column: 'Insulin', label: 'Two-hour serum insulin', unit: 'mu U/mL', bins: [50, 130, 200] },
    { column: 'Pregnancies', label: 'Number of pregnancies', bins: [1, 3, 6] },
  ],
  categorical: [],
};

export const TABULAR_CONFIGS = [HEART_DISEASE_CONFIG, CKD_CONFIG, DIABETES_CONFIG];
