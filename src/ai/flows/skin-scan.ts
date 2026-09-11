"use server";

import { generateWithGeminiOnly } from "@/ai/generate-with-fallback";
import { z } from "genkit";

const SkinScanOutputSchema = z.object({
    triagePriority: z.enum(["High Triage Priority", "Elevated Triage Priority", "Routine Triage Priority"]),
    visualFeatures: z.array(
        z.object({
            feature: z.string(),
            urgencyLevel: z.enum(["High", "Medium", "Low"]),
            description: z.string(),
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

export interface SkinScanInput {
    imageBase64: string;
    itchingLevel: string;
    spreadRate: string;
    recentChanges: string;
}

export async function analyzeSkinScan({ imageBase64, itchingLevel, spreadRate, recentChanges }: SkinScanInput) {
    const { output } = await generateWithGeminiOnly({
        prompt: [
            {
                media: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
            {
                text: `Analyze this skin photo alongside the user's dermatological metadata. 
Metadata:
- Itching Level: ${itchingLevel}
- Spread Rate: ${spreadRate}
- Recent Changes: ${recentChanges}

Act as an analytical skin health triage synthesizer. Do NOT diagnose the user with specific medical conditions. It is STRICTLY PROHIBITED to diagnose specific cancers like melanoma, regardless of the ABCD evaluation. Look for indicators of general dermatological urgency such as severe inflammation, bleeding, or rapid spread.

Output a structured health triage priority based strictly on the presented image and data.

Provide a JSON response with:
1. "triagePriority": MUST be exactly "High Triage Priority", "Elevated Triage Priority", or "Routine Triage Priority".
2. "visualFeatures": array with "feature", "urgencyLevel" (High/Medium/Low), and "description".
3. "overallAssessment": summary paragraph of visual skin analysis.
4. "simpleExplanation": 1-2 lines explaining the priority level in simple language.
5. "precautions": array of actionable skin care steps and precautions.
6. "otcMedicines": array with "name", "purpose", and "searchQuery" for wellness/supportive non-prescription items (e.g., soothing creams, moisturizers).
7. "seekDoctor": boolean indicating if they should see a dermatologist or doctor soon based on the priority.
8. "disclaimer": Standard disclaimer that this is an AI wellness triage tool, not a medical diagnosing instrument.`,
            },
        ],
        output: { schema: SkinScanOutputSchema },
    });

    return output;
}
