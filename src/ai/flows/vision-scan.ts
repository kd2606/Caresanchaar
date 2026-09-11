"use server";

import { generateWithGeminiOnly } from "@/ai/generate-with-fallback";
import { z } from "genkit";

const VisionScanOutputSchema = z.object({
    triagePriority: z.enum(["High Fatigue Priority", "Elevated Strain Profile", "Routine Recovery Profile"]),
    fatigueIndex: z.number(), // 0 to 100
    indicators: z.array(
        z.object({
            sign: z.string(),
            detected: z.boolean(),
            details: z.string(),
        })
    ),
    overallAssessment: z.string(),
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

export interface VisionScanInput {
    imageBase64: string;
    screenTime: string;
    sleepHours: string;
    stressLevel: string;
}

export async function analyzeVisionScan({ imageBase64, screenTime, sleepHours, stressLevel }: VisionScanInput) {
    const { output } = await generateWithGeminiOnly({
        prompt: [
            {
                media: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
            {
                text: `Analyze this facial photo alongside the user's lifestyle metadata for signs of fatigue and strain. 
Metadata:
- Screen Time (Daily): ${screenTime}
- Sleep (Last night): ${sleepHours}
- Stress Level: ${stressLevel}

Act as an analytical wellness synthesizer. Do NOT diagnose the user or use medical diagnostic terms (like insomnia, disease, patient, etc.). Output a structured health triage priority based strictly on the presented image and data.

Provide a JSON response with:
1. "triagePriority": MUST be exactly "High Fatigue Priority", "Elevated Strain Profile", or "Routine Recovery Profile".
2. "fatigueIndex": A number from 0 to 100 representing the estimated exhaustion level.
3. "indicators": array with "sign", "detected" (boolean), and "details" (e.g. Dark circles, Drooping eyelids).
4. "overallAssessment": summary paragraph of visual strain analysis.
5. "simpleExplanation": 1-2 lines explaining the priority level in simple language.
6. "precautions": array of actionable lifestyle recovery steps.
7. "otcMedicines": array with "name", "purpose", and "searchQuery" for wellness/supportive non-prescription items (e.g., eye drops, vitamins).
8. "seekDoctor": boolean indicating if they should see a doctor soon based on the priority.
9. "disclaimer": Standard disclaimer that this is an AI wellness triage tool, not a medical diagnosing instrument.`,
            },
        ],
        output: { schema: VisionScanOutputSchema },
    });

    return output;
}
