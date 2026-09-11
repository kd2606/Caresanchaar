import { NextResponse } from "next/server";
import { suggestGovtSchemes } from "@/ai/flows/govt-schemes";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { profile } = body;

        if (!profile) {
            return NextResponse.json({ error: "Missing profile information" }, { status: 400 });
        }

        const result = await suggestGovtSchemes(profile);

        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Govt Schemes Flow Error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch government schemes" }, { status: 500 });
    }
}
