# LangLens — Your screen, in your language

> Real-time AI translation of everything on your screen. Any app. Any language. Live.

Built for Global HackTour London 2026 · UCL · AI × Agentic Workflows track.

---

## Setup (2 minutes)

```bash
npm install
cp .env.local.example .env.local
# Add ANTHROPIC_API_KEY
npm run dev
# Open http://localhost:3000 in Chrome
```

**Requires Chrome or Edge** — Firefox does not support `getDisplayMedia()` with screen capture.

---

## What it does

LangLens captures your screen using the browser's native screen sharing API, scans it every few seconds with Claude Vision, and translates any non-target-language text — then displays it live and optionally reads it aloud.

- Works with any app, website, PDF, game, terminal, or UI
- No browser extension needed — runs entirely in a browser tab
- 20 supported languages with voice readout
- Smart change detection — only translates when the screen actually changes
- Full translation history with timestamps

---

## Demo script (pitch day)

**Setup:** Open localhost:3000. Have the hackathon handbook (Chinese sections) open in another window or browser tab.

```
"Right now, roughly 1.5 billion people navigate digital interfaces 
in a language that isn't their first."

"Every tool they use — apps, websites, documents, games — 
assumes they can read the default language. Most can't fully."

"Existing translators make you copy-paste. 
They work on one website at a time.
They don't work in apps, PDFs, or desktop software."

[Click Start LangLens]
[Share the window with the Chinese hackathon document]

"LangLens watches your entire screen. Any window. Any app."

[Watch translation appear in the panel]
[Voice reads it aloud]

"That's the Z.AI workshop document from today's handbook — 
translated live, spoken aloud, without copying a single word."

[Switch to a different window — a Japanese website or Chinese PDF]
[Watch it update automatically]

"Switch windows. It follows you. 
No install. No extension. No copy-paste."

"This is what the invisible AI layer looks like — 
not an app you open, but a capability that's always there."
```

**Closing line:**
*"LangLens is the language layer the internet never had. Any screen, any language, always on."*

---

## Track

AI × Agentic Workflows — Global HackTour London 2026

The track definition: "Break down application silos and enable AI to manage end-to-end digital workflows autonomously."

LangLens is literally a cross-application AI layer. It doesn't live inside any single app — it sits above all of them.

---

## Tech

- `getDisplayMedia()` — browser screen capture, zero install
- Canvas frame capture → JPEG compression → Claude Vision
- `SpeechSynthesisUtterance` — Web Speech API voice output
- Hash-based change detection — avoids redundant API calls
- Next.js 15 App Router, TypeScript, Tailwind CSS
