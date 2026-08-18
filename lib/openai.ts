import OpenAI from "openai";

/** Provedor de IA ativo. O Gemini permanece no código (lib/gemini.ts) mas
 * não é chamado automaticamente: só entra se AI_PROVIDER for definido
 * explicitamente como "gemini". */
export const AI_PROVIDER = process.env.AI_PROVIDER || "openai";
export const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5-mini";

let client: OpenAI | null = null;

/** Cliente OpenAI — server-only. OPENAI_API_KEY nunca é exposta ao browser,
 * a logs ou a respostas da API. */
export function getOpenAIClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY ausente: configuração de servidor incompleta.");
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

/** Preços em USD por 1 milhão de tokens. Ajustáveis por env caso a tabela
 * oficial mude, sem necessidade de novo deploy. */
const PRICE_PER_MILLION = {
  input: Number(process.env.OPENAI_PRICE_INPUT ?? 0.25),
  cachedInput: Number(process.env.OPENAI_PRICE_CACHED_INPUT ?? 0.025),
  output: Number(process.env.OPENAI_PRICE_OUTPUT ?? 2),
};

export type UsageTokens = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

/** Custo estimado em USD. Tokens de input em cache são cobrados à parte,
 * então são descontados do input "fresco" para não contar em dobro. */
export function estimateCostUsd({ inputTokens, cachedInputTokens, outputTokens }: UsageTokens): number {
  const freshInput = Math.max(0, inputTokens - cachedInputTokens);
  const cost =
    (freshInput / 1_000_000) * PRICE_PER_MILLION.input +
    (cachedInputTokens / 1_000_000) * PRICE_PER_MILLION.cachedInput +
    (outputTokens / 1_000_000) * PRICE_PER_MILLION.output;
  return Number(cost.toFixed(8));
}

/** Extrai tokens do objeto usage da Responses API, tolerando ausência de
 * campos opcionais (ex.: quando não há cache hit). */
export function extractUsage(usage: unknown): UsageTokens {
  const u = (usage ?? {}) as {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
  };
  return {
    inputTokens: u.input_tokens ?? 0,
    cachedInputTokens: u.input_tokens_details?.cached_tokens ?? 0,
    outputTokens: u.output_tokens ?? 0,
  };
}

/** 429 (rate limit/cota), 5xx ou timeout/erro de rede justificam fallback.
 * Erro de autenticação (401/403) NUNCA usa fallback. */
export function isRetryableProviderError(err: unknown): boolean {
  const e = err as { status?: number; name?: string; message?: string } | undefined;
  if (e?.status === 401 || e?.status === 403) return false;
  if (e?.status === 429) return true;
  if (typeof e?.status === "number" && e.status >= 500 && e.status < 600) return true;
  if (!e?.status && (e?.name === "AbortError" || /timeout|network|fetch failed|ECONNRESET/i.test(e?.message || ""))) return true;
  return false;
}

/** Metadados seguros de erro para log — nunca inclui a chave nem o payload. */
export function safeErrorMeta(err: unknown) {
  const e = err as { status?: number; code?: string | number; name?: string; message?: string } | undefined;
  return {
    name: e?.name ?? null,
    status: e?.status ?? null,
    code: e?.code ?? null,
    message: (e?.message ?? String(err)).slice(0, 500),
  };
}
