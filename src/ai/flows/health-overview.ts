"use server";

import { generateWithModelFallback } from "@/ai/generate-with-fallback";
import { z } from "genkit";

const HealthOverviewInputSchema = z.object({
    age: z.number(),
    gender: z.string(),
    lifestyle: z.array(z.string()),
});

const HealthOverviewOutputSchema = z.object({
    threats: z.array(
        z.object({
            name: z.string(),
            description: z.string(),
            severity: z.enum(["High", "Medium", "Low"]),
        })
    ),
    recommendations: z.array(z.string()),
    otcMedicines: z.array(
        z.object({
            name: z.string(),
            purpose: z.string(),
            searchQuery: z.string(),
        })
    ),
});

export async function analyzeHealthOverview(input: z.infer<typeof HealthOverviewInputSchema>) {
    const { output } = await generateWithModelFallback({
        prompt: `You are a health advisory AI assistant. Analyze the following person's profile and provide health insights.

Age: ${input.age}
Gender: ${input.gender}
Lifestyle factors: ${input.lifestyle.join(", ")}

Provide a JSON response with:
1. "threats": array of potential health threats, each with "name", "description", and "severity" (High/Medium/Low)
2. "recommendations": array of health recommendation strings
3. "otcMedicines": array of OTC medicine suggestions, each with "name", "purpose", and "searchQuery" (for Google search)

Be informative but always state these are for educational purposes only, not medical diagnoses.`,
        output: { schema: HealthOverviewOutputSchema },
    });

    return output;
}
