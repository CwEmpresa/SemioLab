import { extractUsage, type UsageTokens } from "@/lib/openai";

export const ZERO_USAGE: UsageTokens = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0 };

export type StreamFinishReason = "completed" | "incomplete" | "failed" | "error" | "refusal" | "empty";

export type ConsumedStream = {
  text: string;
  usage: UsageTokens;
  finishReason: StreamFinishReason;
  incompleteReason: string | null;
};

/**
 * Consome os eventos de um stream da Responses API tratando explicitamente
 * todo o ciclo de vida relevante:
 * - response.output_text.delta (texto incremental)
 * - response.output_text.done (fallback com o texto final consolidado)
 * - response.completed (uso de tokens)
 * - response.incomplete + incomplete_details.reason (ex.: max_output_tokens)
 * - response.failed
 * - error
 * - refusal (item de conteúdo do tipo "refusal")
 *
 * Extraído como função pura (recebe o stream já criado) para poder ser
 * testado com um async iterable falso, sem chamar a API real.
 */
export async function consumeResponseStream(
  stream: AsyncIterable<unknown>,
  onDelta: (text: string) => void,
): Promise<ConsumedStream> {
  let text = "";
  let usage: UsageTokens = ZERO_USAGE;
  let finishReason: StreamFinishReason = "empty";
  let incompleteReason: string | null = null;

  for await (const rawEvent of stream) {
    const event = rawEvent as {
      type: string;
      delta?: string;
      text?: string;
      response?: { usage?: unknown; incomplete_details?: { reason?: string } };
      item?: { type?: string; content?: { type?: string }[] };
    };
    switch (event.type) {
      case "response.output_text.delta": {
        const delta = event.delta ?? "";
        if (delta) {
          text += delta;
          onDelta(delta);
        }
        break;
      }
      case "response.output_text.done": {
        // Fallback: se por algum motivo os deltas não chegaram (ou vieram
        // incompletos), o texto final consolidado aqui garante que nada se
        // perca — mas nunca duplica o que os deltas já enviaram.
        const finalText = event.text ?? "";
        if (finalText && finalText.length > text.length) {
          onDelta(finalText.slice(text.length));
          text = finalText;
        }
        break;
      }
      case "response.completed": {
        usage = extractUsage(event.response?.usage);
        finishReason = "completed";
        break;
      }
      case "response.incomplete": {
        usage = extractUsage(event.response?.usage);
        incompleteReason = event.response?.incomplete_details?.reason ?? null;
        finishReason = "incomplete";
        break;
      }
      case "response.failed": {
        usage = extractUsage(event.response?.usage);
        finishReason = "failed";
        break;
      }
      case "error": {
        finishReason = "error";
        break;
      }
      default: {
        // Eventos de refusal chegam tipados como response.output_item.done
        // com item.type === "refusal" (ou content parts do tipo "refusal").
        const maybeItem = event.item;
        if (maybeItem?.type === "refusal" || maybeItem?.content?.some((c) => c.type === "refusal")) {
          finishReason = "refusal";
        }
        break;
      }
    }
  }

  if (finishReason === "empty" && text.trim().length > 0) finishReason = "completed";
  return { text, usage, finishReason, incompleteReason };
}

/** Decide se vale a pena 1 nova tentativa: resposta cortada por limite de
 * tokens, ou terminou sem nenhum texto visível. */
export function shouldRetry(result: ConsumedStream): boolean {
  return result.finishReason === "incomplete" || (result.finishReason !== "completed" && result.text.trim().length === 0);
}
