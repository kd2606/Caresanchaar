import { NextRequest, NextResponse } from "next/server";
import { checkSymptoms } from "@/ai/flows/symptom-checker";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { symptoms, painScale, duration, fever, age, gender } = body;
        if (!symptoms) {
            return NextResponse.json({ error: "symptoms field is required" }, { status: 400 });
        }
        const result = await checkSymptoms({ symptoms, painScale, duration, fever, age, gender });
        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Symptom checker error:", error);
        return NextResponse.json({ error: error.message || "AI service error" }, { status: 500 });
    }
}
