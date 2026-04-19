"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LANGUAGES } from "@/lib/languages";
import type { LensStatus } from "@/types";

const VOICES = [
  { id: "nova", label: "Nova", desc: "Warm, friendly female" },
  { id: "alloy", label: "Alloy", desc: "Neutral, clear" },
  { id: "shimmer", label: "Shimmer", desc: "Soft, expressive female" },
  { id: "onyx", label: "Onyx", desc: "Deep, authoritative male" },
  { id: "echo", label: "Echo", desc: "Smooth male" },
  { id: "fable", label: "Fable", desc: "Warm, British male" },
];

interface TranslationEntry {
  id: number;
  originalText: string;
  text: string;
  summary: string;
  langs: string[];
  time: string;
  thumb?: string;
  translationCache: Record<string, string>;
}

function StatusDot({ status }: { status: LensStatus }) {
  if (status === "active") return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-lens-green animate-pulse" />
      <span className="text-lens-green text-xs font-medium">Live</span>
    </span>
  );
  if (status === "processing") return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-lens-teal animate-ping" />
      <span className="text-lens-teal text-xs font-medium">Translating…</span>
    </span>
  );
  if (status === "error") return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-lens-red" />
      <span className="text-red-400 text-xs font-medium">Error</span>
    </span>
  );
  return (
    <span className="flex items-center gap-1.5">
      <span className="w-2 h-2 rounded-full bg-lens-dim" />
      <span className="text-lens-sub text-xs">Idle</span>
    </span>
  );
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="text-[11px] px-2 py-0.5 rounded border border-lens-border text-lens-sub hover:text-lens-text hover:border-lens-muted transition-colors"
    >
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}

