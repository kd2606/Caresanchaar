const SARVAM_API_KEY = process.env.SARVAM_API_KEY;
const BASE_URL = "https://api.sarvam.ai";

export async function sarvamChat(messages: any[], model: string = "sarvam-30b") {
    if (!SARVAM_API_KEY) throw new Error("SARVAM_API_KEY is not set");

    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "api-subscription-key": SARVAM_API_KEY,
        },
        body: JSON.stringify({
            model,
            messages,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Sarvam AI Error: ${error}`);
    }

    return response.json();
}

export async function sarvamSTT(audioBlob: Blob) {
    if (!SARVAM_API_KEY) throw new Error("SARVAM_API_KEY is not set");

    const formData = new FormData();
    formData.append("file", audioBlob, "audio.wav");

    const response = await fetch(`${BASE_URL}/speech-to-text`, {
        method: "POST",
        headers: {
            "api-subscription-key": SARVAM_API_KEY,
        },
        body: formData,
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Sarvam STT Error: ${error}`);
    }

    return response.json();
}

export async function sarvamTTS(text: string, languageCode: string = "hi-IN") {
    if (!SARVAM_API_KEY) throw new Error("SARVAM_API_KEY is not set");

    const response = await fetch(`${BASE_URL}/text-to-speech`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "api-subscription-key": SARVAM_API_KEY,
        },
        body: JSON.stringify({
            text,
            target_language_code: languageCode,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Sarvam TTS Error: ${error}`);
    }

    return response.json();
}
