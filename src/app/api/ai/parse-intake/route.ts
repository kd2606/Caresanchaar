import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();
    if (!text) {
      return NextResponse.json({ error: 'Text required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing GEMINI_API_KEY' }, { status: 500 });
    }

    const prompt = `
      You are a medical parsing assistant. The user is an ASHA worker dictating patient details for an intake form.
      Extract the following fields from the text and return ONLY a valid JSON object. Do not include markdown formatting or backticks.
      Fields to extract (omit if not mentioned or cannot be confidently inferred):
      - "name": string (Patient's name)
      - "age_years": number (Patient's age in years)
      - "gender": string ("MALE", "FEMALE", or "OTHER")
      - "symptoms": string (Comma separated symptoms or reason for visit)
      - "temperature_f": number (Temperature in Fahrenheit, only digits)
      - "systolic_bp": number (Systolic blood pressure, top number)
      - "diastolic_bp": number (Diastolic blood pressure, bottom number)
      - "risk_level": string ("RED" for emergency/critical, "YELLOW" for high/urgent, "GREEN" for routine)

      Text to parse: "${text}"
    `;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const outputText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    let parsed;
    try {
      parsed = JSON.parse(outputText);
    } catch {
      // Fallback if markdown backticks were accidentally included
      parsed = JSON.parse(outputText.replace(/```json/g, '').replace(/```/g, '').trim());
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[parse-intake] error:', error);
    return NextResponse.json({ error: 'Failed to parse speech' }, { status: 500 });
  }
}