export default function LangLens({ embedded = false }: { embedded?: boolean }) {
  const [status, setStatus] = useState<LensStatus>("idle");
  const [targetLang, setTargetLang] = useState("en");
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState("nova");
  const [translations, setTranslations] = useState<TranslationEntry[]>([]);
  const [currentTranslation, setCurrentTranslation] = useState("");
  const [currentSummary, setCurrentSummary] = useState("");
  const [currentThumb, setCurrentThumb] = useState("");
  const [scansCount, setScansCount] = useState(0);
  const [translationsCount, setTranslationsCount] = useState(0);
  const [error, setError] = useState("");
  const [intervalMs, setIntervalMs] = useState(4000);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [speakingId, setSpeakingId] = useState<number | null>(null);
  const [retranslatingId, setRetranslatingId] = useState<number | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const thumbCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPixelHashRef = useRef<string>("");
  const processingRef = useRef(false);
  const translationIdRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<string[]>([]);
  const feedEndRef = useRef<HTMLDivElement | null>(null);

  const selectedLang = LANGUAGES.find((l) => l.code === targetLang) ?? LANGUAGES[0];

  const computePixelHash = (canvas: HTMLCanvasElement): string => {
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width;
    const h = canvas.height;
    const samples: number[] = [];
    const step = Math.floor(Math.min(w, h) / 20);
    for (let x = 0; x < w; x += step) {
      for (let y = 0; y < h; y += step) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        samples.push(d[0], d[1], d[2]);
      }
    }
    return samples.join(",");
  };

  const speakText = useCallback(async (text: string, entryId?: number) => {
    if (!voiceEnabled || !text.trim()) return;
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      if (entryId !== undefined) setSpeakingId(entryId);
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: selectedVoice }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setSpeakingId(null); };
      await audio.play();
    } catch {
      setSpeakingId(null);
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        const utt = new SpeechSynthesisUtterance(text);
        utt.lang = selectedLang.voiceCode;
        window.speechSynthesis.speak(utt);
      }
    }
  }, [voiceEnabled, selectedVoice, selectedLang]);

  const retranslateEntry = useCallback(async (entry: TranslationEntry, langCode: string) => {
    const lang = LANGUAGES.find((l) => l.code === langCode);
    if (!lang) return;

    // Use cache if available — instant playback
    if (entry.translationCache[langCode]) {
      const cached = entry.translationCache[langCode];
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      setSpeakingId(entry.id);
      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cached, voice: selectedVoice }),
        });
        if (!res.ok) throw new Error("TTS failed");
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
        await audio.play();
      } catch {
        setSpeakingId(null);
      }
      return;
    }

    setRetranslatingId(entry.id);
    try {
      const res = await fetch("/api/retranslate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: entry.originalText,
          targetLanguageLabel: lang.label,
          voice: selectedVoice,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const { translation, audioBase64 } = data;

      // Update entry and cache the new translation
      setTranslations((prev) =>
        prev.map((t) =>
          t.id === entry.id
            ? { ...t, translationCache: { ...t.translationCache, [langCode]: translation } }
            : t
        )
      );

      // Play audio
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const audioBytes = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
      const audioBlob = new Blob([audioBytes], { type: "audio/mpeg" });
      const url = URL.createObjectURL(audioBlob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
      setSpeakingId(entry.id);
      audio.play().catch(() => { });

    } catch (err) {
      console.error("Retranslate error:", err);
    } finally {
      setRetranslatingId(null);
    }
  }, [selectedVoice]);

  const captureAndTranslate = useCallback(async () => {
    if (processingRef.current || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video.readyState < 2) return;

    processingRef.current = true;
    setScansCount((s) => s + 1);

    try {
      const W = Math.min(video.videoWidth, 640);
      const H = Math.round(W * (video.videoHeight / video.videoWidth));
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, W, H);

      const pixelHash = computePixelHash(canvas);
      if (pixelHash === lastPixelHashRef.current) {
        processingRef.current = false;
        return;
      }
      lastPixelHashRef.current = pixelHash;

      let thumbDataUrl = "";
      if (thumbCanvasRef.current) {
        const tc = thumbCanvasRef.current;
        tc.width = 240;
        tc.height = Math.round(240 * (H / W));
        tc.getContext("2d")!.drawImage(canvas, 0, 0, tc.width, tc.height);
        thumbDataUrl = tc.toDataURL("image/jpeg", 0.6);
      }

      const imageBase64 = canvas.toDataURL("image/jpeg", 0.35).split(",")[1];
      setStatus("processing");
      setCurrentThumb(thumbDataUrl);

      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          targetLanguage: targetLang,
          targetLanguageLabel: selectedLang.label,
          recentContext: contextRef.current.slice(-3),
        }),
      });

      if (!res.ok) throw new Error("API error");
      const result = await res.json();

      if (result.hasContent && result.translation?.trim()) {
        const text = result.translation.trim();
        const summary = result.summary?.trim() ?? "";
        const originalText = result.detectedText ?? text;

        setCurrentTranslation(text);
        setCurrentSummary(summary);
        setTranslationsCount((c) => c + 1);
        contextRef.current = [...contextRef.current.slice(-4), text];

        const id = ++translationIdRef.current;
        const time = new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit", minute: "2-digit", second: "2-digit",
        });

        setTranslations((prev) => [
          {
            id,
            originalText,
            text,
            summary,
            langs: result.detectedLanguages ?? [],
            time,
            thumb: thumbDataUrl,
            translationCache: { [targetLang]: text },
          },
          ...prev,
        ].slice(0, 30));

        if (result.audioBase64 && voiceEnabled) {
          if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
          const audioBytes = Uint8Array.from(atob(result.audioBase64), (c) => c.charCodeAt(0));
          const audioBlob = new Blob([audioBytes], { type: "audio/mpeg" });
          const url = URL.createObjectURL(audioBlob);
          const audio = new Audio(url);
          audioRef.current = audio;
          audio.onended = () => { setSpeakingId(null); URL.revokeObjectURL(url); };
          setSpeakingId(id);
          audio.play().catch(() => { });
        } else {
          speakText(text, id);
        }
      } else {
        setCurrentTranslation("");
        setCurrentSummary(result.summary ?? "");
      }
      setStatus("active");
    } catch (err) {
      console.error(err);
      setStatus("error");
      setError("Translation failed. Check your API key and try again.");
    } finally {
      processingRef.current = false;
    }
  }, [targetLang, selectedLang, speakText, voiceEnabled]);

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 5, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;

      const video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();
      videoRef.current = video;

      canvasRef.current = document.createElement("canvas");
      thumbCanvasRef.current = document.createElement("canvas");

      stream.getVideoTracks()[0].addEventListener("ended", stop);

      setStatus("active");
      setTranslations([]);
      setScansCount(0);
      setTranslationsCount(0);
      setCurrentTranslation("");
      setCurrentSummary("");
      setCurrentThumb("");
      lastPixelHashRef.current = "";
      contextRef.current = [];

      intervalRef.current = setInterval(captureAndTranslate, intervalMs);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Screen capture failed";
      if (msg.includes("Permission denied") || msg.includes("NotAllowed")) {
        setError("Screen capture permission denied. Click Allow when prompted.");
      } else if (msg.includes("NotSupported")) {
        setError("Screen capture not supported. Use Chrome or Edge.");
      } else if (msg.includes("cancel")) {
        setError("Screen share cancelled. Try again and select a window.");
      } else {
        setError(msg);
      }
    }
  };

  const stop = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    if (videoRef.current) { videoRef.current.srcObject = null; videoRef.current = null; }
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    window.speechSynthesis?.cancel();
    streamRef.current = null;
    processingRef.current = false;
    contextRef.current = [];
    setStatus("idle");
    setCurrentTranslation("");
    setCurrentSummary("");
    setCurrentThumb("");
    setSpeakingId(null);
  }, []);

  useEffect(() => {
    if ((status === "active" || status === "processing") && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = setInterval(captureAndTranslate, intervalMs);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLang, intervalMs]);

  useEffect(() => { return () => { stop(); }; }, [stop]);

  useEffect(() => {
    feedEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [translations.length]);

  const isRunning = status === "active" || status === "processing";

  return (
    <div className={embedded ? "" : "min-h-screen bg-lens-bg text-lens-text"} style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {!embedded && (
        <header className="border-b border-lens-border bg-lens-surface px-6 py-3.5">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-lens-teal-dim border border-lens-teal/30 flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="3.5" stroke="#7dd3fc" strokeWidth="1.5" />
                  <path d="M2 12C2 12 5.5 5 12 5s10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="#7dd3fc" strokeWidth="1.5" fill="none" />
                  <circle cx="12" cy="12" r="1" fill="#7dd3fc" />
                </svg>
              </div>
              <div>
                <span className="text-lens-text font-semibold tracking-tight">LangLens</span>
                <span className="ml-2 text-lens-sub text-xs hidden sm:inline">Your screen, in your language</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {isRunning && (
                <div className="hidden sm:flex items-center gap-4 text-xs text-lens-sub">
                  <span>{scansCount} scans</span>
                  <span className="text-lens-teal-light font-medium">{translationsCount} translated</span>
                </div>
              )}
              <StatusDot status={status} />
            </div>
          </div>
        </header>
      )}

      {embedded && isRunning && (
        <div className="flex items-center gap-4 mb-4 text-xs text-lens-sub">
          <StatusDot status={status} />
          <span>{scansCount} scans</span>
          <span className="text-lens-teal-light font-medium">{translationsCount} translated</span>
        </div>
      )}

      <div className={embedded ? "" : "max-w-5xl mx-auto px-6 py-5"}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* Left: controls */}
          <div className="space-y-4">
            <div className="bg-lens-card border border-lens-border rounded-2xl p-4">
              <p className="text-lens-sub text-xs uppercase tracking-widest mb-3">Translate into</p>
              <div className="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto pr-0.5">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => setTargetLang(lang.code)}
                    className={`flex items-center gap-2 px-2.5 py-1.5 rounded-xl text-left transition-all ${targetLang === lang.code
                      ? "bg-lens-teal/20 border border-lens-teal/40 text-lens-teal-light"
                      : "border border-transparent hover:bg-lens-muted/40 text-lens-sub hover:text-lens-text"
                      }`}
                  >
                    <span style={{ fontSize: "14px", lineHeight: 1 }}>{lang.flag}</span>
                    <span className="text-xs">{lang.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-lens-card border border-lens-border rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-lens-sub text-xs uppercase tracking-widest">Voice</p>
                <button
                  onClick={() => { setVoiceEnabled((v) => !v); audioRef.current?.pause(); }}
                  className={`rounded-full transition-colors relative flex items-center ${voiceEnabled ? "bg-lens-teal" : "bg-lens-muted"}`}
                  style={{ height: "22px", width: "40px" }}
                >
                  <span className={`absolute w-4 h-4 rounded-full bg-white transition-all ${voiceEnabled ? "left-5" : "left-1"}`} />
                </button>
              </div>

              {voiceEnabled && (
                <div>
                  <button
                    onClick={() => setShowVoicePanel((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-lens-surface border border-lens-border rounded-xl hover:border-lens-muted transition-colors"
                  >
                    <div>
                      <p className="text-lens-text text-sm text-left">{VOICES.find((v) => v.id === selectedVoice)?.label}</p>
                      <p className="text-lens-sub text-xs text-left">{VOICES.find((v) => v.id === selectedVoice)?.desc}</p>
                    </div>
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className={`text-lens-dim transition-transform ${showVoicePanel ? "rotate-180" : ""}`}>
                      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                  </button>
                  {showVoicePanel && (
                    <div className="mt-1.5 bg-lens-surface border border-lens-border rounded-xl overflow-hidden">
                      {VOICES.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => { setSelectedVoice(v.id); setShowVoicePanel(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-lens-muted/40 transition-colors border-b border-lens-border last:border-0 ${selectedVoice === v.id ? "text-lens-teal-light" : "text-lens-sub"}`}
                        >
                          <div>
                            <p className="text-sm font-medium">{v.label}</p>
                            <p className="text-xs opacity-70">{v.desc}</p>
                          </div>
                          {selectedVoice === v.id && (
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                              <path d="M3 8l4 4 6-7" stroke="#7dd3fc" strokeWidth="1.5" strokeLinecap="round" />
                            </svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex justify-between mb-1.5">
                  <p className="text-lens-text text-xs">Scan every</p>
                  <span className="text-lens-teal-light text-xs font-mono">{(intervalMs / 1000).toFixed(1)}s</span>
                </div>
                <input type="range" min="2000" max="12000" step="500" value={intervalMs}
                  onChange={(e) => setIntervalMs(Number(e.target.value))} className="w-full" />
                <div className="flex justify-between text-lens-dim text-xs mt-0.5">
                  <span>Faster</span><span>Slower</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              {!isRunning ? (
                <button onClick={start}
                  className="w-full py-3.5 rounded-xl bg-lens-teal text-lens-bg font-semibold text-sm hover:bg-sky-400 transition-colors">
                  Start LangLens
                </button>
              ) : (
                <button onClick={stop}
                  className="w-full py-3.5 rounded-xl bg-lens-muted border border-lens-border text-lens-text font-medium text-sm hover:border-red-800 hover:text-red-400 transition-colors">
                  Stop
                </button>
              )}
              {error && (
                <div className="text-red-400 text-xs bg-red-950/40 border border-red-900/50 rounded-xl px-3 py-2.5 leading-relaxed">
                  {error}
                </div>
              )}
              {!isRunning && (
                <p className="text-lens-dim text-xs text-center leading-relaxed px-2">
                  Chrome will ask which window or screen to share. Choose any window.
                </p>
              )}
            </div>
          </div>

          {/* Right: output */}
          <div className="lg:col-span-2 space-y-4">

            {/* Live view */}
            <div className={`bg-lens-card rounded-2xl border transition-all ${status === "processing" ? "border-lens-teal/60" :
              isRunning ? "border-lens-border" : "border-lens-border opacity-60"
              }`}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-lens-border">
                <div className="flex items-center gap-2.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="3.5" stroke="#7dd3fc" strokeWidth="1.5" />
                    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="#7dd3fc" strokeWidth="1.5" fill="none" />
                  </svg>
                  <span className="text-lens-text text-sm font-medium">Live translation</span>
                  <span className="text-lens-sub text-xs">→ {selectedLang.flag} {selectedLang.label}</span>
                </div>
                {status === "processing" && (
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1.5 h-1.5 rounded-full bg-lens-teal animate-bounce" style={{ animationDelay: `${i * 110}ms` }} />
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-4 p-4 min-h-[160px]">
                {currentThumb && isRunning && (
                  <div className="shrink-0">
                    <img src={currentThumb} alt="Screen preview" className="w-28 rounded-lg border border-lens-border opacity-80" />
                    {currentSummary && (
                      <p className="text-lens-dim text-[10px] mt-1.5 leading-relaxed max-w-[112px]">{currentSummary}</p>
                    )}
                  </div>
                )}

                <div className="flex-1">
                  {!isRunning ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-6">
                      <div className="w-12 h-12 rounded-xl bg-lens-teal-dim border border-lens-teal/20 flex items-center justify-center mx-auto mb-3">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="3.5" stroke="#7dd3fc" strokeWidth="1.5" />
                          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="#7dd3fc" strokeWidth="1.5" fill="none" />
                        </svg>
                      </div>
                      <p className="text-lens-sub text-sm">Start LangLens to begin</p>
                      <p className="text-lens-dim text-xs mt-1">Works with any app, PDF, website, or game</p>
                    </div>
                  ) : currentTranslation ? (
                    <div>
                      <p className="text-lens-text text-base leading-relaxed whitespace-pre-wrap">{currentTranslation}</p>
                      {speakingId === translationIdRef.current && (
                        <div className="flex items-center gap-1.5 mt-3">
                          {[1, 2, 3, 4].map((i) => (
                            <span key={i} className="w-0.5 bg-lens-teal rounded-full animate-bounce"
                              style={{ height: `${8 + i * 3}px`, animationDelay: `${i * 80}ms` }} />
                          ))}
                          <span className="text-lens-teal text-xs ml-1">Speaking…</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-lens-dim text-sm italic mt-2">
                      {status === "processing"
                        ? "Reading screen…"
                        : `Screen is already in ${selectedLang.label}, or no text found.`}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* History with multi-language playback */}
            {translations.length > 0 && (
              <div className="bg-lens-card border border-lens-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-lens-border flex items-center justify-between">
                  <span className="text-lens-text text-sm font-medium">History</span>
                  <button onClick={() => setTranslations([])} className="text-lens-sub text-xs hover:text-lens-text transition-colors">Clear</button>
                </div>
                <div className="divide-y divide-lens-border max-h-96 overflow-y-auto">
                  {translations.map((t) => (
                    <div key={t.id} className="px-4 py-3">
                      {/* Header row */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-lens-dim text-xs font-mono">{t.time}</span>
                        {t.langs.map((l, i) => (
                          <span key={i} className="text-[11px] px-1.5 py-0.5 rounded bg-lens-muted text-lens-sub">{l}</span>
                        ))}
                        <div className="ml-auto flex items-center gap-1.5">
                          {retranslatingId === t.id ? (
                            <span className="text-lens-teal text-[11px] animate-pulse">Translating…</span>
                          ) : speakingId === t.id ? (
                            <span className="text-lens-teal text-[11px]">Speaking…</span>
                          ) : (
                            <CopyBtn text={t.text} />
                          )}
                        </div>
                      </div>

                      {/* Summary + translation */}
                      {t.summary && <p className="text-lens-dim text-xs mb-1 italic">{t.summary}</p>}
                      <p className="text-lens-text text-sm leading-relaxed mb-3">{t.text}</p>

                      {/* Language replay buttons */}
                      <div className="flex flex-wrap gap-1.5 items-center">
                        <span className="text-lens-dim text-[10px] mr-0.5">Replay in:</span>
                        {LANGUAGES.slice(0, 12).map((lang) => {
                          const isCached = !!t.translationCache[lang.code];
                          const isThis = lang.code === targetLang;
                          return (
                            <button
                              key={lang.code}
                              onClick={() => retranslateEntry(t, lang.code)}
                              disabled={retranslatingId === t.id}
                              className={`text-[11px] px-2 py-1 rounded-lg border transition-all disabled:opacity-40 ${isThis
                                ? "border-lens-teal/60 bg-lens-teal/15 text-lens-teal-light"
                                : isCached
                                  ? "border-lens-muted bg-lens-muted/30 text-lens-sub hover:border-lens-teal/40 hover:text-lens-teal-light"
                                  : "border-lens-border text-lens-dim hover:border-lens-muted hover:text-lens-sub"
                                }`}
                              title={isCached ? "Cached — instant playback" : "Translate and play"}
                            >
                              {lang.flag} {lang.label}
                              {isCached && !isThis && <span className="ml-1 text-[9px] opacity-60">✓</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                  <div ref={feedEndRef} />
                </div>
              </div>
            )}

            {/* How it works */}
            {!isRunning && translations.length === 0 && (
              <div className="bg-lens-card border border-lens-border rounded-2xl p-5">
                <p className="text-lens-sub text-xs uppercase tracking-widest mb-4">How it works</p>
                <div className="space-y-4">
                  {[
                    { n: "1", title: "Share any window", desc: "Share a browser tab, PDF, desktop app, game — anything on your screen. Nothing is recorded or stored." },
                    { n: "2", title: "AI reads your screen", desc: "Vision AI scans for text every few seconds. Smart change detection skips frames that haven't changed." },
                    { n: "3", title: "Natural voice reads it to you", desc: "Translations are spoken using OpenAI TTS — not a robotic synthesizer. Choose from 6 natural voices." },
                    { n: "4", title: "Replay in any language", desc: "Every translation in history can be replayed in any of 12 languages — without stopping the live session." },
                  ].map((s) => (
                    <div key={s.n} className="flex gap-3">
                      <span className="w-6 h-6 rounded-full bg-lens-teal-dim border border-lens-teal/30 text-lens-teal-light text-xs font-medium flex items-center justify-center shrink-0 mt-0.5">{s.n}</span>
                      <div>
                        <p className="text-lens-text text-sm font-medium mb-0.5">{s.title}</p>
                        <p className="text-lens-sub text-xs leading-relaxed">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}