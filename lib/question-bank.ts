import type { createServiceClient } from "@/lib/supabase/service";

export type PublicQuestionRow = { id: string; topic: string; difficulty: string; subtopic: string | null; text: string; options: string[] };

/** Normaliza um enunciado para comparação/hash — mesma normalização usada
 * na migração inicial das 18 questões seed. */
export function normalizeQuestionText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/** Só questões `published` e ativas contam como estoque real — nunca
 * `draft`/`rejected`, mesmo que existam na tabela. */
export function publishedQuestionsQuery(service: ReturnType<typeof createServiceClient>) {
  return service.from("simulado_questions").select("id, topic, difficulty, subtopic, text, options").eq("status", "published").eq("is_active", true);
}

export async function countPublishedByTopic(service: ReturnType<typeof createServiceClient>): Promise<Record<string, number>> {
  const { data } = await service.from("simulado_questions").select("topic").eq("status", "published").eq("is_active", true);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) counts[row.topic] = (counts[row.topic] ?? 0) + 1;
  return counts;
}

export async function countPublishedTotal(service: ReturnType<typeof createServiceClient>): Promise<number> {
  const { count } = await service.from("simulado_questions").select("id", { count: "exact", head: true }).eq("status", "published").eq("is_active", true);
  return count ?? 0;
}
