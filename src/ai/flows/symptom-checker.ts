"use server";

import { generateWithModelFallback } from "@/ai/generate-with-fallback";
import { z } from "genkit";

const SymptomCheckerInputSchema = z.object({
    symptoms: z.string(),
    duration: z.string(),
    painScale: z.number(),
    fever: z.string(),
    age: z.number().optional(),
    gender: z.string().optional(),
});

const SymptomCheckerOutputSchema = z.object({
    symptomCluster: z.string(),
    clusterDescription: z.string(),
    simpleExplanation: z.string(),
    triagePriority: z.enum([
        "Routine Care Needed",
        "Elevated Triage Priority",
        "High Triage Priority"
    ]),
    precautions: z.array(z.string()),
    otcMedicines: z.array(
        z.object({
            name: z.string(),
            purpose: z.string(),
            searchQuery: z.string(),
        })
    )
});

export async function checkSymptoms(input: z.infer<typeof SymptomCheckerInputSchema>) {
    const patientProfile = [
        input.age ? `Age: ${input.age}` : null,
        input.gender ? `Gender: ${input.gender}` : null,
    ]
        .filter(Boolean)
        .join(", ");

    const clinicalMetadata = `
Duration: ${input.duration}
Pain Scale (1-10): ${input.painScale}
Fever Presence: ${input.fever}
`;

    const { output } = await generateWithModelFallback({
        prompt: `You are an analytical health synthesizer acting as a triage assessment tool for communities in rural India. You must analyze the reported symptoms and structured clinical metadata to output a dataset-backed triage priority.

${patientProfile ? `Patient Profile: ${patientProfile}` : ""}
Clinical Metadata: ${clinicalMetadata}
Reported Symptoms: ${input.symptoms}

CRITICAL RULES:
1. DO NOT use the words "diagnose", "diagnosis", "disease", or "patient". Use "assessment", "symptom cluster", and "user".
2. Synthesize the text symptoms with the clinical metadata (duration, pain scale, fever) to accurately place the user into one of three triage tiers.

Provide a JSON response with:
1. "symptomCluster": A general grouping of the reported symptoms (e.g., "Upper Respiratory Symptoms", "Gastric Discomfort", "Musculoskeletal Tension"). Do not give a single diagnostic medical condition.
2. "clusterDescription": A clear, simple 2-3 sentence description of this cluster in plain language.
3. "triagePriority": Classify as exactly "Routine Care Needed", "Elevated Triage Priority", or "High Triage Priority" based on the severity of the metadata and symptoms. A pain scale of 8+, chronic duration, or specific concerning text should elevate priority.
4. "simpleExplanation": 1-2 lines explaining the result in simple language a non-medical person can understand.
5. "precautions": an array of 4-6 specific, actionable home-care or lifestyle steps.
6. "otcMedicines": an array of 1-3 safe over-the-counter wellness supplements or medicines that may help manage symptoms. Each with "name", "purpose", and "searchQuery" for Google search in India.`,
        output: { schema: SymptomCheckerOutputSchema },
    });

    return output;
}
