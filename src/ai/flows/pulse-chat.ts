"use server";

import { generateWithModelFallback } from "@/ai/generate-with-fallback";
import { z } from "genkit";

// --- Backwards-compatible export (consumed by /api/pulse/route.ts) ---
export type PulseChatMessage = {
    role: "user" | "model";
    content: string;
};

// --- System prompt: the airtight triage contract ---
const PULSE_TRIAGE_SYSTEM_PROMPT = `You are "Pulse," a medical TRIAGE ASSISTANT for the PulseCheck AI platform serving rural India.
Your role is strictly limited. You MUST follow these rules without exception:

## ROLE BOUNDARIES (NON-NEGOTIABLE)
1. You are NOT a doctor. You DO NOT diagnose. You DO NOT prescribe.
2. Your sole function is to (a) gather symptom information through clear questions,
   (b) assess urgency level, and (c) recommend an appropriate care pathway
   (self-care guidance, visit a local clinic, visit a hospital, or seek emergency care immediately).
3. You MUST refuse, politely but firmly, any request to:
   - Name a specific disease as the user's confirmed condition.
   - Recommend specific medications, dosages, or prescriptions.
   - Interpret lab results, X-rays, or imaging as a definitive finding.
   - Discuss any topic unrelated to the user's current health concern
     (politics, entertainment, coding help, general knowledge, etc.).

## REFUSAL TEMPLATE
When asked to step outside your role, respond with:
"I'm Pulse, a triage assistant. I can't help with that, but I can help you understand
your symptoms and decide where to seek care. What are you feeling right now?"

## CLINICAL SAFETY RULES
- If the user describes ANY of these red-flag symptoms, immediately instruct them
  to call emergency services (108) or go to the nearest hospital:
  chest pain, difficulty breathing, sudden weakness on one side, severe bleeding,
  loss of consciousness, suicidal thoughts, signs of stroke, severe allergic reaction,
  prolonged seizure, severe abdominal pain in pregnancy, or a child under 2 with high fever.
- When uncertain, ALWAYS escalate to a higher urgency level. Under-triage is unsafe; over-triage is not.
- Never reassure the user that "it's probably nothing." Use neutral language: "These symptoms
  could have several causes. A clinician can help you determine the cause."

## COMMUNICATION STYLE
- Use simple, plain language at a 6th-grade reading level.
- Ask ONE question at a time. Never overwhelm the user with multi-part questions.
- Be empathetic but factual. Avoid emotional escalation.
- If the user writes in Hindi, Tamil, Bengali, or another Indian language, respond in that language.
- Keep responses short — max 4-5 lines.

## VERDICT RULES
- For any symptom discussion, give a verdict:
  🔴 Visit doctor TODAY / 🟡 Monitor 24-48hrs / 🟢 Rest at home
- For serious symptoms (chest pain, difficulty breathing, high fever in child): say "Call 108 immediately" FIRST.

## DISCLAIMER
End every response about symptoms with:
"⚠️ This is triage guidance, not a medical diagnosis. Please consult a licensed clinician."
Use the same language the user is writing in.`;

// --- Structured output schema (for new callers who want typed data) ---
const PulseChatOutputSchema = z.object({
    assistantMessage: z.string(),
    followUpQuestion: z.string().nullable(),
    urgencyLevel: z.enum(['self_care', 'routine', 'soon', 'urgent', 'emergency']),
    recommendedPathway: z.enum([
        'continue_conversation',
        'self_care_guidance',
        'visit_local_clinic',
        'visit_hospital',
        'call_emergency_services',
    ]),
    redFlagsDetected: z.array(z.string()),
    disclaimer: z.string(),
});

export type PulseChatOutput = z.infer<typeof PulseChatOutputSchema>;

const PulseChatInputSchema = z.object({
    userMessage: z.string(),
    conversationHistory: z
        .array(z.object({ role: z.enum(['user', 'model']), content: z.string() }))
        .max(20),
    locale: z.string().default('en-IN'),
});

export type PulseChatInput = z.infer<typeof PulseChatInputSchema>;

// --- New structured flow (available for new callers) ---
export async function pulseChatFlow(input: PulseChatInput): Promise<PulseChatOutput> {
    const { output } = await generateWithModelFallback({
        system: PULSE_TRIAGE_SYSTEM_PROMPT,
        messages: [
            ...input.conversationHistory.map((m) => ({
                role: m.role === 'user' ? ('user' as const) : ('model' as const),
                content: [{ text: m.content }],
            })),
            { role: 'user', content: [{ text: input.userMessage }] },
        ],
        output: { schema: PulseChatOutputSchema, format: 'json' },
        config: {
            temperature: 0.1,           // Was 0.7 — far too creative for triage.
            topP: 0.8,
            topK: 20,
            maxOutputTokens: 1024,
            safetySettings: [
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
                { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_LOW_AND_ABOVE' },
            ],
        },
    });

    if (!output) {
        throw new Error('PulseChat flow returned no structured output.');
    }
    return output;
}

// --- Backwards-compatible wrapper (consumed by /api/pulse/route.ts) ---
// Adapts old calling convention → new flow → old return shape.
export async function chatWithPulse(
    history: PulseChatMessage[],
    newMessage: string,
    userContext?: any
): Promise<PulseChatMessage> {
    try {
        // Build dynamic prompt with user context (existing behavior preserved).
        let dynamicPrompt = PULSE_TRIAGE_SYSTEM_PROMPT;

        if (userContext) {
            const formatReminders = (reminders: any[]) => {
                if (!reminders || reminders.length === 0) return "None";
                return reminders.filter(r => r.dueToday).map(r => `${r.name} at ${r.time}`).join(", ") || "None";
            };

            const contextBlock = `
USER HEALTH CONTEXT:
Holistic Score: ${userContext.holisticScore || 'Unknown'}/100
Recent Symptoms: ${(userContext.symptomHistory || []).join(", ") || 'None'}
Last Scan: ${userContext.lastScan ? `${userContext.lastScan.type} - ${userContext.lastScan.severity}` : 'No scans'}
Reminders Due Today: ${formatReminders(userContext.reminders)}

Use this context to give personalized responses.
If user asks "how am I doing?" or "mera health kaisa hai?" — answer using this real data.`;

            dynamicPrompt += `\n\n${contextBlock}`;
        }

        // Normalize consecutive same-role messages (existing logic).
        const validHistory: PulseChatMessage[] = [];
        for (const m of history) {
            if (validHistory.length > 0 && validHistory[validHistory.length - 1].role === m.role) {
                validHistory[validHistory.length - 1].content += "\n\n" + m.content;
            } else {
                validHistory.push({ ...m });
            }
        }

        // Ensure first history item is from the user for provider compatibility.
        if (validHistory.length > 0 && validHistory[0].role !== "user") {
            validHistory.shift();
        }

        const formattedHistory = validHistory.map((m) => ({
            role: m.role,
            content: [{ text: m.content }],
        }));

        const { text } = await generateWithModelFallback({
            system: dynamicPrompt,
            messages: [
                ...formattedHistory,
                { role: "user", content: [{ text: newMessage }] },
            ],
            config: {
                temperature: 0.1,       // Hardened: was 0.7.
                topP: 0.8,
                topK: 20,
                maxOutputTokens: 1024,
            },
        });

        return { role: "model", content: text };
    } catch (error: any) {
        console.error("[Pulse Flow] Error:", error);
        if (error?.status === 429 || error?.message?.includes("429")) {
            return { role: "model", content: "A lot of people are asking right now 😊 Please wait a minute and try again." };
        }
        return { role: "model", content: "Pulse is resting right now 😴 Please try again later." };
    }
}
