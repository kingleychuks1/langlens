import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const { text, targetLanguageLabel, voice, context } = await req.json();

    if (!text || !targetLanguageLabel) {
      return NextResponse.json({ error: "Missing text or target language" }, { status: 400 });
    }

    // Step 1: Translate with gpt-4o-mini
    const contextNote = context ? `Context from previous sentence: "${context}"\n` : "";
    const translationResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: "You are a professional live conference interpreter. Translate naturally and fluently. Output ONLY the translation — no explanations, no quotes, nothing else.",
        },
        {
          role: "user",
          content: `${contextNote}Translate into ${targetLanguageLabel}:\n${text}`,
        },
      ],
    });

    const translation = translationResponse.choices[0]?.message?.content?.trim() ?? "";
    if (!translation) {
      return NextResponse.json({ error: "Empty translation" }, { status: 500 });
    }

    console.log(`✅ "${text}" → "${translation}"`);

    // Step 2: TTS
    const tts = await openai.audio.speech.create({
      model: "tts-1",
      voice: (voice ?? "nova") as "nova" | "alloy" | "shimmer" | "onyx" | "echo" | "fable",
      input: translation,
      speed: 1.0,
    });

    const audioBase64 = Buffer.from(await tts.arrayBuffer()).toString("base64");

    return NextResponse.json({ translation, audioBase64 });

  } catch (err) {
    console.error("Interpret error:", err instanceof Error ? err.message : err);
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Failed"
    }, { status: 500 });
  }
}