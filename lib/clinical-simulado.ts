import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getOpenAIClient, OPENAI_MODEL, OPENAI_QUESTION_MODEL, extractUsage, estimateCostUsd, safeErrorMeta } from "@/lib/openai";
import { logAiUsage, logAudioUsage, startOfBrasiliaDayUtc } from "@/lib/ai-usage";
import type { createServiceClient } from "@/lib/supabase/service";
import { SEED_CLINICAL_CASES, normalizeText, type ClinicalCase, type RubricItem } from "@/lib/clinical-cases";

type Service = ReturnType<typeof createServiceClient>;

export const CASES_PER_SIMULADO = 3;
/** Quantos casos vistos guardamos por aluno (nos metadados da conta). */
const MAX_SEEN_HISTORY = 150;
/** Teto global de casos novos gerados por IA por dia (controle de custo). */
const MAX_AI_CASES_PER_DAY = 12;

type CaseRow = {
  id: string;
  topic: string;
  title: string;
  prompt: string;
  asks: string[] | null;
  rubric: RubricItem[];
  model_answer: string;
  explanation: string;
};

/** Casos-base (código) + casos gerados por IA (tabela opcional). Sem a
 * tabela, segue só com os casos-base — nunca quebra. */
export async function loadAllCases(service: Service): Promise<{ cases: ClinicalCase[]; tableAvailable: boolean }> {
  const { data, error } = await service
    .from("clinical_cases")
    .select("id, topic, title, prompt, asks, rubric, model_answer, explanation")
    .eq("is_active", true);
  if (error) return { cases: SEED_CLINICAL_CASES, tableAvailable: false };
  const extra = ((data ?? []) as CaseRow[]).map<ClinicalCase>((row) => ({
    id: row.id,
    topic: row.topic,
    title: row.title,
    prompt: row.prompt,
    asks: row.asks ?? [],
    rubric: row.rubric,
    modelAnswer: row.model_answer,
    explanation: row.explanation,
  }));
  const seedIds = new Set(SEED_CLINICAL_CASES.map((c) => c.id));
  return { cases: [...SEED_CLINICAL_CASES, ...extra.filter((c) => !seedIds.has(c.id))], tableAvailable: true };
}

export async function findCase(service: Service, caseId: string): Promise<ClinicalCase | null> {
  const seed = SEED_CLINICAL_CASES.find((c) => c.id === caseId);
  if (seed) return seed;
  const { cases } = await loadAllCases(service);
  return cases.find((c) => c.id === caseId) ?? null;
}

export function readSeenHistory(metadata: Record<string, unknown> | undefined): string[] {
  const raw = metadata?.clinical_seen;
  return Array.isArray(raw) ? raw.filter((v): v is string => typeof v === "string") : [];
}

