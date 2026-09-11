import { NextResponse } from "next/server";
import { generateMentalHealthQuestions } from "@/ai/flows/mental-health";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const result = await generateMentalHealthQuestions(5);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Mental Health Questions API Error:", error);
        return NextResponse.json({ error: error.message || "Failed to generate questions" }, { status: 500 });
    }
}
