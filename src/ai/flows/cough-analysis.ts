"use server";

import { generateWithGeminiOnly } from "@/ai/generate-with-fallback";
import { z } from "genkit";

const CoughAnalysisOutputSchema = z.object({
    coughType: z.enum(["dry", "wet", "wheezing", "barking", "unknown"]),
    triagePriority: z.enum(["High Triage Priority", "Elevated Triage Priority", "Routine Triage Priority"]),
    description: z.string(),
    simpleExplanation: z.string(),
    precautions: z.array(z.string()),
    otcMedicines: z.array(
        z.object({
            name: z.string(),
            purpose: z.string(),
            searchQuery: z.string(),
        })
    ),
    seekDoctor: z.boolean(),
    disclaimer: z.string(),
});

export interface CoughAnalysisInput {
    audioBase64: string;
    duration: string;
    fever: string;
    breathingDifficulty: string;
}

export async function analyzeCough({ audioBase64, duration, fever, breathingDifficulty }: CoughAnalysisInput) {
    const { output } = await generateWithGeminiOnly({
        prompt: [
            {
                media: { url: `data:audio/webm;base64,${audioBase64}` },
            },
            {
                text: `Analyze this cough audio recording alongside the user's clinical metadata. 
Metadata:
- Duration: ${duration}
- Fever: ${fever}
- Breathing Difficulty: ${breathingDifficulty}

Act as an analytical triage and wellness synthesizer. Do NOT diagnose the user or use medical diagnostic terms (like asthma, bronchitis, disease, patient, etc.). Output a structured health triage priority based strictly on the presented audio and data.

Provide a JSON response with:
1. "coughType": one of "dry", "wet", "wheezing", "barking", "unknown"
2. "triagePriority": MUST be exactly "High Triage Priority", "Elevated Triage Priority", or "Routine Triage Priority".
3. "description": brief auditory analysis of the detected cough characteristics (e.g. wet and rattling, dry and hacking).
4. "simpleExplanation": 1-2 lines explaining the priority level in simple language.
5. "precautions": array of actionable home care steps and precautions.
6. "otcMedicines": array with "name", "purpose", and "searchQuery" for wellness/supportive non-prescription items.
7. "seekDoctor": boolean indicating if they should see a provider soon based on the priority.
8. "disclaimer": Standard disclaimer that this is an AI wellness triage tool, not a medical diagnosing instrument.`,
            },
        ],
        output: { schema: CoughAnalysisOutputSchema },
    });

    return output;
}
