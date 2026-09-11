import { NextRequest, NextResponse } from "next/server";
import { chatWithPulse } from "@/ai/flows/pulse-chat";
import { callWithResilience, isCapacityExhausted } from "@/ai/resilience";
import { logger } from "@/lib/logger";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    try {
        const { messages, userContext } = await req.json();
        const url = new URL(req.url);
        const shouldStream = url.searchParams.get("stream") !== "false";

        if (!messages || messages.length === 0) {
            return NextResponse.json({ error: "No messages provided" }, { status: 400 });
        }

        const history = messages.slice(-20);

        // Split into previous history + last user message
        let lastUserIdx = -1;
        for (let i = history.length - 1; i >= 0; i--) {
            if (history[i].role === "user") { lastUserIdx = i; break; }
        }

        if (lastUserIdx === -1) {
            return NextResponse.json({ error: "No user message found" }, { status: 400 });
        }

        const lastUserContent = history[lastUserIdx].content;
        const previousHistory = history.slice(0, lastUserIdx);

        // Call the dedicated Pulse Genkit flow with resilience wrapper
        const result = await callWithResilience(
            () => chatWithPulse(previousHistory, lastUserContent, userContext),
            { maxAttempts: 2, label: 'pulse-chat-flow', maxDelayMs: 2_000 }
        );
        const responseText = result.content;

        if (!shouldStream) {
            return NextResponse.json({
                role: "model",
                content: responseText,
                timestamp: new Date().toISOString()
            });
        }

        // Stream word by word for the natural typing effect
        const encoder = new TextEncoder();
        const words = responseText.split(" ");

        const stream = new ReadableStream({
            start(controller) {
                let i = 0;
                const send = () => {
                    if (i < words.length) {
                        const chunk = (i === 0 ? "" : " ") + words[i++];
                        const data = { choices: [{ delta: { content: chunk } }] };
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                        setTimeout(send, 35);
                    } else {
                        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                        controller.close();
                    }
                };
                send();
            }
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive"
            }
        });

    } catch (error: any) {
        // Quota / rate-limit exhaustion → 503 with Retry-After.
        if (isCapacityExhausted(error)) {
            logger.warn('pulse-chat: capacity exhausted', { err: error.message });

            const capacityPayload = {
                error: 'AI_CAPACITY_EXHAUSTED',
                retryable: true,
                retryAfterSeconds: 30,
                userMessage: 'High demand right now. For urgent symptoms please contact emergency services.',
            };

            try {
                const url = new URL(req.url);
                if (url.searchParams.get("stream") === "false") {
                    return NextResponse.json(capacityPayload, {
                        status: 503,
                        headers: { 'Retry-After': '30' },
                    });
                }
            } catch (e) {
                // Ignore URL parsing errors
            }

            // For SSE mode, send a user-friendly message then close.
            const encoder = new TextEncoder();
            const msg = { choices: [{ delta: { content: "Our AI servers are experiencing very high demand right now 😓 Please try again in 30 seconds. For urgent symptoms, call 108 immediately." } }] };
            const stream = new ReadableStream({
                start(controller) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
                    controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                    controller.close();
                }
            });
            return new Response(stream, {
                headers: { "Content-Type": "text/event-stream", "Retry-After": "30" },
                status: 503
            });
        }

        console.error("[Pulse Route] Unexpected error:", error);
        
        const fallbackMsg = "Pulse is resting right now 😴 Please try again later.";
        
        try {
            const url = new URL(req.url);
            if (url.searchParams.get("stream") === "false") {
                return NextResponse.json({ role: "model", content: fallbackMsg }, { status: 200 });
            }
        } catch (e) {
            // Ignore URL parsing errors here
        }

        // Always return 200 SSE so the client never throws
        const encoder = new TextEncoder();
        const msg = { choices: [{ delta: { content: fallbackMsg } }] };
        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
            }
        });
        return new Response(stream, {
            headers: { "Content-Type": "text/event-stream" },
            status: 200
        });
    }
}
