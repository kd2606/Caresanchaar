import { z } from "genkit";

export const MentalHealthInputSchema = z.object({
    answers: z.array(
        z.object({
            question: z.string(),
            answer: z.number().min(0).max(4),
        })
    ),
    voiceMetrics: z.object({
        wpm: z.number(),
        tension: z.string(),
    })
});

export const MentalHealthOutputSchema = z.object({
    wellnessScore: z.number().min(0).max(100),
    riskCategory: z.enum([
        "Routine Support Needed", 
        "Elevated Stress Profile", 
        "High Wellness Priority"
    ]),
    perceivedState: z.string(),
    summary: z.string(),
    recommendations: z.array(z.string()),
});

export const WellnessQuestionsSchema = z.object({
    questions: z.array(z.string()).describe("A list of uniquely generated lifestyle and stress questions.")
});
