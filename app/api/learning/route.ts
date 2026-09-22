import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { CAKTO_CHECKOUT_URLS, isProActive } from "@/lib/pro";
import { resolveUserAccess } from "@/lib/user-access";
import { brasiliaDateKey } from "@/lib/ai-usage";
import { CANONICAL_TOPICS, toCanonicalTopic, type CanonicalTopic } from "@/lib/canonical-topics";

export const dynamic = "force-dynamic";

type TopicResult = { topic: string; total: number; correct: number };
type QuizAttemptRow = { topic_results: unknown; created_at: string | null };
type PatientAttemptRow = { topic?: string | null; score?: number | null; created_at: string | null };
type SimuladoAnsweredRow = {
  selected_index: number | null;
  simulado_attempts: { completed_at: string | null } | { completed_at: string | null }[] | null;
  simulado_questions: { topic: string; correct_index: number } | null;
};
type MissionTask = {
  id: string;
  title: string;
  detail: string;
  progress: number;
  target: number;
  done: boolean;
  action: { type: "quiz"; topic: string; amount: number } | { type: "screen"; screen: "patient" };
};

/** Mínimo de evidências por tema antes de exibir uma porcentagem. */
const MIN_EVIDENCE = 5;

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

/** Domínio por tema: Quiz 30% + Simulado 30% + Paciente IA 40%. Pesos
 * redistribuídos proporcionalmente entre as fontes disponíveis quando alguma
 * não tem dado para aquele tema; menos de 5 evidências no total (perguntas
 * de quiz+simulado + consultas) = "Dados insuficientes", nunca classificado
 * como desempenho ruim. */
function computeMastery(attempts: QuizAttemptRow[], simuladoRows: SimuladoAnsweredRow[], patientAttempts: PatientAttemptRow[]) {
  type TopicAgg = { quizCorrect: number; quizTotal: number; simCorrect: number; simTotal: number; patientSum: number; patientCount: number };
  const byTopic: Record<CanonicalTopic, TopicAgg> = Object.fromEntries(
    CANONICAL_TOPICS.map((t) => [t, { quizCorrect: 0, quizTotal: 0, simCorrect: 0, simTotal: 0, patientSum: 0, patientCount: 0 }]),
  ) as Record<CanonicalTopic, TopicAgg>;

  for (const attempt of attempts) {
    for (const tr of (attempt.topic_results as TopicResult[] | null) ?? []) {
      const canonical = toCanonicalTopic(tr.topic);
      if (!canonical) continue;
      byTopic[canonical].quizTotal += tr.total || 0;
      byTopic[canonical].quizCorrect += tr.correct || 0;
    }
  }
  for (const row of simuladoRows) {
    const q = row.simulado_questions;
    const canonical = toCanonicalTopic(q?.topic);
    if (!canonical || !q) continue;
    byTopic[canonical].simTotal += 1;
    if (row.selected_index === q.correct_index) byTopic[canonical].simCorrect += 1;
  }
  for (const attempt of patientAttempts) {
    const canonical = toCanonicalTopic(attempt.topic);
    if (!canonical) continue;
    byTopic[canonical].patientSum += attempt.score || 0;
    byTopic[canonical].patientCount += 1;
  }

  return CANONICAL_TOPICS.map((topic) => {
    const agg = byTopic[topic];
    const quizPct = agg.quizTotal > 0 ? (agg.quizCorrect / agg.quizTotal) * 100 : null;
    const simPct = agg.simTotal > 0 ? (agg.simCorrect / agg.simTotal) * 100 : null;
    const patientPct = agg.patientCount > 0 ? agg.patientSum / agg.patientCount : null;

    const weighted: { pct: number; weight: number }[] = [];
    if (quizPct !== null) weighted.push({ pct: quizPct, weight: 0.3 });
    if (simPct !== null) weighted.push({ pct: simPct, weight: 0.3 });
    if (patientPct !== null) weighted.push({ pct: patientPct, weight: 0.4 });
    const weightSum = weighted.reduce((s, w) => s + w.weight, 0);
    const score = weightSum > 0 ? Math.round(weighted.reduce((s, w) => s + w.pct * w.weight, 0) / weightSum) : null;

    const evidenceCount = agg.quizTotal + agg.simTotal + agg.patientCount;
    const insufficientData = evidenceCount < MIN_EVIDENCE;
    const status =
      insufficientData || score === null
        ? "Dados insuficientes"
        : score >= 75
          ? "Domínio"
          : score >= 50
            ? "Em evolução"
            : "Precisa melhorar";

    return {
      topic,
      score: insufficientData ? null : score,
      status,
      insufficientData,
      evidenceCount,
      evidenceTarget: MIN_EVIDENCE,
      questions: agg.quizTotal,
      consultations: agg.patientCount,
      sources: [agg.quizTotal > 0 ? "quiz" : null, agg.simTotal > 0 ? "simulado" : null, agg.patientCount > 0 ? "patient" : null].filter(Boolean) as string[],
    };
  });
}

