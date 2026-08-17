import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CAKTO_CHECKOUT_URLS } from "@/lib/pro";
import { resolveUserAccess } from "@/lib/user-access";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const access = await resolveUserAccess(supabase, user.id);

  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const { count: todayCount } = await supabase
    .from("patient_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("started_at", startOfDay.toISOString());

  if ((todayCount ?? 0) >= access.limits.consultationsPerDay) {
    return Response.json(
      {
        error:
          access.tier === "free"
            ? "Você atingiu o limite diário de 1 atendimento do plano básico. Volte amanhã ou assine o Pro para atendimentos ilimitados."
            : "Você atingiu o limite diário de atendimentos do período de teste.",
        limitReached: true,
        tier: access.tier,
        trialDaysLeft: access.trialDaysLeft,
        checkoutUrls: CAKTO_CHECKOUT_URLS,
      },
      { status: 403 },
    );
  }

  const { data: cases, error: casesError } = await supabase
    .from("patient_cases")
    .select("id, title, specialty, difficulty, opening_line, reception_reason, patient_name, patient_age")
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
    receptionReason: chosen.reception_reason,
    patientName: chosen.patient_name,
    patientAge: chosen.patient_age,
    tier: access.tier,
    trialDaysLeft: access.trialDaysLeft,
    examsAllowed: access.limits.examsPerConsultation,
  });
}

