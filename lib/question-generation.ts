import { z } from "zod";
import { getOpenAIClient, OPENAI_QUESTION_MODEL, extractUsage, safeErrorMeta } from "@/lib/openai";
import { logAudioUsage } from "@/lib/ai-usage";
import { createServiceClient } from "@/lib/supabase/service";
import { normalizeQuestionText } from "@/lib/question-bank";
import { createHash } from "node:crypto";

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

const CoherenceCheckSchema = z.object({ coherent: z.boolean(), reason: z.string() });

async function checkCoherence(service: ReturnType<typeof createServiceClient>, q: Candidate): Promise<{ ok: boolean; reason: string }> {
  const client = getOpenAIClient();
  const prompt = [
    "Você audita questões de múltipla escolha de semiologia médica para uso educacional.",
    `Enunciado: ${q.text}`,
    `Alternativas: ${q.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join(" | ")}`,
    `Alternativa marcada como correta: ${String.fromCharCode(65 + q.correctIndex)}`,
    `Explicação fornecida: ${q.explanation}`,
    'Responda APENAS com JSON: {"coherent": true|false, "reason": "motivo curto"}.',
    "coherent deve ser true SOMENTE SE: a alternativa marcada é inequivocamente a única correta, e a explicação é coerente com o enunciado e essa alternativa.",
  ].join("\n");

  try {
    const result = await client.responses.create({
      model: OPENAI_QUESTION_MODEL,
      instructions: "Você é um revisor rigoroso de conteúdo educacional médico. Responda apenas com o JSON pedido.",
      input: prompt,
      max_output_tokens: 500,
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
      estimatedCostUsd: 0,
    });
    const parsed = CoherenceCheckSchema.safeParse(JSON.parse(result.output_text || "{}"));
    if (!parsed.success) return { ok: false, reason: "resposta de verificação inválida" };
    return { ok: parsed.data.coherent, reason: parsed.data.reason };
  } catch (err) {
    console.error("[question-generation] falha na verificação de coerência", safeErrorMeta(err));
    return { ok: false, reason: "falha ao verificar coerência" };
  }
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
    estimatedCostUsd: 0,
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

  for (const q of candidates) {
    const hash = contentHash(q.text);
    const structuralReason = structuralRejectionReason(q);
    const id = `ai_${hash.slice(0, 12)}`;

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

    const coherence = await checkCoherence(service, q);
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
