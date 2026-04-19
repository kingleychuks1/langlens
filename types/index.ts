export interface Language {
  code: string;
  label: string;
  voiceCode: string;
  flag: string;
}

export interface TranslationResult {
  translation: string;
  detectedLanguages: string[];
  hasContent: boolean;
}

export interface TranslationEntry {
  id: number;
  originalText: string;        // raw text from screen before translation
  text: string;                // translation in current target language
  summary: string;
  langs: string[];
  time: string;
  thumb?: string;
  translationCache: Record<string, string>; // langCode → translated text
}

export type LensStatus = "idle" | "active" | "processing" | "error";
