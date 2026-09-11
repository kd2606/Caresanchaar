"use server";

import { generateWithModelFallback } from "@/ai/generate-with-fallback";
import { z } from "genkit";

const WorkerTriageInputSchema = z.object({
  symptoms: z.string(),
  temperature_f: z.number(),
  systolic_bp: z.number(),
  diastolic_bp: z.number(),
  age: z.number().nullable(),
  gender: z.string(),
  duration: z.string().optional(),
  pregnancyContext: z.boolean().optional(),
  o2Saturation: z.number().optional(),
});

const WorkerTriageOutputSchema = z.object({
  risk_level: z.enum(["GREEN", "YELLOW", "RED"]),
  risk_score: z.string(),
  explanation: z.string(),
  health_concerns: z.array(z.string()),
  recommended_action: z.string(),
  missing_info: z.array(z.string()),
  referral_urgency: z.string()
});

export async function runWorkerTriage(input: z.infer<typeof WorkerTriageInputSchema>) {
  const patientProfile = [
    input.age !== null ? `Age: ${input.age}` : null,
    input.gender ? `Gender: ${input.gender}` : null,
    input.pregnancyContext ? `Pregnant: Yes` : null
  ].filter(Boolean).join(", ");

  const clinicalMetadata = `
Temperature: ${input.temperature_f}°F
Systolic BP: ${input.systolic_bp}
Diastolic BP: ${input.diastolic_bp}
${input.o2Saturation ? `O2 Saturation: ${input.o2Saturation}%` : ""}
${input.duration ? `Duration: ${input.duration}` : ""}
`;

  const { output } = await generateWithModelFallback({
    prompt: `You are an AI-assisted triage system for rural health workers in India.
Your task is to analyze the patient's symptoms, vitals, and metadata to output a safe, deterministic risk assessment and recommended action.

Patient Profile: ${patientProfile}
Vitals: ${clinicalMetadata}
Reported Symptoms: ${input.symptoms}

CRITICAL RULES:
1. deterministic red-flag rules must be respected. If temperature > 104F, or systolic > 180, or diastolic > 120, or systolic < 90, or diastolic < 60, or severe symptoms (e.g. bleeding, breathing difficulty) are present, the risk level MUST be RED.
2. Output must not be a definitive diagnosis, but rather "Possible health concern categories".
3. Provide a clear explanation for the risk level.
4. Recommend the immediate next action.
5. Identify any missing information that would be helpful.

Provide a JSON response with:
1. "risk_level": "GREEN", "YELLOW", or "RED".
2. "risk_score": A score/band like "High Risk", "Moderate Risk", "Low Risk".
3. "explanation": A clear explanation of the risk assessment.
4. "health_concerns": An array of possible health concern categories (NOT definitive diagnoses).
5. "recommended_action": Actionable next steps for the health worker.
6. "missing_info": Questions or checks the worker missed.
7. "referral_urgency": "Immediate", "Within 24 hours", "Routine", or "None".`,
    output: { schema: WorkerTriageOutputSchema },
  });

  return output;
}
