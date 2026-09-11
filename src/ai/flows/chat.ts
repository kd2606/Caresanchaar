"use server";

import { generateWithModelFallback } from "@/ai/generate-with-fallback";

export type ChatMessage = {
    role: "user" | "model" | "system";
    content: string;
};

const SYSTEM_PROMPT = `
You are Medu, a polite, empathetic, and highly effective AI health assistant for caresanchaar AI, designed specifically for rural India. Your goal is to help users understand their health and efficiently guide them through the app.

CRITICAL LANGUAGE GUIDELINES:
1. You MUST carefully detect the language the user is speaking (e.g., English, Hindi, Hinglish, Chhattisgarhi, Marathi, Bengali, Tamil, Telugu, Gujarati, etc.).
2. You MUST reply in the EXACT SAME language the user used.
   - If they write in English, reply in English.
   - If they write in Hindi or Hinglish (Hindi written in English alphabet), reply in Hindi (using Devanagari script).
   - If they write in any other Indian regional language, reply in that same language.
3. For Chhattisgarhi and Hindi, use a respectful, culturally appropriate rural tone (e.g., use "जोहार" or "नमस्ते").

MEDICAL & UX GUIDELINES:
1. Be extremely concise and direct. Do not use fluff or excessive pleasantries.
2. Offer clear, actionable advice in 1-2 short sentences.
3. Avoid scary medical jargon.
4. If they mention skin issues, suggest the 'Skin Scan' tool.
5. If they describe a cough, suggest the 'Cough Analysis' tool.
6. If they seem stressed, suggest the 'Mental Health Screen'.
7. Include a brief disclaimer that you're an AI and they should see a doctor for formal diagnoses.

Keep your responses strictly under 2 short paragraphs, prioritizing quick answers over conversational filler. Use minimal emojis.
`;

export async function chatWithAI(history: ChatMessage[], newMessage: string): Promise<ChatMessage> {
    try {
        // Ensure first history item is from the user for provider compatibility.
        const validHistory = [...history];
        while (validHistory.length > 0 && validHistory[0].role !== "user") {
            validHistory.shift();
        }

        const formattedHistory = validHistory.map((m) => ({
            role: m.role,
            content: [{ text: m.content }],
        }));

        const { text } = await generateWithModelFallback({
            system: SYSTEM_PROMPT,
            messages: [
                ...formattedHistory,
                { role: "user", content: [{ text: newMessage }] },
            ],
            config: {
                temperature: 0.5,
            }
        });

        const textResponse = text;

        return { role: "model", content: textResponse || "I'm sorry, I encountered an error." };
    } catch (error: any) {
        console.error("Chat Error:", error);
        if (error.status === 429 || error.message?.includes("429")) {
            return { role: "model", content: "I'm getting too many questions right now! Please wait a minute before making another request. ⏳" };
        }
        return { role: "model", content: "I'm having trouble connecting. Please try again later." };
    }
}
