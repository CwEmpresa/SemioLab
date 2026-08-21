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
  },
) {
  try {
    await service.from("ai_usage_logs").insert({
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
    });
  } catch {
    // Falha ao registrar consumo nunca deve derrubar o atendimento.
    console.error("[ai-usage] falha ao registrar consumo", { operation: params.operation });
  }
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
