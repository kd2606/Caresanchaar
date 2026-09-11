"use server";

import { generateWithModelFallback } from "@/ai/generate-with-fallback";
import { z } from "genkit";

const CardioCheckOutputSchema = z.object({
    triagePriority: z.enum(["Routine Priority", "Elevated Priority", "High Priority"]),
    wellnessScore: z.number().min(0).max(100),
    overallAssessment: z.string(),
    precautions: z.array(z.string()),
    recommendations: z.array(z.string()),
    seekEmergency: z.boolean(),
    disclaimer: z.string(),
});

export interface CardioCheckInput {
    age: number;
    gender: string;
    bmi?: number;
    restingHR?: number;
    chestPainType: string;
    exerciseAngina: string;
    bloodSugar: string;
    smokerTarget: string;
}

export async function analyzeCardioCheck(input: CardioCheckInput) {
    try {
        const { output } = await generateWithModelFallback({
            prompt: `Act as an analytical wellness synthesizer. Analyze the user's provided biometrics and lifestyle metadata to determine cardio wellness triage. DO NOT use medical diagnostic terms (e.g., heart attack, myocardial infarction, diagnosing).

### User Provided Data:
- Age: ${input.age}
- Gender: ${input.gender}
- BMI: ${input.bmi || "Not Provided"}
- Resting HR (BPM): ${input.restingHR || "Not Provided"}
- Chest Pain Type: ${input.chestPainType}
- Exercise Induced Angina: ${input.exerciseAngina}
- Fasting Blood Sugar > 120: ${input.bloodSugar}
- Smoker: ${input.smokerTarget}

Provide a JSON response with:
1. "triagePriority": exactly "Routine Priority", "Elevated Priority", or "High Priority".
2. "wellnessScore": A wellness score from 0 to 100 based on the responses (higher is better).
3. "overallAssessment": A compassionate non-diagnostic summary of the cardio strain/risk.
4. "precautions": Array of actionable lifestyle recovery steps (e.g., diet, rest, hydration).
5. "recommendations": Array of broader cardiovascular health suggestions.
6. "seekEmergency": Boolean true if the data implies severe acute risk.
7. "disclaimer": Standard disclaimer: "This is an AI wellness triage tool, not a medical diagnosing instrument. Seek immediate medical help if experiencing severe distress."`,
            output: { schema: CardioCheckOutputSchema },
        });

        if (!output) throw new Error("Genkit returned empty output");
        return output;

    } catch (error) {
        console.error("Failed to generate cardio wellness analysis:", error);
        
        // Safety Fallback
        return {
            triagePriority: "High Priority",
            wellnessScore: 30,
            overallAssessment: "Our analytical system is temporarily unavailable. However, based on the provided inputs, we recommend prioritizing your cardiovascular wellness carefully.",
            precautions: [
                "Avoid strenuous activities.",
                "Sit down and rest in a comfortable position.",
                "If experiencing persistent severe discomfort, contact emergency services."
            ],
            recommendations: ["Maintain a healthy diet", "Consider scheduling a routine practitioner visit"],
            seekEmergency: false,
            disclaimer: "This is an AI wellness synthesis and not a diagnostic tool."
        };
    }
}
