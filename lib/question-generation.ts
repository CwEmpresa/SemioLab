import { z } from "zod";
import { getOpenAIClient, OPENAI_QUESTION_MODEL, extractUsage, estimateCostUsd, safeErrorMeta } from "@/lib/openai";
import { logAudioUsage, startOfBrasiliaDayUtc } from "@/lib/ai-usage";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeQuestionText } from "@/lib/question-bank";
import { createHash } from "node:crypto";

/** Soma real (não estimativa por lote) do custo de geração de questões já
 * gasto hoje (horário de Brasília) — consultada de novo a cada lote, para
 * o job poder parar assim que o limite diário configurável for atingido. */
export async function getTodayGenerationCostUsd(service: ReturnType<typeof createServiceClient>): Promise<number> {
  const { data } = await service
    .from("ai_usage_logs")
    .select("estimated_cost_usd")
    .eq("operation", "question_generation")
    .gte("created_at", startOfBrasiliaDayUtc());
  return (data ?? []).reduce((sum, row) => sum + (row.estimated_cost_usd ?? 0), 0);
}

const CandidateSchema = z.object({
  topic: z.string().min(2),
  subtopic: z.string().min(2).nullable(),
  difficulty: z.enum(["facil", "medio", "dificil"]),
  text: z.string().min(15),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string().min(15),
  tags: z.array(z.string()).default([]),
});
const CandidateBatchSchema = z.object({ questions: z.array(CandidateSchema) });
export type Candidate = z.infer<typeof CandidateSchema>;

const BANNED_TERMS = ["mg/kg", "mg/dia", " dose ", "posologia", "prescreva", "prescrição"];

function contentHash(text: string): string {
  return createHash("md5").update(normalizeQuestionText(text)).digest("hex");
}

function structuralRejectionReason(q: Candidate): string | null {
  const trimmedOptions = q.options.map((o) => o.trim());
  if (trimmedOptions.some((o) => o.length === 0)) return "alternativa vazia";
  const unique = new Set(trimmedOptions.map((o) => o.toLowerCase()));
  if (unique.size !== trimmedOptions.length) return "alternativas duplicadas";
  const lowerText = q.text.toLowerCase();
  if (BANNED_TERMS.some((term) => lowerText.includes(term))) return "menciona dose/posologia/prescrição, fora do escopo permitido";
  if (q.text.trim().length < 15) return "enunciado incompleto";
  if (q.explanation.trim().length < 15) return "explicação incompleta";
  return null;
}

const CoherenceBatchResultSchema = z.object({
  results: z.array(z.object({ id: z.string(), approved: z.boolean(), reason: z.string() })),
});

/** Valida coerência de até 8 questões em UMA chamada só (era 1 chamada por
 * questão) — mesmo critério de antes, só que em lote. `id` aqui é só o
 * índice temporário desta chamada (string), nunca o id real da questão. */
async function checkCoherenceBatch(
  service: ReturnType<typeof createServiceClient>,
  items: { tempId: string; q: Candidate }[],
): Promise<Map<string, { ok: boolean; reason: string }>> {
  const client = getOpenAIClient();
  const results = new Map<string, { ok: boolean; reason: string }>();
  if (items.length === 0) return results;

  const prompt = [
    "Você audita um LOTE de questões de múltipla escolha de semiologia médica para uso educacional.",
    "Para CADA questão, decida se a alternativa marcada como correta é inequivocamente a única correta, e se a explicação é coerente com o enunciado e essa alternativa.",
    ...items.map(
      ({ tempId, q }) =>
        `--- Questão id="${tempId}" ---\nEnunciado: ${q.text}\nAlternativas: ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join(" | ")}\nAlternativa marcada como correta: ${String.fromCharCode(65 + q.correctIndex)}\nExplicação fornecida: ${q.explanation}`,
    ),
    'Responda APENAS com JSON: {"results":[{"id":string,"approved":true|false,"reason":"motivo curto"}]}, com EXATAMENTE um item por questão do lote, usando o mesmo "id" informado acima.',
  ].join("\n\n");

  try {
    const result = await client.responses.create({
      model: OPENAI_QUESTION_MODEL,
      instructions: "Você é um revisor rigoroso de conteúdo educacional médico. Responda apenas com o JSON pedido, um resultado por questão do lote.",
      input: prompt,
      max_output_tokens: 350 * items.length + 500,
      reasoning: { effort: "minimal" },
      text: { format: { type: "json_object" } },
    });
    const usage = extractUsage(result.usage);
    await logAudioUsage(service, {
      userId: null,
      sessionId: null,
      operation: "question_generation",
      model: OPENAI_QUESTION_MODEL,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      estimatedCostUsd: estimateCostUsd(usage),
    });
    const parsed = CoherenceBatchResultSchema.safeParse(JSON.parse(result.output_text || "{}"));
    if (parsed.success) {
      for (const r of parsed.data.results) results.set(r.id, { ok: r.approved, reason: r.reason });
    } else {
      console.error("[question-generation] resposta de coerência em lote inválida", parsed.error.issues.slice(0, 3));
    }
  } catch (err) {
    console.error("[question-generation] falha na verificação de coerência em lote", safeErrorMeta(err));
  }
  // Segurança: qualquer questão sem entrada válida na resposta (id
  // ausente, JSON malformado, falha de chamada) fica reprovada por
  // padrão — nunca aprova por omissão.
  for (const { tempId } of items) {
    if (!results.has(tempId)) results.set(tempId, { ok: false, reason: "sem resposta de verificação para esta questão no lote" });
  }
  return results;
}

