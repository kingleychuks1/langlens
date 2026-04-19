import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    try {
        const { text, targetLanguageLabel, voice } = await req.json();
        if (!text || !targetLanguageLabel) {
            return NextResponse.json({ error: "Missing text or language" }, { status: 400 });
        }
        const translationResponse = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            max_tokens: 500,
            messages: [
                { role: "system", content: "You are a professional translator. Output ONLY the translation, nothing else." },
                { role: "user", content: `Translate into ${targetLanguageLabel}:\n${text}` },
            ],
        });
        const translation = translationResponse.choices[0]?.message?.content?.trim() ?? "";
        if (!translation) return NextResponse.json({ error: "Translation failed" }, { status: 500 });
        const tts = await openai.audio.speech.create({
            model: "tts-1",
            voice: (voice ?? "nova") as "nova" | "alloy" | "shimmer" | "onyx" | "echo" | "fable",
            input: translation,
            speed: 1.0,
        });
        const audioBase64 = Buffer.from(await tts.arrayBuffer()).toString("base64");
        return NextResponse.json({ translation, audioBase64 });
    } catch (err) {
        console.error("Retranslate error:", err);
        return NextResponse.json({ error: "Failed" }, { status: 500 });
    }
}