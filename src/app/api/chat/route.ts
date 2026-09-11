import { NextResponse } from "next/server";
import { chatWithAI } from "@/ai/flows/chat";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { history, message } = body;

        if (!message) {
            return NextResponse.json({ error: "Missing message" }, { status: 400 });
        }

        const result = await chatWithAI(history || [], message);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Chat Flow Error:", error);
        return NextResponse.json({ error: error.message || "Failed to contact AI" }, { status: 500 });
    }
}
