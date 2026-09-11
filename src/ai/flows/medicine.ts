"use server";

import { generateWithModelFallback } from "@/ai/generate-with-fallback";

export type MedicinePriceInfo = {
    searchedName: string;
    genericName: string;
    genericPrice: number;
    brandedName: string;
    brandedPrice: number;
    purchaseLink: string;
};

const SYSTEM_PROMPT = `You are a helpful pharmaceutical AI specialized in the Indian medicine market.
Given a medicine name (either generic or brand name), provide the following information as a raw JSON object matching this schema exactly:
{
  "searchedName": "The corrected, capitalized name of what they searched",
  "genericName": "The underlying generic chemical formulation (e.g., Paracetamol, Amoxicillin)",
  "genericPrice": <Estimated average price in INR for a strip/pack of the generic (Jan Aushadhi) version (number only)>,
  "brandedName": "A popular, specific brand name for this formulation (e.g., Crocin, Augmentin)",
  "brandedPrice": <Estimated average price in INR for a strip/pack of the branded version (number only)>,
  "purchaseLink": "A real pharmacy search URL for Tata 1mg, format: https://www.1mg.com/search/all?name=<url_encoded_medicine_name>"
}

CRITICAL: Return ONLY valid JSON. No markdown code blocks, no intro, no outro text. Just the JSON object. Make the pricing realistic based on Indian market averages.
`;

export async function getMedicinePrices(query: string): Promise<MedicinePriceInfo> {
    try {
        const { text } = await generateWithModelFallback({
            system: SYSTEM_PROMPT,
            prompt: `Find realistic price comparison for medicine: ${query}`,
            config: {
                temperature: 0.1, // Low temp for more deterministic, factual output
            }
        });

        // Clean up text if Gemini occasionally wraps in markdown blocks
        let cleanText = text.trim();
        if (cleanText.startsWith('```json')) cleanText = cleanText.substring(7);
        if (cleanText.startsWith('```')) cleanText = cleanText.substring(3);
        if (cleanText.endsWith('```')) cleanText = cleanText.substring(0, cleanText.length - 3);
        cleanText = cleanText.trim();

        const data = JSON.parse(cleanText);

        return {
            searchedName: data.searchedName || query,
            genericName: data.genericName || "Generic Formulation",
            genericPrice: typeof data.genericPrice === 'number' ? data.genericPrice : 20,
            brandedName: data.brandedName || "Top Brand Alternative",
            brandedPrice: typeof data.brandedPrice === 'number' ? data.brandedPrice : 60,
            purchaseLink: data.purchaseLink || `https://www.1mg.com/search/all?name=${encodeURIComponent(query)}`
        };
    } catch (error) {
        console.error("Medicine AI Error:", error);
        // Graceful fallback if parsing fails or error occurs
        return {
            searchedName: query.charAt(0).toUpperCase() + query.slice(1),
            genericName: "Generic Formulation",
            genericPrice: 15,
            brandedName: "Branded Alternative",
            brandedPrice: 55,
            purchaseLink: `https://www.1mg.com/search/all?name=${encodeURIComponent(query)}`
        };
    }
}
