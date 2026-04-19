import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(req: NextRequest) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const { text, voice } = await req.json();
    if (!text) return NextResponse.json({ error: "No text provided" }, { status: 400 });

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice ?? "nova",
      input: text.slice(0, 4096),
      speed: 1.0,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    return new Response(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err) {
    console.error("TTS error:", err);
    return NextResponse.json({ error: "Speech synthesis failed" }, { status: 500 });
  }
}
