export type EngineId = "chatgpt" | "google_ai_mode" | "perplexity" | "gemini" | "claude";

export interface EngineInfo {
  id: EngineId;
  label: string;
  /** Which DataForSEO product serves it — shown to staff, useful for support tickets. */
  source: string;
}

export const ENGINES: Record<EngineId, EngineInfo> = {
  chatgpt: { id: "chatgpt", label: "ChatGPT", source: "AI Optimization · LLM Scraper" },
  google_ai_mode: { id: "google_ai_mode", label: "Google AI Mode", source: "SERP · Google AI Mode" },
  perplexity: { id: "perplexity", label: "Perplexity", source: "AI Optimization · LLM Responses" },
  gemini: { id: "gemini", label: "Gemini", source: "AI Optimization · LLM Scraper" },
  claude: { id: "claude", label: "Claude", source: "AI Optimization · LLM Responses" },
};

export const ENGINE_IDS = Object.keys(ENGINES) as EngineId[];

export function isEngine(value: string): value is EngineId {
  return value in ENGINES;
}
