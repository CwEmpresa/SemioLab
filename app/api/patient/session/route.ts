import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isProActive, CAKTO_CHECKOUT_URLS } from "@/lib/pro";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const { data: sub } = await supabase.from("subscriptions").select("status").eq("user_id", user.id).maybeSingle();
  if (!isProActive(sub?.status)) {
    return Response.json(
      { error: "Este recurso é exclusivo do plano Pro.", requiresPro: true, checkoutUrls: CAKTO_CHECKOUT_URLS },
      { status: 403 },
    );
  }

  const { data: cases, error: casesError } = await supabase
    .from("patient_cases")
    .select("id, title, specialty, difficulty, opening_line")
    .eq("is_active", true);
  if (casesError || !cases || cases.length === 0) {
    return Response.json({ error: "Nenhum caso clínico disponível no momento." }, { status: 503 });
  }
  const chosen = cases[Math.floor(Math.random() * cases.length)];

  const service = createServiceClient();
  const { data: session, error: sessionError } = await service
    .from("patient_sessions")
    .insert({ user_id: user.id, case_id: chosen.id, status: "active", message_count: 0 })
    .select("id")
    .single();
  if (sessionError || !session) {
    return Response.json({ error: "Não foi possível iniciar o atendimento." }, { status: 500 });
  }

  await service.from("patient_messages").insert({
    session_id: session.id,
    role: "patient",
    content: chosen.opening_line,
  });

  return Response.json({
    sessionId: session.id,
    caseTitle: chosen.title,
    specialty: chosen.specialty,
    difficulty: chosen.difficulty,
    openingLine: chosen.opening_line,
  });
}
