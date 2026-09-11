import { GoogleGenAI } from '@google/genai';
import { env } from '@/lib/env';
import {
  aiTriageOutputSchema,
  geminiResponseSchema,
  type AiTriageOutput,
} from '@/lib/triage/schema';
import { SYSTEM_INSTRUCTION } from '@/lib/triage/prompt';

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

/**
 * Call Gemini with a constrained JSON schema and validate the result.
 *
 * Note on Gemini 3.x: temperature / topP / topK are no longer accepted; output
 * determinism is steered via `thinkingLevel`. 'low' keeps field latency
 * acceptable on poor connectivity while retaining enough reasoning for
 * schema-constrained extraction. Raise to 'medium' if evaluation shows
 * insufficient citation discipline.
 */
export async function generateTriageAssessment(
  userPrompt: string,
): Promise<AiTriageOutput> {
  const response = await ai.models.generateContent({
    model: env.GEMINI_GENERATION_MODEL,
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: geminiResponseSchema,
      // @ts-expect-error - thinkingLevel is a new feature in the Gemini 3.x API not yet in stable typings
      thinkingLevel: 'low',
      maxOutputTokens: 2_048,
    },
  });

  const raw = response.text;
  if (!raw) throw new Error('Empty response from generation model.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Model returned non-JSON output: ${raw.slice(0, 200)}`);
  }

  const result = aiTriageOutputSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`Model output failed validation: ${result.error.message}`);
  }
  return result.data;
}
