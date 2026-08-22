import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { attemptId?: string };
  const attemptId = body.attemptId;
  if (!attemptId) return Response.json({ error: "Dados inválidos." }, { status: 400 });

  const service = createServiceClient();

  // Trava atômica: só quem conseguir mudar in_progress -> completed segue
  // em frente — bloqueia finalização duplicada/corrida.
  const { data: claimed } = await service
    .from("simulado_attempts")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .eq("status", "in_progress")
    .select("id")
    .maybeSingle();
  if (!claimed) {
    return Response.json({ error: "Tentativa inválida, já encerrada ou de outro usuário.", code: "ATTEMPT_NOT_ACTIVE" }, { status: 404 });
  }

  const { data: rows } = await service
    .from("simulado_attempt_questions")
    .select("selected_index, simulado_questions(correct_index)")
    .eq("attempt_id", attemptId);

  const total = rows?.length ?? 0;
  const correct = (rows ?? []).filter((r) => {
    const q = r.simulado_questions as unknown as { correct_index: number };
    return r.selected_index !== null && r.selected_index === q.correct_index;
  }).length;
  const score = total > 0 ? Math.round((correct / total) * 100) : 0;

  await service.from("simulado_attempts").update({ score }).eq("id", attemptId);

  return Response.json({ attemptId, total, correct, score });
}