export function appendSeen(history: string[], ids: string[]): string[] {
  const next = history.filter((id) => !ids.includes(id));
  next.push(...ids);
  return next.slice(-MAX_SEEN_HISTORY);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/** Sorteia os casos da rodada: primeiro os que o aluno NUNCA viu (aleatório,
 * evitando repetir tema na mesma rodada); se faltarem, completa com os que
 * ele viu há mais tempo. Assim só repete depois de passar por todos. */
export function pickCases(all: ClinicalCase[], seen: string[], count = CASES_PER_SIMULADO): ClinicalCase[] {
  const seenSet = new Set(seen);
  const unseen = shuffle(all.filter((c) => !seenSet.has(c.id)));
  const chosen: ClinicalCase[] = [];
  const usedTopics = new Set<string>();
  for (const c of unseen) {
    if (chosen.length >= count) break;
    if (usedTopics.has(c.topic)) continue;
    chosen.push(c);
    usedTopics.add(c.topic);
  }
  for (const c of unseen) {
    if (chosen.length >= count) break;
    if (!chosen.includes(c)) chosen.push(c);
  }
  if (chosen.length < count) {
    // Já viu todos: reaproveita pela ordem de "visto há mais tempo".
    const byOldest = seen
      .map((id) => all.find((c) => c.id === id))
      .filter((c): c is ClinicalCase => !!c && !chosen.includes(c));
    const pool = byOldest.slice(0, Math.max(count * 3, 6));
    for (const c of shuffle(pool)) {
      if (chosen.length >= count) break;
      chosen.push(c);
    }
  }
  return shuffle(chosen);
}

/* ─── Correção ─────────────────────────────────────────────────────────── */

export type ItemStatus = "ok" | "partial" | "missing";
export type GradedItem = { id: string; label: string; points: number; earned: number; status: ItemStatus; comment: string };
export type CaseGrade = {
  caseId: string;
  score: number;
  items: GradedItem[];
  errors: string[];
  feedback: string;
  modelAnswer: string;
  explanation: string;
  gradedBy: "ai" | "keywords";
};

const ERROR_PENALTY = 10;
const MAX_ERROR_PENALTY = 30;

/** A nota é sempre calculada aqui, a partir dos itens — nunca um número
 * solto vindo do modelo. Item pedido e correto = pontos cheios; parcial =
 * metade; ausente = zero; cada afirmação clinicamente errada desconta. */
function computeScore(items: GradedItem[], errors: string[]): number {
  const earned = items.reduce((sum, item) => sum + item.earned, 0);
  const total = items.reduce((sum, item) => sum + item.points, 0) || 100;
  const base = (earned / total) * 100;
  const penalty = Math.min(MAX_ERROR_PENALTY, errors.length * ERROR_PENALTY);
  return Math.max(0, Math.min(100, Math.round(base - penalty)));
}

function gradeByKeywords(c: ClinicalCase, answer: string): CaseGrade {
  const text = normalizeText(answer);
  const items = c.rubric.map<GradedItem>((item) => {
    const hits = item.keywords.filter((k) => text.includes(normalizeText(k).trim())).length;
    const status: ItemStatus = hits >= 1 ? "ok" : "missing";
    return {
      id: item.id,
      label: item.label,
      points: item.points,
      earned: status === "ok" ? item.points : 0,
      status,
      comment: status === "ok" ? "Contemplado na sua resposta." : "Não encontrei este ponto na sua resposta.",
    };
  });
  return {
    caseId: c.id,
    score: computeScore(items, []),
    items,
    errors: [],
    feedback: "Correção automática simplificada (a correção detalhada estava indisponível agora).",
    modelAnswer: c.modelAnswer,
    explanation: c.explanation,
    gradedBy: "keywords",
  };
}

const AiGradeSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      status: z.enum(["ok", "partial", "missing"]),
      // O que o caso pediu e o estudante NÃO escreveu. Vazio = nada faltou.
      missing: z.string().optional().default(""),
      comment: z.string(),
    }),
  ),
  errors: z.array(z.string()).default([]),
  feedback: z.string().default(""),
});