/** Tema de foco do dia: o pior tema já medido (abaixo de domínio); senão o
 * que está mais perto de ser medido; senão um rodízio diário entre os temas
 * ainda não praticados; por fim, o tema medido com menor nota. */
function pickFocusTopic(mastery: ReturnType<typeof computeMastery>, todayKey: string): CanonicalTopic {
  const measured = mastery.filter((m) => m.score !== null).sort((a, b) => (a.score ?? 0) - (b.score ?? 0));
  if (measured.length && (measured[0].score ?? 0) < 75) return measured[0].topic;
  const calibrating = mastery.filter((m) => m.insufficientData && m.evidenceCount > 0).sort((a, b) => b.evidenceCount - a.evidenceCount);
  if (calibrating.length) return calibrating[0].topic;
  const untouched = mastery.filter((m) => m.evidenceCount === 0);
  if (untouched.length) {
    const dayNumber = Math.floor(new Date(todayKey + "T12:00:00Z").getTime() / 86_400_000);
    return untouched[dayNumber % untouched.length].topic;
  }
  return measured[0]?.topic ?? CANONICAL_TOPICS[0];
}

function unauthorized() {
  return Response.json({ error: "Não autenticado" }, { status: 401 });
}

async function getProStatus(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const [{ data }, access] = await Promise.all([
    supabase.from("subscriptions").select("plan, status, next_payment_date, canceled_at").eq("user_id", userId).maybeSingle(),
    resolveUserAccess(supabase, userId),
  ]);
  return {
    plan: data?.plan ?? "unknown",
    status: data?.status ?? "none",
    active: isProActive(data?.status),
    nextPaymentDate: data?.next_payment_date ?? null,
    canceledAt: data?.canceled_at ?? null,
    checkoutUrls: CAKTO_CHECKOUT_URLS,
    tier: access.tier,
    trialDaysLeft: access.trialDaysLeft,
    limits: access.limits,
  };
}

/** Streak = dias CONSECUTIVOS até hoje (ou até ontem, se hoje ainda não
 * tiver sido registrado), sempre no calendário de Brasília — a mesma fonte
 * de verdade usada para gravar cada dia em login_days. Nunca usa o fuso do
 * runtime do servidor (UTC na Vercel) nem o do navegador do usuário. */
