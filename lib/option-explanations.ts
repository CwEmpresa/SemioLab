import "server-only";
import { z } from "zod";
import { getOpenAIClient, OPENAI_QUESTION_MODEL, extractUsage, estimateCostUsd, safeErrorMeta } from "@/lib/openai";
import { logAudioUsage } from "@/lib/ai-usage";
import type { createServiceClient } from "@/lib/supabase/service";

type Service = ReturnType<typeof createServiceClient>;

/** Mapa texto-da-alternativa → por que ela está certa/errada. A chave é o
 * TEXTO (não o índice) porque o Quiz rápido embaralha as alternativas. */
export type OptionExplanations = Record<string, string>;

export type QuestionRow = {
  id: string;
  topic: string;
  text: string;
  options: string[];
  correct_index: number;
  explanation: string;
  option_explanations?: OptionExplanations | null;
};

/** A coluna `option_explanations` vem de uma migração opcional. Sem ela o
 * select com a coluna falha — então lê sem, e simplesmente não usa cache. */
export async function loadQuestions(service: Service, ids: string[]): Promise<{ rows: QuestionRow[]; cacheAvailable: boolean }> {
  if (ids.length === 0) return { rows: [], cacheAvailable: true };
  const withCache = await service
    .from("simulado_questions")
    .select("id, topic, text, options, correct_index, explanation, option_explanations")
    .in("id", ids);
  if (!withCache.error) return { rows: (withCache.data ?? []) as QuestionRow[], cacheAvailable: true };
  const plain = await service.from("simulado_questions").select("id, topic, text, options, correct_index, explanation").in("id", ids);
  return { rows: (plain.data ?? []) as QuestionRow[], cacheAvailable: false };
}

const BatchSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      options: z.array(z.object({ letter: z.string(), why: z.string().min(10) })),
    }),
  ),
});

/** Uma única chamada para um lote de questões: para cada alternativa,
 * explica em linguagem didática por que ela está certa ou errada. */
async function generateBatch(service: Service, rows: QuestionRow[]): Promise<Map<string, OptionExplanations>> {
  const out = new Map<string, OptionExplanations>();
  if (rows.length === 0) return out;
  const prompt = [
    "Você é professor de semiologia médica. Para CADA questão abaixo, explique cada alternativa a um estudante de medicina.",
    "- Alternativa CORRETA: por que ela é a certa (mecanismo/achado que a sustenta), em 1 a 2 frases.",
    "- Alternativas ERRADAS: por que ela NÃO responde ao que foi perguntado — o que ela realmente descreve, em que situação estaria certa, e qual detalhe do enunciado a descarta. 1 a 3 frases, sem repetir a explicação da correta.",
    "Português do Brasil, tom de professor, direto e sem rodeios. Não comece com rótulos como \"ERRADA:\" ou \"CORRETA:\" e não use tags.",
    ...rows.map(
      (q) =>
        `--- Questão id="${q.id}" ---\nEnunciado: ${q.text}\n${q.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join("\n")}\nCorreta: ${String.fromCharCode(65 + q.correct_index)}\nComentário oficial: ${q.explanation}`,
    ),
    'Responda APENAS com JSON: {"items":[{"id":string,"options":[{"letter":"A","why":string}, ...]}]} — um item por questão, todas as alternativas.',
  ].join("\n\n");

  try {
    const client = getOpenAIClient();
    const result = await client.responses.create({
      model: OPENAI_QUESTION_MODEL,
      instructions: "Responda apenas com o JSON pedido, sem markdown.",
      input: prompt,
      max_output_tokens: 450 * rows.length + 400,
      reasoning: { effort: "minimal" },
      text: { format: { type: "json_object" } },
    });
    const usage = extractUsage(result.usage);
    void logAudioUsage(service, {
      userId: null,
      sessionId: null,
      operation: "question_generation",
      model: OPENAI_QUESTION_MODEL,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostUsd: estimateCostUsd(usage),
    });
    const parsed = BatchSchema.safeParse(JSON.parse(result.output_text || "{}"));
    if (!parsed.success) return out;
    for (const item of parsed.data.items) {
      const q = rows.find((r) => r.id === item.id);
      if (!q) continue;
      const map: OptionExplanations = {};
      for (const opt of item.options) {
        const index = opt.letter.trim().toUpperCase().charCodeAt(0) - 65;
        if (index >= 0 && index < q.options.length) map[q.options[index]] = opt.why
          .replace(/<\/?[A-Za-z][\w-]*\s*\/?>/g, " ")
          .replace(/^\s*(?:errad[ao]|incorret[ao]|corret[ao]|cert[ao])\s*[:\-–—]\s*/i, "")
          .replace(/\s{2,}/g, " ")
          .trim();
      }
      if (Object.keys(map).length > 0) out.set(q.id, map);
    }
  } catch (err) {
    console.error("[option-explanations] falha ao gerar", safeErrorMeta(err));
  }
  return out;
}

/** Garante explicação por alternativa para as questões pedidas. Usa o que
 * já está salvo; gera só o que falta (em lotes) e grava de volta quando a
 * coluna de cache existe. */
export async function ensureOptionExplanations(
  service: Service,
  ids: string[],
  options: { warmOnly?: boolean } = {},
): Promise<Map<string, OptionExplanations>> {
  const { rows, cacheAvailable } = await loadQuestions(service, ids);
  const result = new Map<string, OptionExplanations>();
  // Pré-aquecimento em segundo plano só vale a pena se der para guardar —
  // sem a coluna de cache, gera apenas sob demanda (quando o aluno erra).
  if (options.warmOnly && !cacheAvailable) return result;
  const missing: QuestionRow[] = [];
  for (const row of rows) {
    if (row.option_explanations && Object.keys(row.option_explanations).length > 0) result.set(row.id, row.option_explanations);
    else missing.push(row);
  }
  const BATCH = 5;
  const batches: QuestionRow[][] = [];
  for (let i = 0; i < missing.length; i += BATCH) batches.push(missing.slice(i, i + BATCH));
  const generated = await Promise.all(batches.map((batch) => generateBatch(service, batch)));
  for (const map of generated) {
    for (const [id, explanations] of map) {
      result.set(id, explanations);
      if (cacheAvailable) {
        await service.from("simulado_questions").update({ option_explanations: explanations }).eq("id", id);
      }
    }
  }
  return result;
}
