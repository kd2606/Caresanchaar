"use server";

import { generateWithModelFallback } from "@/ai/generate-with-fallback";
import { DEEP_PSYCH_QUESTIONS } from "./constants";
import { 
    MentalHealthInputSchema, 
    MentalHealthOutputSchema, 
    WellnessQuestionsSchema 
} from "./mental-health-schemas";
import { z } from "genkit";

export async function analyzeMentalHealth(input: z.infer<typeof MentalHealthInputSchema>) {
    const answersText = input.answers
        .map((a, i) => `Q${i + 1}: ${a.question}\nAnswer Frequency: ${a.answer} (0=Never, 1=Rarely, 2=Sometimes, 3=Often, 4=Almost Constantly)`)
        .join("\n\n");

    const totalScore = input.answers.reduce((sum, a) => sum + a.answer, 0);

    try {
        const { output } = await generateWithModelFallback({
            prompt: `You are an empathetic analytical synthesizer evaluating a user's Wellness and Stress Assessment along with Voice Biomarkers.
        
*** SELF-REPORTED LIFESTYLE & STRESS DATA ***
${answersText}

*** VOICE BIOMARKERS ***
Speaking Speed: ${input.voiceMetrics.wpm} Words Per Minute (WPM)
Vocal Tone Tension: ${input.voiceMetrics.tension}
(Note: Highly stressed individuals often speak >150 WPM with High tension. Fatigued or lethargic individuals often speak <110 WPM with Low tension.)

Total Raw Distress Score: ${totalScore}/20

Provide a JSON response with:
1. "wellnessScore": a wellness score from 0-100 (100 being optimal wellness, inversely proportional to the distress score, poor sleep/diet, and voice biomarkers).
2. "riskCategory": exactly one of: "Routine Support Needed", "Elevated Stress Profile", or "High Wellness Priority".
3. "perceivedState": a brief, accurate description of their perceived emotional or energetic state.
4. "summary": a compassionate, supportive summary. Speak directly to them, acknowledging what their lifestyle data and voice indicators suggest about their current stress load. Do not use medical or diagnostic terminology.
5. "recommendations": array of actionable wellness, emotional regulation, and grounding techniques.

Important: Maintain an immensely empathetic, supportive, and human tone. Read between the lines of what their lifestyle data indicates relative to their physical vocal cues. Never claim to be a doctor or use words like 'diagnose', 'patient', 'treatment', or 'clinic'.`,
            output: { schema: MentalHealthOutputSchema },
        });

        if (!output) throw new Error("Genkit returned empty output");
        return output;

    } catch (error) {
        console.error("Failed to generate wellness analysis:", error);
        
        // Provide a highly empathetic safety fallback matching the schema
        const isHighDistress = totalScore >= 12;
        
        return {
            wellnessScore: Math.max(20, 100 - (totalScore * 5)),
            riskCategory: isHighDistress ? "High Wellness Priority" : "Elevated Stress Profile",
            perceivedState: isHighDistress ? "Highly Overwhelmed / High Stress" : "Stressed / Fatigued",
            summary: "I care about what you're experiencing. My analytical system is temporarily unavailable, but your responses suggest you are carrying a significant stress load. Please know that your feelings are valid and you do not have to carry this heavy burden alone.",
            recommendations: [
                "Practice the 4-7-8 breathing technique right now: Inhale for 4s, hold for 7s, exhale slowly for 8s.",
                "Ground yourself using the 5-4-3-2-1 method by naming things you can see, touch, and hear around you.",
                "Focus on getting restorative sleep tonight and drinking enough water."
            ]
        };
    }
}

export async function generateMentalHealthQuestions(count: number = 5) {
    try {
        const { output } = await generateWithModelFallback({
            prompt: `You are an analytical wellness synthesizer. Generate exactly ${count} unique questions to assess a user's stress, fatigue, and lifestyle balance. The questions should be written directly to the user (e.g., "How often do you feel..."). They should be answerable on a scale of Never/Rarely/Sometimes/Often/Constantly. Avoid medical or diagnostic terminology; focus on emotional regulation, sleep, diet, isolation, and workload.`,
            output: { schema: WellnessQuestionsSchema },
        });

        if (!output || !output.questions || output.questions.length === 0) {
            throw new Error("Genkit returned empty questions");
        }
        return output;
    } catch (error) {
        console.error("Failed to generate dynamic questions:", error);
        return { questions: DEEP_PSYCH_QUESTIONS };
    }
}

