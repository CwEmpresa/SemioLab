import { createClient } from "@/lib/supabase/server";
import { getAuthUserId } from "@/lib/auth-fast";
import { createServiceClient } from "@/lib/supabase/service";
import { CAKTO_CHECKOUT_URLS } from "@/lib/pro";
import { limitWindowStart, resolveUserAccess } from "@/lib/user-access";
import { toCanonicalTopic } from "@/lib/canonical-topics";
import { MAX_SESSIONS_PER_DAY, MAX_STUDENT_MESSAGES_PER_SESSION, adaptToDoctorTitle, parseDoctorTitle } from "@/lib/patient-ai-rules";

export const dynamic = "force-dynamic";

type CaseRow = {
  id: string;
  title: string;
  specialty: string;
  difficulty: string;
  opening_line: string;
  reception_reason: string | null;
  patient_name: string | null;
  patient_age: number | null;
};

/** Escolhe o próximo paciente. Antes era sorteio puro entre todos os casos:
 * o estudante podia receber um caso que já tinha atendido, e a primeira
 * consulta podia cair num caso difícil. Agora:
 *  1. casos já finalizados só voltam quando todos os outros acabaram;
 *  2. nas duas primeiras consultas, só casos fáceis;
 *  3. se o estudante disse o que está vendo na faculdade, esse sistema
 *     tem prioridade (sem excluir os demais quando ele se esgota). */
function pickCase(cases: CaseRow[], past: { case_id: string; status: string }[], studyFocus: string | null): CaseRow {
  const finished = new Set(past.filter((s) => s.status === "finished").map((s) => s.case_id));
  const started = new Set(past.map((s) => s.case_id));
  const random = (list: CaseRow[]) => list[Math.floor(Math.random() * list.length)];
  const narrow = (list: CaseRow[], keep: (c: CaseRow) => boolean) => {
    const kept = list.filter(keep);
    return kept.length ? kept : list;
  };

  let pool = narrow(cases, (c) => !finished.has(c.id));
  pool = narrow(pool, (c) => !started.has(c.id));
  if (finished.size < 2) pool = narrow(pool, (c) => c.difficulty === "facil");
  const focus = toCanonicalTopic(studyFocus);
  if (focus) pool = narrow(pool, (c) => toCanonicalTopic(c.specialty) === focus);
  return random(pool);
}

async function resumeUntouchedSession(service: ReturnType<typeof createServiceClient>, sessionId: string, caseId: string) {
  const [{ data: caseRow }, { data: firstMessage }] = await Promise.all([
    service
      .from("patient_cases")
      .select("title, specialty, difficulty, reception_reason, patient_name, patient_age")
      .eq("id", caseId)
      .maybeSingle(),
    service
      .from("patient_messages")
      .select("content")
      .eq("session_id", sessionId)
      .eq("role", "patient")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);
  if (!caseRow || !firstMessage) return null;
  return {
    sessionId,
    caseTitle: caseRow.title,
    specialty: caseRow.specialty,
    difficulty: caseRow.difficulty,
    openingLine: firstMessage.content,
    receptionReason: caseRow.reception_reason,
    patientName: caseRow.patient_name,
    patientAge: caseRow.patient_age,
  };
}

export async function POST(request: Request) {
  // Como o aluno prefere ser chamado ("doutor"/"doutora") — preferência
  // de exibição escolhida por ele mesmo, não dado sensível.
  const body = (await request.json().catch(() => ({}))) as { doctorTitle?: string };
  const doctorTitle = parseDoctorTitle(body.doctorTitle);
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return Response.json({ error: "Não autenticado", code: "UNAUTHENTICATED" }, { status: 401 });

  const access = await resolveUserAccess(supabase, userId);

  // Limite aplicado no BACKEND, sempre a partir do usuário autenticado e de
  // dados do Supabase — nunca do frontend/localStorage. Vale o menor entre o
  // teto global de atendimentos e o limite do plano. Pro e trial contam por
  // dia (reinicia à meia-noite de Brasília); o gratuito, nos últimos 7 dias.
  const { consultationWindow } = access.limits;
  const dailyLimit = Math.min(MAX_SESSIONS_PER_DAY, access.limits.consultations);
  const service = createServiceClient();
  const { data: windowSessions } = await supabase
    .from("patient_sessions")
    .select("id, case_id, status, message_count, started_at")
    .eq("user_id", userId)
    .gte("started_at", limitWindowStart(consultationWindow))
    .order("started_at", { ascending: false });

  // Consulta aberta e abandonada sem nenhuma pergunta: o estudante ainda
  // não usou nada dela. Em vez de gastar outra vaga do limite (no gratuito
  // é 1 por semana), o mesmo paciente volta a ser chamado.
  const untouched = (windowSessions ?? []).find((s) => s.status === "active" && s.message_count === 0);
  if (untouched) {
    const resumed = await resumeUntouchedSession(service, untouched.id, untouched.case_id);
    if (resumed) {
      return Response.json({
        ...resumed,
        tier: access.tier,
        trialDaysLeft: access.trialDaysLeft,
        examsAllowed: access.limits.examsPerConsultation,
        questionsUsed: 0,
        questionsLimit: MAX_STUDENT_MESSAGES_PER_SESSION,
        sessionsUsedToday: (windowSessions ?? []).length,
        sessionsLimitToday: dailyLimit,
        consultationWindow,
      });
    }
  }
  const sessionsUsedToday = (windowSessions ?? []).length;

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

  const [{ data: cases, error: casesError }, { data: pastSessions }, { data: profile }] = await Promise.all([
    supabase
      .from("patient_cases")
      .select("id, title, specialty, difficulty, opening_line, reception_reason, patient_name, patient_age")
      .eq("is_active", true),
    supabase.from("patient_sessions").select("case_id, status").eq("user_id", userId),
    supabase.from("profiles").select("study_focus").eq("id", userId).maybeSingle(),
  ]);
  if (casesError || !cases || cases.length === 0) {
    return Response.json({ error: "Nenhum caso clínico disponível no momento." }, { status: 503 });
  }
  const chosen = pickCase(cases, pastSessions ?? [], profile?.study_focus ?? null);
  const openingLine = adaptToDoctorTitle(chosen.opening_line, doctorTitle);

  const { data: session, error: sessionError } = await service
    .from("patient_sessions")
    .insert({ user_id: userId, case_id: chosen.id, status: "active", message_count: 0 })
    .select("id")
    .single();
  if (sessionError || !session) {
    return Response.json({ error: "Não foi possível iniciar o atendimento." }, { status: 500 });
  }

  await service.from("patient_messages").insert({
    session_id: session.id,
    role: "patient",
    content: openingLine,
  });

  return Response.json({
    sessionId: session.id,
    caseTitle: chosen.title,
    specialty: chosen.specialty,
    difficulty: chosen.difficulty,
    openingLine,
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

