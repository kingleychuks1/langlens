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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:image/jpeg;base64,${imageBase64}`,
              detail: "low",
            },
          },
          {
            type: "text",
            text: `You are LangLens — a real-time screen translator.${contextNote}

Find ALL text on screen that is NOT in ${targetLanguageLabel} and translate it naturally.
If everything is already in ${targetLanguageLabel} or there is no readable text, reply with exactly: EMPTY

Otherwise reply with this JSON only — no markdown, no code blocks:
{
  "hasContent": true,
  "detectedLanguages": ["language names"],
  "detectedText": "the original untranslated text found on screen, exactly as it appears",
  "translation": "natural fluent translation into ${targetLanguageLabel}",
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
      // If JSON parse fails treat the whole response as the translation
      result = {
        hasContent: true,
        detectedLanguages: ["unknown"],
        detectedText: raw,
        translation: raw,
        summary: "",
      };
    }

    if (!result.hasContent || !result.translation?.trim()) {
      return NextResponse.json({ hasContent: false });
    }

    // TTS — runs after translation is ready
    const tts = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: result.translation.slice(0, 1000),
      speed: 1.1,
    });

    const audioBase64 = Buffer.from(await tts.arrayBuffer()).toString("base64");

    return NextResponse.json({ ...result, audioBase64 });

  } catch (err) {
    console.error("Translate error:", err);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}