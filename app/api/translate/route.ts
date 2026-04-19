import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const { imageBase64, targetLanguage, targetLanguageLabel, recentContext } = await req.json();
    if (!imageBase64 || !targetLanguage) {
      return NextResponse.json({ error: "Missing image or target language" }, { status: 400 });
    }

    const contextNote = recentContext?.length > 0
      ? `\nFor context, previous translations: ${recentContext.slice(-2).join(" | ")}`
      : "";

    // Step 1: Vision + translation in one call using gpt-4o-mini
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "low", // fastest — sufficient for reading text
            },
          },
          {
            type: "text",
            text: `You are LangLens — a real-time screen translator.${contextNote}

Find ALL text on screen that is NOT in ${targetLanguageLabel} and translate it naturally.
If everything is already in ${targetLanguageLabel} or there is no readable text, reply with exactly: EMPTY

Otherwise reply with this JSON only — no markdown:
{
  "hasContent": true,
  "detectedLanguages": ["language names"],
  "translation": "natural fluent translation here",
  "summary": "one sentence describing what is on screen in ${targetLanguageLabel}"
}`,
          },
        ],
      }],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? "";

    if (raw === "EMPTY" || raw === "") {
      return NextResponse.json({ hasContent: false });
    }

    let result;
    try {
      result = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      result = { hasContent: true, detectedLanguages: ["unknown"], translation: raw, summary: "" };
    }

    if (!result.hasContent || !result.translation?.trim()) {
      return NextResponse.json({ hasContent: false });
    }

    // Step 2: TTS — runs after translation is parsed
    const tts = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: result.translation.slice(0, 1000), // cap length for speed
      speed: 1.1, // slightly faster speech
    });

    const audioBase64 = Buffer.from(await tts.arrayBuffer()).toString("base64");

    return NextResponse.json({ ...result, audioBase64 });

  } catch (err) {
    console.error("Translate error:", err);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}