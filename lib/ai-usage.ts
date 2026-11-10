import type { createServiceClient } from "@/lib/supabase/service";
import { estimateCostUsd, type UsageTokens } from "@/lib/openai";

/** Grava o consumo de uma chamada de IA. Só o servidor (service role)
 * escreve nesta tabela — o cliente não tem permissão de INSERT/UPDATE/DELETE.
 * Nunca registra conteúdo de mensagens, ficha clínica ou a chave da API. */
export async function logAiUsage(
  service: ReturnType<typeof createServiceClient>,
  params: {
    userId: string;
    sessionId: string | null;
    operation: "chat" | "evaluation" | "repair";
    provider?: string;
    model: string;
    usage: UsageTokens;
    /** Tempo até a primeira palavra chegar ao estudante (ms, medido no
     * servidor desde a entrada da requisição). */
    ttftMs?: number | null;
    /** Tempo até a resposta inteira terminar (ms). */
    durationMs?: number | null;
  },
) {
  try {
    const base = {
      user_id: params.userId,
      session_id: params.sessionId,
      operation: params.operation,
      provider: params.provider ?? "openai",
      model: params.model,
      input_tokens: params.usage.inputTokens,
      cached_input_tokens: params.usage.cachedInputTokens,
      output_tokens: params.usage.outputTokens,
      reasoning_tokens: params.usage.reasoningTokens,
      estimated_cost_usd: estimateCostUsd(params.usage),
    };
    const hasLatency = params.ttftMs != null || params.durationMs != null;
    if (!hasLatency) {
      await service.from("ai_usage_logs").insert(base);
      return;
    }
    const { error } = await service
      .from("ai_usage_logs")
      .insert({ ...base, ttft_ms: params.ttftMs ?? null, duration_ms: params.durationMs ?? null });
    // Banco ainda sem as colunas de latência (migração 20261110 pendente):
    // o registro de custo nunca pode se perder por causa disso.
    if (error) await service.from("ai_usage_logs").insert(base);
  } catch {
    // Falha ao registrar consumo nunca deve derrubar o atendimento.
    console.error("[ai-usage] falha ao registrar consumo", { operation: params.operation });
  }
}

/** Grava o consumo de uma operação de áudio (transcrição/TTS) — custo já
 * calculado (transcrição usa tokens reais devolvidos pela API; TTS usa
 * estimativa, já que a Speech API não devolve contagem de tokens). */
export async function logAudioUsage(
  service: ReturnType<typeof createServiceClient>,
  params: {
    userId: string | null;
    sessionId: string | null;
    operation: "chat" | "transcription" | "tts" | "question_generation" | "research";
    model: string;
    inputTokens?: number;
    outputTokens?: number;
    estimatedCostUsd: number;
  },
) {
  try {
    await service.from("ai_usage_logs").insert({
      user_id: params.userId,
      session_id: params.sessionId,
      operation: params.operation,
      provider: "openai",
      model: params.model,
      input_tokens: params.inputTokens ?? 0,
      cached_input_tokens: 0,
      output_tokens: params.outputTokens ?? 0,
      reasoning_tokens: 0,
      estimated_cost_usd: params.estimatedCostUsd,
    });
  } catch {
    console.error("[ai-usage] falha ao registrar consumo de áudio", { operation: params.operation });
  }
}

/** Rate limit simples por usuário + operação, usando o próprio log de
 * consumo como fonte (sem tabela nova): conta quantas chamadas dessa
 * operação o usuário fez nos últimos `windowSeconds`. */
export async function isRateLimited(
  service: ReturnType<typeof createServiceClient>,
  params: { userId: string; operation: "chat" | "transcription" | "tts"; maxPerWindow: number; windowSeconds: number; model?: string },
): Promise<boolean> {
  const since = new Date(Date.now() - params.windowSeconds * 1000).toISOString();
  let query = service
    .from("ai_usage_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", params.userId)
    .eq("operation", params.operation)
    .gte("created_at", since);
  if (params.model) query = query.eq("model", params.model);
  const { count } = await query;
  return (count ?? 0) >= params.maxPerWindow;
}

/** Início do dia corrente no horário de Brasília (UTC-3), em ISO UTC.
 * Os limites diários reiniciam à meia-noite de Brasília e não acumulam. */
export function startOfBrasiliaDayUtc(now: Date = new Date()): string {
  const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3
  const brasilia = new Date(now.getTime() - BRASILIA_OFFSET_MS);
  brasilia.setUTCHours(0, 0, 0, 0);
  return new Date(brasilia.getTime() + BRASILIA_OFFSET_MS).toISOString();
}

/** Data (YYYY-MM-DD) do dia civil em horário de Brasília (UTC-3, sem
 * horário de verão) para um instante qualquer. Única fonte de verdade para
 * "que dia é hoje" no streak — nunca o fuso do runtime do servidor (UTC na
 * Vercel) nem o fuso local do navegador do usuário, que nunca são
 * garantidamente iguais. */
export function brasiliaDateKey(date: Date = new Date()): string {
  const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;
  const shifted = new Date(date.getTime() - BRASILIA_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