export async function gradeCase(service: Service, userId: string, c: ClinicalCase, answer: string): Promise<CaseGrade> {
  if (answer.trim().length < 10) {
    const items = c.rubric.map<GradedItem>((item) => ({ id: item.id, label: item.label, points: item.points, earned: 0, status: "missing", comment: "Sem resposta." }));
    return { caseId: c.id, score: 0, items, errors: [], feedback: "O caso ficou sem resposta.", modelAnswer: c.modelAnswer, explanation: c.explanation, gradedBy: "keywords" };
  }

  const prompt = [
    "Você corrige a resposta discursiva de um estudante de medicina a um caso clínico, usando a rubrica abaixo.",
    "REGRAS DE CORREÇÃO (seja justo, como um bom professor):",
    "- Avalie cada item da rubrica: 'ok' se a ideia está presente e correta — aceite sinônimos, siglas, abreviações, ordem diferente, outras palavras e condutas equivalentes válidas. 'partial' SOMENTE se o item pedido ficou claramente incompleto (ex.: pediu exames e citou só um secundário). 'missing' se não aparece.",
    "- Os exemplos entre parênteses na rubrica são ilustrativos: não exija todos. Se o estudante cobriu o essencial do item, é 'ok'.",
    "- NÃO desconte por estilo, por falta de detalhes que o enunciado não pediu, nem por informação EXTRA. Pedir um exame a mais, citar um diagnóstico diferencial a mais ou detalhar além do necessário NUNCA reduz a nota — só uma afirmação clinicamente errada vai para 'errors'.",
    "- Em 'missing' (por item) escreva o que o caso pediu e o estudante NÃO escreveu. Se nada essencial faltou, deixe vazio e o status é 'ok'.",
    "- Em 'errors' liste APENAS afirmações clinicamente erradas ou perigosas que o estudante escreveu (ex.: conduta contraindicada). Se não houver, lista vazia.",
    "- Em 'comment' (por item) diga em 1 frase o que ele acertou ou o que faltou.",
    "- Em 'feedback' escreva 2 a 3 frases de devolutiva direta e encorajadora, em português do Brasil.",
    "",
    `CASO: ${c.prompt}`,
    "",
    "RUBRICA:",
    ...c.rubric.map((item) => `- id="${item.id}" (${item.points} pts): ${item.label}`),
    "",
    `RESPOSTA ESPERADA (referência): ${c.modelAnswer}`,
    "",
    `RESPOSTA DO ESTUDANTE: """${answer.slice(0, 4000)}"""`,
    "",
    'Responda APENAS com JSON: {"items":[{"id":string,"status":"ok"|"partial"|"missing","missing":string,"comment":string}],"errors":[string],"feedback":string}',
  ].join("\n");

  try {
    const client = getOpenAIClient();
    const result = await client.responses.create({
      model: OPENAI_MODEL,
      instructions: "Você é um avaliador justo de raciocínio clínico. Responda apenas com o JSON pedido.",
      input: prompt,
      max_output_tokens: 1200,
      reasoning: { effort: "minimal" },
      text: { format: { type: "json_object" } },
    });
    void logAiUsage(service, { userId, sessionId: null, operation: "evaluation", model: OPENAI_MODEL, usage: extractUsage(result.usage) });
    const parsed = AiGradeSchema.safeParse(JSON.parse(result.output_text || "{}"));
    if (!parsed.success) return gradeByKeywords(c, answer);
    const byId = new Map(parsed.data.items.map((item) => [item.id, item]));
    const items = c.rubric.map<GradedItem>((item) => {
      const graded = byId.get(item.id);
      let status: ItemStatus = graded?.status ?? "missing";
      // Só perde ponto o que faltou: "parcial" sem nada faltando (ex.: o
      // estudante só acrescentou um exame a mais) conta como completo.
      if (status === "partial" && !graded?.missing?.trim()) status = "ok";
      return {
        id: item.id,
        label: item.label,
        points: item.points,
        earned: status === "ok" ? item.points : status === "partial" ? Math.round(item.points / 2) : 0,
        status,
        comment: graded?.comment ?? "",
      };
    });
    const errors = parsed.data.errors.map((e) => e.trim()).filter(Boolean).slice(0, 5);
    return {
      caseId: c.id,
      score: computeScore(items, errors),
      items,
      errors,
      feedback: parsed.data.feedback,
      modelAnswer: c.modelAnswer,
      explanation: c.explanation,
      gradedBy: "ai",
    };
  } catch (err) {
    console.error("[clinical/grade] falha na correção por IA", safeErrorMeta(err));
    return gradeByKeywords(c, answer);
  }
}

/* ─── Geração de casos novos ───────────────────────────────────────────── */

const GeneratedCaseSchema = z.object({
  topic: z.string().min(3),
  title: z.string().min(5),
  prompt: z.string().min(80),
  asks: z.array(z.string()).min(2).max(5),
  rubric: z
    .array(z.object({ id: z.string().min(1), label: z.string().min(5), points: z.number().positive(), keywords: z.array(z.string()).min(1) }))
    .min(2)
    .max(5),
  modelAnswer: z.string().min(60),
  explanation: z.string().min(40),
});
const GeneratedBatchSchema = z.object({ cases: z.array(GeneratedCaseSchema) });

