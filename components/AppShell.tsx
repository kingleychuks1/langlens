"use client";

import { useState } from "react";
import LangLens from "./LangLens";
import LiveInterpreter from "./LiveInterpreter";

type Mode = "screen" | "interpreter";

export default function AppShell() {
  const [mode, setMode] = useState<Mode>("screen");

  return (
    <div className="min-h-screen bg-lens-bg text-lens-text" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Header */}
      <header className="border-b border-lens-border bg-lens-surface px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-lens-teal-dim border border-lens-teal/30 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3.5" stroke="#7dd3fc" strokeWidth="1.5"/>
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="#7dd3fc" strokeWidth="1.5" fill="none"/>
                <circle cx="12" cy="12" r="1" fill="#7dd3fc"/>
              </svg>
            </div>
            <div>
              <span className="text-lens-text font-semibold tracking-tight">LangLens</span>
              <span className="ml-2 text-lens-sub text-xs hidden sm:inline">Your screen, in your language</span>
            </div>
          </div>

          {/* Mode tabs */}
          <div className="flex bg-lens-card border border-lens-border rounded-xl p-0.5 gap-0.5">
            <button
              onClick={() => setMode("screen")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mode === "screen"
                  ? "bg-lens-teal-dim border border-lens-teal/30 text-lens-teal-light"
                  : "text-lens-sub hover:text-lens-text"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Screen
            </button>
            <button
              onClick={() => setMode("interpreter")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                mode === "interpreter"
                  ? "bg-emerald-950 border border-emerald-800/40 text-emerald-400"
                  : "text-lens-sub hover:text-lens-text"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <rect x="9" y="2" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M5 12a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                <line x1="12" y1="19" x2="12" y2="22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              Interpreter
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/50 font-medium">New</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mode description bar */}
      <div className="border-b border-lens-border bg-lens-surface/50 px-6 py-2">
        <div className="max-w-5xl mx-auto">
          {mode === "screen" ? (
            <p className="text-lens-sub text-xs">
              Share your screen — LangLens reads and translates everything visible, in real time.
            </p>
          ) : (
            <p className="text-lens-sub text-xs">
              Speak in your language — your audience hears it instantly in theirs. Live conference interpretation powered by AI.
            </p>
          )}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-5">
        {mode === "screen" ? <LangLens embedded /> : <LiveInterpreter />}
      </main>
    </div>
  );
}