async function generateBatch(
  service: ReturnType<typeof createServiceClient>,
  topic: string,
  difficulty: "facil" | "medio" | "dificil",
  count: number,
): Promise<Candidate[]> {
  const client = getOpenAIClient();
  const prompt = [
    `Gere ${count} questões de múltipla escolha de semiologia médica, em português do Brasil, sobre o tema "${topic}", dificuldade "${difficulty}".`,
    "Foque em: anamnese, sinais e sintomas, exame físico, raciocínio clínico e interpretação inicial de exames.",
    "NUNCA inclua doses, posologia, prescrição de medicamentos, condutas terapêuticas controversas, nem perguntas que dependam de uma data/época específica.",
    "Cada questão precisa ter exatamente 4 alternativas, sendo só UMA inequivocamente correta.",
    'Responda APENAS com JSON no formato: {"questions":[{"topic":string,"subtopic":string|null,"difficulty":"facil"|"medio"|"dificil","text":string,"options":[string,string,string,string],"correctIndex":0-3,"explanation":string,"tags":string[]}]}',
  ].join("\n");

  const result = await client.responses.create({
    model: OPENAI_QUESTION_MODEL,
    instructions: "Você cria questões educacionais de semiologia médica. Responda apenas com o JSON pedido, sem markdown.",
    input: prompt,
    max_output_tokens: 400 * count + 500,
    reasoning: { effort: "minimal" },
    text: { format: { type: "json_object" } },
  });

  const usage = extractUsage(result.usage);
  await logAudioUsage(service, {
    userId: null,
    sessionId: null,
    operation: "question_generation",
    model: OPENAI_QUESTION_MODEL,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedCostUsd: estimateCostUsd(usage),
  });

  const parsed = CandidateBatchSchema.safeParse(JSON.parse(result.output_text || "{}"));
  if (!parsed.success) {
    console.error("[question-generation] lote com formato inválido", parsed.error.issues.slice(0, 3));
    return [];
  }
  return parsed.data.questions;
}

export type GenerationOutcome = { created: number; rejected: number };

export async function generateAndValidateBatch(
  service: ReturnType<typeof createServiceClient>,
  topic: string,
  difficulty: "facil" | "medio" | "dificil",
  count: number,
): Promise<GenerationOutcome> {
  const candidates = await generateBatch(service, topic, difficulty, count);
  let created = 0;
  let rejected = 0;

  // 1ª passada: estrutural + dedup por hash — nunca gasta uma chamada de
  // coerência com o que já pode ser rejeitado sem IA.
  const survivors: { q: Candidate; hash: string; id: string }[] = [];
  for (const q of candidates) {
    const hash = contentHash(q.text);
    const id = `ai_${hash.slice(0, 12)}`;
    const structuralReason = structuralRejectionReason(q);

    if (structuralReason) {
      await service.from("simulado_questions").insert({
        id, topic: q.topic, subtopic: q.subtopic, difficulty: q.difficulty, text: q.text,
        options: q.options, correct_index: q.correctIndex, explanation: q.explanation, tags: q.tags,
        status: "rejected", rejection_reason: structuralReason, content_hash: null,
        source: "ai_generated", question_type: "ambos", is_active: false,
      });
      rejected += 1;
      continue;
    }

    const { data: dup } = await service.from("simulado_questions").select("id").eq("content_hash", hash).maybeSingle();
    if (dup) {
      rejected += 1;
      continue;
    }
    survivors.push({ q, hash, id });
  }

  // 2ª passada: UMA chamada de coerência para todo o lote sobrevivente
  // (era 1 chamada por questão) — mesmo critério, menos chamadas de API.
  const coherenceMap = await checkCoherenceBatch(
    service,
    survivors.map((s, i) => ({ tempId: String(i), q: s.q })),
  );

  for (let i = 0; i < survivors.length; i += 1) {
    const { q, hash, id } = survivors[i];
    const coherence = coherenceMap.get(String(i)) ?? { ok: false, reason: "sem resposta de verificação para esta questão no lote" };

    if (!coherence.ok) {
      await service.from("simulado_questions").insert({
        id, topic: q.topic, subtopic: q.subtopic, difficulty: q.difficulty, text: q.text,
        options: q.options, correct_index: q.correctIndex, explanation: q.explanation, tags: q.tags,
        status: "rejected", rejection_reason: `reprovada na checagem de coerência: ${coherence.reason}`, content_hash: null,
        source: "ai_generated", question_type: "ambos", is_active: false,
      });
      rejected += 1;
      continue;
    }

    const { error: insertError } = await service.from("simulado_questions").insert({
      id, topic: q.topic, subtopic: q.subtopic, difficulty: q.difficulty, text: q.text,
      options: q.options, correct_index: q.correctIndex, explanation: q.explanation, tags: q.tags,
      status: "published", content_hash: hash, source: "ai_generated", question_type: "ambos", is_active: true,
    });
    if (insertError) {
      rejected += 1;
      continue;
    }
    created += 1;
  }

  return { created, rejected };
}
