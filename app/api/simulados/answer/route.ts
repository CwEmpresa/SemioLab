import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthUserId } from "@/lib/auth-fast";

export const dynamic = "force-dynamic";

type LinkedQuestion = { correct_index: number; explanation: string; options: string[]; option_explanations?: Record<string, string> | null };

async function loadLink(service: ReturnType<typeof createServiceClient>, attemptId: string, questionId: string) {
  // `option_explanations` vem de migração opcional: se a coluna não existir,
  // repete a leitura sem ela.
  const withCache = await service
    .from("simulado_attempt_questions")
    .select("id, selected_index, simulado_questions(correct_index, explanation, options, option_explanations)")
    .eq("attempt_id", attemptId)
    .eq("question_id", questionId)
    .maybeSingle();
  if (!withCache.error) return withCache.data;
  const plain = await service
    .from("simulado_attempt_questions")
    .select("id, selected_index, simulado_questions(correct_index, explanation, options)")
    .eq("attempt_id", attemptId)
    .eq("question_id", questionId)
    .maybeSingle();
  return plain.data;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const [userId, body] = await Promise.all([
    getAuthUserId(supabase),
    request.json().catch(() => ({})) as Promise<{ attemptId?: string; questionId?: string; selectedIndex?: number }>,
  ]);
  if (!userId) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });

  const { attemptId, questionId, selectedIndex } = body;
  if (!attemptId || !questionId || typeof selectedIndex !== "number") {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const service = createServiceClient();

  // Tentativa (precisa ser do usuário e estar em andamento) e vínculo da
  // questão com a tentativa são lidos juntos — antes eram duas esperas.
  const [{ data: attempt }, link] = await Promise.all([
    service.from("simulado_attempts").select("id, status").eq("id", attemptId).eq("user_id", userId).maybeSingle(),
    loadLink(service, attemptId, questionId),
  ]);
  if (!attempt || attempt.status !== "in_progress") {
    return Response.json({ error: "Tentativa inválida ou já encerrada.", code: "ATTEMPT_NOT_ACTIVE" }, { status: 404 });
  }
  // A questão precisa realmente pertencer a esta tentativa (foi uma das
  // 10 sorteadas no início) — o cliente não pode marcar questão arbitrária.
  if (!link) return Response.json({ error: "Questão não pertence a esta tentativa.", code: "QUESTION_NOT_IN_ATTEMPT" }, { status: 404 });

  const q = link.simulado_questions as unknown as LinkedQuestion;
  const correctText = q.options[q.correct_index];
  const explanations = q.option_explanations ?? null;

  // Idempotente: se já foi respondida, devolve o resultado já salvo (não
  // permite reenviar para "trocar" a resposta depois de ver o resultado).
  const effectiveIndex = link.selected_index !== null ? link.selected_index : selectedIndex;
  if (link.selected_index === null && (selectedIndex < -1 || selectedIndex >= q.options.length)) {
    return Response.json({ error: "Índice de resposta inválido." }, { status: 400 });
  }
  const correct = effectiveIndex === q.correct_index;
  const selectedText = effectiveIndex >= 0 ? q.options[effectiveIndex] : "";

  if (link.selected_index === null) {
    // Gravada antes de responder (não em segundo plano) para o "Finalizar"
    // logo em seguida nunca contar esta questão como não respondida.
    await service
      .from("simulado_attempt_questions")
      .update({ selected_index: selectedIndex, answered_at: new Date().toISOString() })
      .eq("id", link.id)
      .is("selected_index", null);
  }

  return Response.json({
    correct,
    correctIndex: q.correct_index,
    correctText,
    explanation: q.explanation,
    correctWhy: explanations?.[correctText] ?? null,
    whyWrong: correct ? null : explanations?.[selectedText] ?? null,
    alreadyAnswered: link.selected_index !== null,
  });
}