/** Gera casos novos (sem repetir títulos existentes) e guarda na tabela
 * opcional. Roda em segundo plano, quando um aluno está perto de esgotar os
 * casos inéditos. Respeita um teto diário global de custo. */
export async function generateNewCases(service: Service, existing: ClinicalCase[], count = 3): Promise<number> {
  const { count: createdToday } = await service
    .from("clinical_cases")
    .select("id", { count: "exact", head: true })
    .gte("created_at", startOfBrasiliaDayUtc());
  if ((createdToday ?? 0) >= MAX_AI_CASES_PER_DAY) return 0;

  const topics = ["Cardiovascular", "Respiratório", "Neurológico", "Abdome", "Endócrino", "Renal", "Infectologia", "Hematologia", "Reumatologia"];
  const prompt = [
    `Crie ${count} casos clínicos NOVOS e realistas para um simulado discursivo de estudantes de medicina, em português do Brasil.`,
    `Varie entre estes sistemas: ${topics.join(", ")}.`,
    "Pode criar variações de doenças comuns já existentes (outro paciente, outra apresentação, outro desafio clínico), mas NUNCA repita um destes títulos/cenários:",
    existing.map((c) => `- ${c.title} (${c.topic})`).join("\n"),
    "",
    "Cada caso: enunciado com idade, sexo, queixa, tempo de evolução, sinais vitais e achados de exame relevantes, terminando com o que o aluno deve escrever (ex.: hipótese, exames, conduta).",
    "`asks`: a lista exata do que o enunciado pede. `rubric`: um item por coisa pedida, `points` somando 100, `label` com a resposta esperada daquele item, `keywords`: termos curtos sem acento que indicam o item (plano B de correção).",
    "Nunca inclua doses exatas como exigência de pontuação. Conteúdo educacional, sem nomes de pessoas reais.",
    'Responda APENAS com JSON: {"cases":[{"topic":string,"title":string,"prompt":string,"asks":[string],"rubric":[{"id":string,"label":string,"points":number,"keywords":[string]}],"modelAnswer":string,"explanation":string}]}',
  ].join("\n");

  try {
    const client = getOpenAIClient();
    const result = await client.responses.create({
      model: OPENAI_QUESTION_MODEL,
      instructions: "Você é professor de clínica médica e cria casos educacionais. Responda apenas com o JSON pedido.",
      input: prompt,
      max_output_tokens: 1400 * count + 600,
      reasoning: { effort: "low" },
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
    const parsed = GeneratedBatchSchema.safeParse(JSON.parse(result.output_text || "{}"));
    if (!parsed.success) return 0;
    const existingTitles = new Set(existing.map((c) => normalizeText(c.title).trim()));
    const rows = parsed.data.cases
      .filter((c) => !existingTitles.has(normalizeText(c.title).trim()))
      .map((c) => {
        const total = c.rubric.reduce((sum, item) => sum + item.points, 0);
        const rubric = c.rubric.map((item) => ({ ...item, points: Math.round((item.points / total) * 100) }));
        const id = `ai-${createHash("md5").update(normalizeText(c.prompt)).digest("hex").slice(0, 12)}`;
        return {
          id,
          topic: c.topic,
          title: c.title,
          prompt: c.prompt,
          asks: c.asks,
          rubric,
          model_answer: c.modelAnswer,
          explanation: c.explanation,
          source: "ai",
        };
      });
    if (rows.length === 0) return 0;
    const { error } = await service.from("clinical_cases").upsert(rows, { onConflict: "id", ignoreDuplicates: true });
    if (error) {
      console.error("[clinical/generate] falha ao salvar casos", error.message);
      return 0;
    }
    return rows.length;
  } catch (err) {
    console.error("[clinical/generate] falha ao gerar casos", safeErrorMeta(err));
    return 0;
  }
}
