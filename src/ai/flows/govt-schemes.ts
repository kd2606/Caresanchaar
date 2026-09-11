"use server";

import { generateWithModelFallback } from "@/ai/generate-with-fallback";
import { z } from "genkit";

const GovtSchemesOutputSchema = z.object({
    schemes: z.array(
        z.object({
            name: z.string(),
            description: z.string(),
            eligibilityStatus: z.enum(["eligible", "maybe", "check"]),
            eligibility: z.string(),
            benefits: z.string(),
            howToApply: z.string(),
            officialLink: z.string(),
        })
    ),
});

export async function suggestGovtSchemes(profile: {
    age?: number;
    state?: string;
    category?: string;
}) {
    const { output } = await generateWithModelFallback({
        prompt: `
You are a knowledgeable assistant specializing in Indian Government Health and Social Welfare Schemes (both Central and State level).
Based on the following minimal user profile, suggest the most relevant government schemes they might be eligible for.

User Profile:
- Age: ${profile.age || "Not specified"}
- State of Residence: ${profile.state || "Not specified"} (Important for state-specific schemes)
- Category: ${profile.category || "Not specified"}

Please specifically check if the user qualifies for the following key schemes:
1. Ayushman Bharat — PM JAY (₹5 lakh health cover)
2. Pradhan Mantri Suraksha Bima (₹2 lakh accident insurance — ₹12/year)
3. Janani Suraksha Yojana (For pregnant women)
4. Rashtriya Bal Swasthya Karyakram (For children 0-18)
5. National Mental Health Programme
6. PM Matru Vandana Yojana (For mothers)
7. Mukhyamantri Vishesh Swasthya Sahayata Yojana (Chhattisgarh specific)
8. Sanjeevani — CG Health Scheme (Chhattisgarh specific)

Provide a JSON response with:
1. "schemes": An array of highly relevant schemes. For each scheme provide:
   - "name": Official name of the scheme
   - "description": Brief summary
   - "eligibilityStatus": Must be one of: "eligible" (You are eligible!), "maybe" (You may be eligible), "check" (Check eligibility).
   - "eligibility": Key eligibility criteria in simple language
   - "benefits": Financial or health benefits provided (e.g., "Free treatment upto ₹5 Lakh per year")
   - "howToApply": Steps or documents needed to apply, kept very simple
   - "officialLink": A search query or URL to find more info (e.g., "https://www.google.com/search?q=Ayushman+Bharat+apply")

Ensure the recommendations are practical, use highly simplified non-technical language tailored to rural Indian demographics, and format numerical benefits clearly with the ₹ symbol.
        `,
        output: { schema: GovtSchemesOutputSchema },
    });

    return output;
}
