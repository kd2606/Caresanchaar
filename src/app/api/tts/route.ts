import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const { text } = await req.json();

        if (!text) {
            return NextResponse.json({ error: "No text provided" }, { status: 400 });
        }

        if (!process.env.OPENAI_API_KEY) {
            return NextResponse.json({ error: "OPENAI_API_KEY is not set in environment variables" }, { status: 500 });
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        // Use OpenAI TTS with 'nova' voice for a very natural, friendly tone.
        // It handles Hinglish (Hindi written in English) surprisingly well.
        const audioResponse = await openai.audio.speech.create({
            model: "tts-1",
            voice: "nova",
            input: text,
            response_format: "wav",
        });

        const buffer = Buffer.from(await audioResponse.arrayBuffer());
        const base64Audio = buffer.toString("base64");

        return NextResponse.json({ audios: [base64Audio] });

    } catch (error: any) {
        console.error("TTS API Error:", error);
        return NextResponse.json({ error: error.message || "TTS failed" }, { status: 500 });
    }
}
