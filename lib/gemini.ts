import { GoogleGenAI } from "@google/genai";

export const GEMINI_MODEL = "gemini-3.5-flash";

let client: GoogleGenAI | null = null;

/** Cliente Gemini — server-only. GEMINI_API_KEY nunca é exposta ao browser. */
export function getGeminiClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY ausente: configuração de servidor incompleta.");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}
