import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { attemptId?: string; questionId?: string; selectedIndex?: number };
  const { attemptId, questionId, selectedIndex } = body;
  if (!attemptId || !questionId || typeof selectedIndex !== "number") {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const service = createServiceClient();

  // A tentativa precisa pertencer ao usuário autenticado e estar em
  // andamento — nunca confia em nada que o cliente diga sobre isso.
  const { data: attempt } = await service
    .from("simulado_attempts")
    .select("id, status")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!attempt || attempt.status !== "in_progress") {
    return Response.json({ error: "Tentativa inválida ou já encerrada.", code: "ATTEMPT_NOT_ACTIVE" }, { status: 404 });
  }

  // A questão precisa realmente pertencer a esta tentativa (foi uma das
  // 10 sorteadas no início) — o cliente não pode marcar questão arbitrária.
  const { data: link } = await service
    .from("simulado_attempt_questions")
    .select("id, selected_index, simulado_questions(correct_index, explanation, options)")
    .eq("attempt_id", attemptId)
    .eq("question_id", questionId)
    .maybeSingle();
  if (!link) return Response.json({ error: "Questão não pertence a esta tentativa.", code: "QUESTION_NOT_IN_ATTEMPT" }, { status: 404 });

  const q = link.simulado_questions as unknown as { correct_index: number; explanation: string; options: string[] };

  // Idempotente: se já foi respondida, devolve o resultado já salvo (não
  // permite reenviar para "trocar" a resposta depois de ver o resultado).
  if (link.selected_index !== null) {
    return Response.json({ correct: link.selected_index === q.correct_index, correctIndex: q.correct_index, explanation: q.explanation, alreadyAnswered: true });
  }

  if (selectedIndex < -1 || selectedIndex >= q.options.length) {
    return Response.json({ error: "Índice de resposta inválido." }, { status: 400 });
  }

  await service
    .from("simulado_attempt_questions")
    .update({ selected_index: selectedIndex, answered_at: new Date().toISOString() })
    .eq("id", link.id);

  return Response.json({ correct: selectedIndex === q.correct_index, correctIndex: q.correct_index, explanation: q.explanation, alreadyAnswered: false });
}
