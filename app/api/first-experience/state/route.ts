import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const service = createServiceClient();

  // Checagem rápida e dedicada — nunca espera a /api/learning inteira.
  const [{ data: progress }, quiz, simulado, patient] = await Promise.all([
    service.from("first_experience_progress").select("step, completed_at, xp_awarded").eq("user_id", user.id).maybeSingle(),
    service.from("quiz_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    service.from("simulado_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "completed"),
    service.from("patient_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  if (progress?.completed_at) {
    return Response.json({ eligible: false, completed: true, step: "completed" });
  }

  const hasRealActivity = (quiz.count ?? 0) > 0 || (simulado.count ?? 0) > 0 || (patient.count ?? 0) > 0;
  if (hasRealActivity) {
    // Já ativou por atividade real antes deste recurso existir — nunca
    // mostra o microcaso, nunca concede XP por aqui.
    return Response.json({ eligible: false, completed: true, step: "completed" });
  }

  return Response.json({ eligible: true, completed: false, step: progress?.step ?? "intro" });
}
