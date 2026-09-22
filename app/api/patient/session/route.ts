import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CAKTO_CHECKOUT_URLS } from "@/lib/pro";
import { limitWindowStart, resolveUserAccess } from "@/lib/user-access";
import { MAX_SESSIONS_PER_DAY, MAX_STUDENT_MESSAGES_PER_SESSION } from "@/lib/patient-ai-rules";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });

  const access = await resolveUserAccess(supabase, user.id);

  // Limite aplicado no BACKEND, sempre a partir do usuário autenticado e de
  // dados do Supabase — nunca do frontend/localStorage. Vale o menor entre o
  // teto global de atendimentos e o limite do plano. Pro e trial contam por
  // dia (reinicia à meia-noite de Brasília); o gratuito, nos últimos 7 dias.
  const { consultationWindow } = access.limits;
  const dailyLimit = Math.min(MAX_SESSIONS_PER_DAY, access.limits.consultations);
  const { count: windowCount } = await supabase
    .from("patient_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("started_at", limitWindowStart(consultationWindow));
  const sessionsUsedToday = windowCount ?? 0;

  if (sessionsUsedToday >= dailyLimit) {
    return Response.json(
      {
        error:
          dailyLimit === 0
            ? "O Paciente Virtual é um recurso exclusivo do plano Pro (ou do período de teste). Assine o Pro para começar a atender."
            : consultationWindow === "semana"
              ? "Você já usou a consulta grátis desta semana. No Pro são 3 atendimentos por dia."
              : `Você atingiu o limite diário de ${dailyLimit} atendimentos. O limite reinicia à meia-noite (horário de Brasília).`,
        limitReached: true,
        code: consultationWindow === "semana" ? "WEEKLY_LIMIT_REACHED" : "DAILY_LIMIT_REACHED",
        consultationWindow,
        tier: access.tier,
        trialDaysLeft: access.trialDaysLeft,
        sessionsUsedToday,
        sessionsLimitToday: dailyLimit,
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
    questionsUsed: 0,
    questionsLimit: MAX_STUDENT_MESSAGES_PER_SESSION,
    sessionsUsedToday: sessionsUsedToday + 1,
    sessionsLimitToday: dailyLimit,
    consultationWindow,
  });
}