function computeCurrentStreak(loginDays: string[]): number {
  const set = new Set(loginDays);
  const cursor = new Date();
  let streak = 0;
  for (;;) {
    const key = brasiliaDateKey(cursor);
    if (!set.has(key)) break;
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

/** Chaves de data (seg..dom) da semana atual no calendário de Brasília. */
function currentWeekKeys(): string[] {
  const todayKey = brasiliaDateKey();
  const monday = new Date(todayKey + "T12:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

/** Chaves de data dos últimos `count` dias (hoje incluso, o mais antigo
 * primeiro), no calendário de Brasília. */
function lastDaysKeys(count: number): string[] {
  const today = new Date(brasiliaDateKey() + "T12:00:00Z");
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - (count - 1 - i));
    return d.toISOString().slice(0, 10);
  });
}

/** Conta atividades (quiz, simulados e atendimentos) por dia da semana atual
 * (seg..dom, calendário de Brasília), a partir de timestamps reais — nunca
 * um gráfico de exemplo fixo. */
function computeWeeklyActivity(dates: string[]): number[] {
  const counts = [0, 0, 0, 0, 0, 0, 0];
  const weekKeys = currentWeekKeys();

  for (const iso of dates) {
    const key = brasiliaDateKey(new Date(iso));
    const index = weekKeys.indexOf(key);
    if (index !== -1) counts[index] += 1;
  }
  return counts;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const [profileRes, rankingRes, attemptsRes, errorsRes, topicsRes, loginDaysRes, patientAttemptsRes, consultSessionsRes, pro] = await Promise.all([
    supabase.from("profiles").select("name, email, xp").eq("id", user.id).single(),
    supabase.rpc("ranking"),
    supabase.from("quiz_attempts").select("id, topic, total, correct, topic_results, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("error_notebook").select("id, question_id, topic, question, selected_answer, correct_answer, explanation, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("topic_activity").select("topic, questions, correct, consultations, reviews, last_activity").eq("user_id", user.id),
    supabase.from("login_days").select("activity_date").eq("user_id", user.id).order("activity_date", { ascending: true }),
    supabase.from("patient_attempts").select("id, topic, score, created_at").eq("user_id", user.id),
    // Fonte definitiva do histórico de consultas: sempre do Supabase,
    // filtrado por dono (user_id = auth.uid(), garantido pela RLS). O
    // localStorage nunca é a fonte de verdade, só um cache opcional.
    supabase
      .from("patient_sessions")
      .select("id, finished_at, score, feedback, patient_cases(title, patient_name, patient_age)")
      .eq("user_id", user.id)
      .eq("status", "finished")
      .order("finished_at", { ascending: false })
      .limit(12),
    getProStatus(supabase, user.id),
  ]);

  // simulado_questions só é legível por service role (RLS bloqueia o
  // cliente) — mas a consulta continua travada no usuário autenticado
  // (nunca em algo vindo do cliente), igual às rotas /api/simulados/*.
  const service = createServiceClient();
  const [simuladoAnsweredRes, simuladoAttemptsRes] = await Promise.all([
    service
      .from("simulado_attempt_questions")
      .select("selected_index, simulado_attempts!inner(user_id, completed_at), simulado_questions(topic, correct_index)")
      .eq("simulado_attempts.user_id", user.id)
      .not("selected_index", "is", null),
    service.from("simulado_attempts").select("score, completed_at").eq("user_id", user.id).eq("status", "completed"),
  ]);

  const profile = profileRes.data;
  const attempts = attemptsRes.data || [];
  const patientAttempts = patientAttemptsRes.data || [];
  const loginDays = (loginDaysRes.data || []).map((row) => row.activity_date);
  const errors = (errorsRes.data || []).map((row) => ({
    id: row.id,
    questionId: row.question_id,
    topic: row.topic,
    question: row.question,
    selectedAnswer: row.selected_answer,
    correctAnswer: row.correct_answer,
    explanation: row.explanation,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : null,
  }));

  const recentConsultations = (consultSessionsRes.data || []).map((row) => {
    const caseInfo = Array.isArray(row.patient_cases) ? row.patient_cases[0] : row.patient_cases;
    const fb = (row.feedback ?? {}) as {
      evaluation?: { strengths?: string[]; gaps?: string[]; examLearning?: string[]; feedback?: string };
      submission?: { hypothesis?: string };
      // formato antigo (antes desta migração de schema) — mantido só para
      // leitura, sem apagar os dados já gravados nesse formato.
      strengths?: string[]; gaps?: string[]; examLearning?: string[]; hypothesis?: string;
    };
    const score = row.score ?? 0;
    return {
      id: row.id,
      finishedAt: row.finished_at ? new Date(row.finished_at).getTime() : null,
      score,
      level: score >= 85 ? "Excelente condução" : score >= 70 ? "Boa condução" : score >= 50 ? "Condução parcial" : "Precisa aprofundar",
      title: caseInfo?.title || "Atendimento",
      patientName: caseInfo?.patient_name || "Paciente",
      patientAge: caseInfo?.patient_age || 0,
      hypothesis: fb.submission?.hypothesis || fb.hypothesis || "",
      strengths: fb.evaluation?.strengths || fb.strengths || [],
      gaps: fb.evaluation?.gaps || fb.gaps || [],
      examLearning: fb.evaluation?.examLearning || fb.examLearning || [],
    };
  });

  const questionsTotal = attempts.reduce((sum, a) => sum + (a.total || 0), 0);
  const correctTotal = attempts.reduce((sum, a) => sum + (a.correct || 0), 0);
  const consultationsTotal = (topicsRes.data || []).reduce((sum, t) => sum + (t.consultations || 0), 0);

  const simuladoRows = (simuladoAnsweredRes.data ?? []) as unknown as SimuladoAnsweredRow[];
  const mastery = computeMastery(attempts, simuladoRows, patientAttempts);

  // --- Missão diária ------------------------------------------------------
  // Tarefas concretas verificadas com dados reais do dia (Brasília). O tema
  // de foco é escolhido com base no histórico ATÉ ONTEM, para que concluir a
  // própria missão não troque o tema no meio do dia.
  const todayKey = brasiliaDateKey();
  const isToday = (iso?: string | null) => !!iso && brasiliaDateKey(new Date(iso)) === todayKey;
  const beforeToday = (iso?: string | null) => !!iso && brasiliaDateKey(new Date(iso)) < todayKey;
  const baselineMastery = computeMastery(
    attempts.filter((a) => beforeToday(a.created_at)),
    simuladoRows.filter((row) => beforeToday(firstOf(row.simulado_attempts)?.completed_at)),
    patientAttempts.filter((a) => beforeToday(a.created_at)),
  );
  const focusTopic = pickFocusTopic(baselineMastery, todayKey);
  const todayAttempts = attempts.filter((a) => isToday(a.created_at));
  const questionsToday = todayAttempts.reduce((sum, a) => sum + (a.total || 0), 0);
  const focusQuestionsToday = todayAttempts.reduce(
    (sum, a) => sum + ((a.topic_results as TopicResult[] | null) ?? [])
      .filter((tr) => toCanonicalTopic(tr.topic) === focusTopic)
      .reduce((s, tr) => s + (tr.total || 0), 0),
    0,
  );
  const consultationsToday = patientAttempts.filter((a) => isToday(a.created_at)).length;
  // O gratuito tem 1 consulta por semana: a tarefa aparece enquanto ela
  // estiver disponível (ou se já foi feita hoje, para contar como concluída).
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const consultationsThisWeek = patientAttempts.filter((a) => new Date(a.created_at).getTime() >= weekAgo).length;
  const canConsult = (pro.limits?.consultations ?? 0) > 0
    && (pro.limits?.consultationWindow !== "semana" || consultationsToday > 0 || consultationsThisWeek < (pro.limits?.consultations ?? 0));

  const missionTasks: MissionTask[] = [
    {
      id: "focus",
      title: `Reforce ${focusTopic}`,
      detail: "5 questões no tema que mais precisa de você",
      progress: Math.min(5, focusQuestionsToday),
      target: 5,
      action: { type: "quiz", topic: focusTopic, amount: 5 },
    },
    {
      id: "mixed",
      title: "Quiz misto",
      detail: "Chegue a 10 questões respondidas hoje",
      progress: Math.min(10, questionsToday),
      target: 10,
      action: { type: "quiz", topic: "Todos", amount: 5 },
    },
    canConsult
      ? {
          id: "patient",
          title: "Atenda um paciente virtual",
          detail: "Anamnese, exame e hipótese sem pistas",
          progress: Math.min(1, consultationsToday),
          target: 1,
          action: { type: "screen", screen: "patient" },
        }
      : {
          id: "volume",
          title: "Treino de volume",
          detail: "Chegue a 20 questões respondidas hoje",
          progress: Math.min(20, questionsToday),
          target: 20,
          action: { type: "quiz", topic: "Todos", amount: 10 },
        },
  ].map((task) => ({ ...task, done: task.progress >= task.target }) as MissionTask);

  const simuladoScores = (simuladoAttemptsRes.data ?? []).map((a) => a.score ?? 0);
  const simuladoAverage = simuladoScores.length ? Math.round(simuladoScores.reduce((s, v) => s + v, 0) / simuladoScores.length) : null;
  const patientScores = patientAttempts.map((a) => (a as { score?: number }).score ?? 0);
  const patientAverage = patientScores.length ? Math.round(patientScores.reduce((s, v) => s + v, 0) / patientScores.length) : null;
  const activitiesCompleted = attempts.length + (simuladoAttemptsRes.data?.length ?? 0) + patientAttempts.length;

  const weeklyActivity = computeWeeklyActivity([
    ...attempts.map((a) => a.created_at),
    ...patientAttempts.map((a) => a.created_at),
    ...(simuladoAttemptsRes.data ?? []).flatMap((a) => (a.completed_at ? [a.completed_at] : [])),
  ]);
  // Ritmo dos últimos 7 dias (janela móvel, Brasília) para o monitor em ECG
  // da Home: atividades concluídas por dia e se houve acesso naquele dia.
  const activityDates = [
    ...attempts.map((a) => a.created_at),
    ...patientAttempts.map((a) => a.created_at),
    ...(simuladoAttemptsRes.data ?? []).flatMap((a) => (a.completed_at ? [a.completed_at] : [])),
  ].flatMap((iso) => (iso ? [brasiliaDateKey(new Date(iso))] : []));
  const loginSet = new Set(loginDays);
  const rhythm = lastDaysKeys(7).map((date) => {
    const activities = activityDates.filter((key) => key === date).length;
    return { date, activities, active: activities > 0 || loginSet.has(date) };
  });

  const weekKeys = new Set(currentWeekKeys());
  const weekAttempts = attempts.filter((a) => a.created_at && weekKeys.has(brasiliaDateKey(new Date(a.created_at))));
  // Questões da semana = quiz + simulados concluídos nesta semana.
  const weekSimulado = simuladoRows.filter((row) => {
    const completedAt = firstOf(row.simulado_attempts)?.completed_at;
    return !!completedAt && weekKeys.has(brasiliaDateKey(new Date(completedAt)));
  });
  const weekQuestions = weekAttempts.reduce((sum, a) => sum + (a.total || 0), 0) + weekSimulado.length;
  const weekCorrect =
    weekAttempts.reduce((sum, a) => sum + (a.correct || 0), 0) +
    weekSimulado.filter((row) => row.simulado_questions && row.selected_index === row.simulado_questions.correct_index).length;

  return Response.json({
    profile: { displayName: profile?.name || "Usuário", email: profile?.email || user.email, xp: profile?.xp || 0 },
    ranking: (rankingRes.data || []).map((row: { display_name: string; xp: number }) => ({ displayName: row.display_name, xp: row.xp })),
    errors,
    attempts,
    mastery,
    recentConsultations,
    stats: {
      attempts: attempts.length,
      questions: questionsTotal,
      correct: correctTotal,
      consultations: consultationsTotal,
      activities: activitiesCompleted,
      averageScore: questionsTotal > 0 ? Math.round((correctTotal / questionsTotal) * 100) : null,
      quizAccuracy: questionsTotal > 0 ? Math.round((correctTotal / questionsTotal) * 100) : null,
      simuladoAverage,
      patientAverage,
    },
    loginDays,
    streak: computeCurrentStreak(loginDays),
    weeklyActivity,
    rhythm,
    week: {
      activities: weeklyActivity.reduce((sum, v) => sum + v, 0),
      questions: weekQuestions,
      accuracy: weekQuestions > 0 ? Math.round((weekCorrect / weekQuestions) * 100) : null,
      activeDays: loginDays.filter((day) => weekKeys.has(day)).length,
    },
    mission: {
      date: todayKey,
      focusTopic,
      completed: missionTasks.filter((t) => t.done).length,
      total: missionTasks.length,
      tasks: missionTasks,
    },
    pro,
  });
}

async function bumpTopicActivity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  topic: string,
  delta: { questions?: number; correct?: number; consultations?: number; reviews?: number },
) {
  const { data: existing } = await supabase
    .from("topic_activity")
    .select("questions, correct, consultations, reviews")
    .eq("user_id", userId)
    .eq("topic", topic)
    .maybeSingle();

  await supabase.from("topic_activity").upsert(
    {
      user_id: userId,
      topic,
      questions: (existing?.questions || 0) + (delta.questions || 0),
      correct: (existing?.correct || 0) + (delta.correct || 0),
      consultations: (existing?.consultations || 0) + (delta.consultations || 0),
      reviews: (existing?.reviews || 0) + (delta.reviews || 0),
      last_activity: new Date().toISOString(),
    },
    { onConflict: "user_id,topic" },
  );
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    topic?: string;
    total?: number;
    correct?: number;
    topicResults?: TopicResult[];
    errors?: { questionId: string; topic: string; question: string; selectedAnswer: string; correctAnswer: string; explanation: string }[];
    score?: number;
    historyScore?: number;
    physicalScore?: number;
    examsScore?: number;
    reasoningScore?: number;
    activityDate?: string;
  };

  if (body.action === "quiz_result") {
    const total = Number(body.total) || 0;
    const correct = Number(body.correct) || 0;
    if (total <= 0) return Response.json({ message: "Dados inválidos." }, { status: 400 });

    const { error: insertError } = await supabase.from("quiz_attempts").insert({
      user_id: user.id,
      topic: body.topic || "Geral",
      total,
      correct,
      topic_results: body.topicResults || [],
    });
    if (insertError) return Response.json({ message: "Não foi possível salvar o resultado." }, { status: 500 });

    for (const result of body.topicResults || []) {
      await bumpTopicActivity(supabase, user.id, result.topic, { questions: result.total, correct: result.correct });
    }

    if (body.errors?.length) {
      await supabase.from("error_notebook").insert(
        body.errors.map((item) => ({
          user_id: user.id,
          question_id: item.questionId,
          topic: item.topic,
          question: item.question,
          selected_answer: item.selectedAnswer,
          correct_answer: item.correctAnswer,
          explanation: item.explanation,
        })),
      );
      for (const item of body.errors) {
        await bumpTopicActivity(supabase, user.id, item.topic, { reviews: 1 });
      }
    }
    return Response.json({ ok: true });
  }

  if (body.action === "patient_result") {
    // Recurso Pro: protegido no servidor, não só na interface. Um usuário
    // sem assinatura ativa não consegue gravar atendimentos mesmo
    // manipulando a chamada diretamente.
    const pro = await getProStatus(supabase, user.id);
    if (!pro.active) {
      return Response.json(
        { message: "Este recurso é exclusivo do plano Pro.", requiresPro: true, checkoutUrls: pro.checkoutUrls },
        { status: 403 },
      );
    }

    const score = Number(body.score) || 0;
    const { error: insertError } = await supabase.from("patient_attempts").insert({
      user_id: user.id,
      topic: body.topic || "Cardiovascular",
      score,
      history_score: body.historyScore ?? null,
      physical_score: body.physicalScore ?? null,
      exams_score: body.examsScore ?? null,
      reasoning_score: body.reasoningScore ?? null,
    });
    if (insertError) return Response.json({ message: "Não foi possível salvar o atendimento." }, { status: 500 });

    await bumpTopicActivity(supabase, user.id, body.topic || "Cardiovascular", { consultations: 1 });
    return Response.json({ ok: true });
  }

  if (body.action === "login_day") {
    // A data é SEMPRE calculada aqui no servidor, em horário de Brasília —
    // nunca a partir do que o cliente envia (fuso do navegador não é
    // confiável nem consistente com o cálculo do streak).
    const activityDate = brasiliaDateKey();
    await supabase
      .from("login_days")
      .upsert({ user_id: user.id, activity_date: activityDate }, { onConflict: "user_id,activity_date", ignoreDuplicates: true });
    return Response.json({ ok: true, activityDate });
  }

  return Response.json({ message: "Ação inválida." }, { status: 400 });
}
