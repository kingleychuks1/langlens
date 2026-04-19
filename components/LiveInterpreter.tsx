"use client";

import { useCallback, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/languages";

const VOICES = [
  { id: "nova", label: "Nova", desc: "Warm female" },
  { id: "alloy", label: "Alloy", desc: "Neutral" },
  { id: "shimmer", label: "Shimmer", desc: "Expressive female" },
  { id: "onyx", label: "Onyx", desc: "Deep male" },
  { id: "echo", label: "Echo", desc: "Smooth male" },
  { id: "fable", label: "Fable", desc: "British male" },
];

const SOURCE_LANGUAGES = [
  { code: "en", label: "English", flag: "🇬🇧" },
  { code: "fr", label: "French", flag: "🇫🇷" },
  { code: "es", label: "Spanish", flag: "🇪🇸" },
  { code: "de", label: "German", flag: "🇩🇪" },
  { code: "zh", label: "Chinese", flag: "🇨🇳" },
  { code: "ja", label: "Japanese", flag: "🇯🇵" },
  { code: "ar", label: "Arabic", flag: "🇸🇦" },
  { code: "pt", label: "Portuguese", flag: "🇧🇷" },
  { code: "hi", label: "Hindi", flag: "🇮🇳" },
];

const LANG_CODES: Record<string, string> = {
  en: "en-GB", fr: "fr-FR", es: "es-ES", de: "de-DE",
  zh: "zh-CN", ja: "ja-JP", ar: "ar-SA", pt: "pt-BR", hi: "hi-IN",
};

interface Segment {
  id: number;
  original: string;
  translation: string;
  time: string;
}

type Status = "idle" | "listening" | "processing" | "speaking" | "error";

function WaveBar({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-0.5 h-8">
      {[3, 6, 9, 5, 8, 4, 7, 6, 3, 5].map((h, i) => (
        <div key={i} className="w-1 rounded-full transition-all duration-150"
          style={{
            height: active ? `${h + Math.random() * 6}px` : "3px",
            background: active ? "#0ea5e9" : "#1f3050",
            animationDelay: `${i * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}

export default function LiveInterpreter() {
  const [sourceLang, setSourceLang] = useState("en");
  const [targetLang, setTargetLang] = useState("zh");
  const [selectedVoice, setSelectedVoice] = useState("nova");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [segments, setSegments] = useState<Segment[]>([]);
  const [liveOriginal, setLiveOriginal] = useState("");
  const [liveTranslation, setLiveTranslation] = useState("");
  const [volume, setVolume] = useState(1.0);

  const recognitionRef = useRef<any>(null); // eslint-disable-line
  const segIdRef = useRef(0);
  const lastTranslationRef = useRef("");
  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const selectedSource = SOURCE_LANGUAGES.find((l) => l.code === sourceLang) ?? SOURCE_LANGUAGES[0];
  const selectedTarget = LANGUAGES.find((l) => l.code === targetLang) ?? LANGUAGES[5];

  const translate = useCallback(async (text: string) => {
    if (processingRef.current) return;
    processingRef.current = true;
    setStatus("processing");

    try {
      const res = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          targetLanguageLabel: selectedTarget.label,
          voice: selectedVoice,
          context: lastTranslationRef.current,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const { translation, audioBase64 } = data;
      setLiveTranslation(translation);
      lastTranslationRef.current = translation;

      const id = ++segIdRef.current;
      const time = new Date().toLocaleTimeString("en-GB", {
        hour: "2-digit", minute: "2-digit", second: "2-digit",
      });
      setSegments((prev) => [...prev, { id, original: text, translation, time }].slice(-40));

      // Play audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }

      const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
      const blob = new Blob([audioBytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.volume = volume;
      audioRef.current = audio;

      setStatus("speaking");
      audio.play().catch(() => { });
      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        if (activeRef.current) setStatus("listening");
      };

      setTimeout(() => {
        feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
      }, 100);

    } catch (err) {
      console.error("Translate error:", err);
      if (activeRef.current) setStatus("listening");
    } finally {
      processingRef.current = false;
    }
  }, [selectedTarget, selectedVoice, volume]);

  const start = () => {
    setError("");
    setSegments([]);
    setLiveOriginal("");
    setLiveTranslation("");
    lastTranslationRef.current = "";

    // eslint-disable-next-line
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) {
      setError("Speech recognition requires Chrome or Edge.");
      return;
    }

    const r = new SR();
    r.continuous = true;
    r.interimResults = true;
    r.lang = LANG_CODES[sourceLang] ?? "en-GB";
    r.maxAlternatives = 1;

    r.onstart = () => {
      activeRef.current = true;
      setStatus("listening");
    };

    r.onresult = (e: any) => { // eslint-disable-line
      // Only process final results — not interim ones
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          const transcript = e.results[i][0].transcript.trim();
          if (transcript.length < 2) continue;
          console.log("Final transcript:", transcript);
          setLiveOriginal(transcript);
          translate(transcript);
        }
      }
    };

    r.onerror = (e: any) => { // eslint-disable-line
      if (e.error === "no-speech") return; // ignore silence
      if (e.error === "aborted") return;   // ignore manual stop
      console.error("Speech error:", e.error);
      setError(`Speech error: ${e.error}. Try refreshing.`);
      setStatus("error");
    };

    r.onend = () => {
      // Auto-restart unless deliberately stopped
      if (activeRef.current) {
        try { r.start(); } catch { }
      }
    };

    recognitionRef.current = r;
    r.start();
  };

  const stop = useCallback(() => {
    activeRef.current = false;
    processingRef.current = false;
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch { }
      recognitionRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setStatus("idle");
    setLiveOriginal("");
    setLiveTranslation("");
  }, []);

  const isRunning = status !== "idle" && status !== "error";

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Source */}
        <div className="bg-lens-card border border-lens-border rounded-xl p-3">
          <p className="text-lens-sub text-xs uppercase tracking-widest mb-2">You speak</p>
          <div className="grid grid-cols-3 gap-1">
            {SOURCE_LANGUAGES.map((l) => (
              <button key={l.code} onClick={() => setSourceLang(l.code)} disabled={isRunning}
                className={`flex flex-col items-center py-1.5 px-1 rounded-lg text-xs transition-all ${sourceLang === l.code
                    ? "bg-lens-teal/20 border border-lens-teal/40 text-lens-teal-light"
                    : "border border-transparent hover:bg-lens-muted/40 text-lens-sub disabled:opacity-40"
                  }`}>
                <span style={{ fontSize: "16px" }}>{l.flag}</span>
                <span className="text-[10px] mt-0.5">{l.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex flex-col items-center justify-center gap-3">
          <div className="flex items-center gap-3 text-2xl">
            <span className="text-lens-teal-light">{selectedSource.flag}</span>
            <svg width="32" height="16" viewBox="0 0 32 16" fill="none">
              <path d="M2 8h28M22 2l8 6-8 6" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{selectedTarget.flag}</span>
          </div>
          <p className="text-lens-sub text-xs text-center">{selectedSource.label} → {selectedTarget.label}</p>
          <button disabled={isRunning}
            onClick={() => { setSourceLang(targetLang); setTargetLang(sourceLang); }}
            className="text-xs px-3 py-1.5 rounded-lg border border-lens-border text-lens-sub hover:border-lens-muted hover:text-lens-text transition-colors disabled:opacity-40">
            Swap
          </button>
        </div>

        {/* Target */}
        <div className="bg-lens-card border border-lens-border rounded-xl p-3">
          <p className="text-lens-sub text-xs uppercase tracking-widest mb-2">Audience hears</p>
          <div className="grid grid-cols-2 gap-1 max-h-40 overflow-y-auto">
            {LANGUAGES.map((l) => (
              <button key={l.code} onClick={() => setTargetLang(l.code)} disabled={isRunning}
                className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-left transition-all ${targetLang === l.code
                    ? "bg-lens-teal/20 border border-lens-teal/40 text-lens-teal-light"
                    : "border border-transparent hover:bg-lens-muted/40 text-lens-sub disabled:opacity-40"
                  }`}>
                <span style={{ fontSize: "13px" }}>{l.flag}</span>
                <span className="text-xs truncate">{l.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Voice + volume */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-lens-card border border-lens-border rounded-xl p-3">
          <p className="text-lens-sub text-xs uppercase tracking-widest mb-2">Output voice</p>
          <div className="grid grid-cols-3 gap-1.5">
            {VOICES.map((v) => (
              <button key={v.id} onClick={() => setSelectedVoice(v.id)}
                className={`px-2 py-1.5 rounded-lg text-left transition-all ${selectedVoice === v.id
                    ? "bg-lens-teal/20 border border-lens-teal/40 text-lens-teal-light"
                    : "border border-lens-border text-lens-sub hover:border-lens-muted hover:text-lens-text"
                  }`}>
                <p className="text-xs font-medium">{v.label}</p>
                <p className="text-[10px] opacity-70 leading-tight">{v.desc}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-lens-card border border-lens-border rounded-xl p-3 space-y-3">
          <div>
            <div className="flex justify-between mb-1.5">
              <p className="text-lens-text text-xs">Volume</p>
              <span className="text-lens-teal-light text-xs font-mono">{Math.round(volume * 100)}%</span>
            </div>
            <input type="range" min="0.1" max="1" step="0.1" value={volume}
              onChange={(e) => setVolume(Number(e.target.value))} className="w-full" />
          </div>
          <div className="bg-lens-surface border border-lens-border rounded-lg px-3 py-2">
            <p className="text-lens-dim text-xs leading-relaxed">
              Speak in complete sentences. The interpreter fires when you naturally pause. Requires Chrome or Edge.
            </p>
          </div>
        </div>
      </div>

      {/* Live panel */}
      <div className={`bg-lens-card rounded-2xl border transition-all ${status === "listening" ? "border-lens-green/50" :
          status === "processing" ? "border-lens-teal/50" :
            status === "speaking" ? "border-amber-700/50" :
              "border-lens-border"
        }`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-lens-border">
          <span className="text-lens-text text-sm font-medium">Live interpreter</span>
          <div className="flex items-center gap-2">
            {status === "listening" && (
              <span className="flex items-center gap-1.5 text-lens-green text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-lens-green animate-pulse" />
                Listening…
              </span>
            )}
            {status === "processing" && (
              <span className="flex items-center gap-1.5 text-lens-teal text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-lens-teal animate-ping" />
                Translating…
              </span>
            )}
            {status === "speaking" && (
              <span className="flex items-center gap-1.5 text-amber-400 text-xs font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                Speaking…
              </span>
            )}
          </div>
        </div>

        <div className="p-4 min-h-[140px]">
          {!isRunning ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-lens-teal-dim border border-lens-teal/20 flex items-center justify-center mb-3">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="9" y="2" width="6" height="12" rx="3" fill="#7dd3fc" />
                  <path d="M5 12a7 7 0 0 0 14 0" stroke="#7dd3fc" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  <line x1="12" y1="19" x2="12" y2="22" stroke="#7dd3fc" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-lens-sub text-sm">Start interpreting to go live</p>
              <p className="text-lens-dim text-xs mt-1 max-w-xs leading-relaxed">
                Speak naturally in {selectedSource.label}. Your audience hears {selectedTarget.label}.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: "14px" }}>{selectedSource.flag}</span>
                  <span className="text-lens-sub text-xs">{selectedSource.label} (you)</span>
                  {status === "listening" && <WaveBar active={true} />}
                </div>
                <p className="text-lens-text text-sm leading-relaxed min-h-[40px]">
                  {liveOriginal || <span className="text-lens-dim italic text-xs">Waiting for speech…</span>}
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: "14px" }}>{selectedTarget.flag}</span>
                  <span className="text-lens-sub text-xs">{selectedTarget.label} (audience)</span>
                  {status === "speaking" && (
                    <div className="flex items-end gap-0.5 h-5">
                      {[3, 5, 7, 5, 3].map((h, i) => (
                        <div key={i} className="w-0.5 bg-amber-400 rounded-full animate-bounce"
                          style={{ height: `${h}px`, animationDelay: `${i * 80}ms` }} />
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-lens-teal-light text-sm leading-relaxed min-h-[40px] font-medium">
                  {liveTranslation || <span className="text-lens-dim italic text-xs font-normal">Translation will appear here…</span>}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-3">
        {!isRunning ? (
          <button onClick={start}
            className="flex-1 py-3.5 rounded-xl bg-lens-green text-lens-bg font-semibold text-sm hover:bg-emerald-400 transition-colors">
            Start interpreting
          </button>
        ) : (
          <button onClick={stop}
            className="flex-1 py-3.5 rounded-xl bg-lens-muted border border-lens-border text-lens-text font-medium text-sm hover:border-red-800 hover:text-red-400 transition-colors">
            Stop
          </button>
        )}
      </div>

      {error && (
        <div className="text-red-400 text-sm bg-red-950/40 border border-red-900/50 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {segments.length > 0 && (
        <div className="bg-lens-card border border-lens-border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-lens-border flex items-center justify-between">
            <span className="text-lens-text text-sm font-medium">Session transcript</span>
            <button onClick={() => setSegments([])} className="text-lens-sub text-xs hover:text-lens-text transition-colors">Clear</button>
          </div>
          <div ref={feedRef} className="divide-y divide-lens-border max-h-72 overflow-y-auto">
            {segments.map((seg) => (
              <div key={seg.id} className="px-4 py-3 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-lens-dim text-[10px] font-mono mb-1">{seg.time} · {selectedSource.flag}</p>
                  <p className="text-lens-sub text-xs leading-relaxed">{seg.original}</p>
                </div>
                <div>
                  <p className="text-lens-dim text-[10px] font-mono mb-1">{selectedTarget.flag} translation</p>
                  <p className="text-lens-teal-light text-xs leading-relaxed font-medium">{seg.translation}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}