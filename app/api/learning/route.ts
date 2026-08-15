import { createClient } from "@/lib/supabase/server";
import { CAKTO_CHECKOUT_URLS, isProActive } from "@/lib/pro";

export const dynamic = "force-dynamic";

type TopicResult = { topic: string; total: number; correct: number };

function unauthorized() {
  return Response.json({ error: "Não autenticado" }, { status: 401 });
}

async function getProStatus(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, next_payment_date, canceled_at")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    plan: data?.plan ?? "unknown",
    status: data?.status ?? "none",
    active: isProActive(data?.status),
    nextPaymentDate: data?.next_payment_date ?? null,
    canceledAt: data?.canceled_at ?? null,
    checkoutUrls: CAKTO_CHECKOUT_URLS,
  };
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return unauthorized();

  const [profileRes, rankingRes, attemptsRes, errorsRes, topicsRes, loginDaysRes, pro] = await Promise.all([
    supabase.from("profiles").select("name, email, xp").eq("id", user.id).single(),
    supabase.rpc("ranking"),
    supabase.from("quiz_attempts").select("id, topic, total, correct, topic_results, created_at").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("error_notebook").select("id, question_id, topic, question, selected_answer, correct_answer, explanation, created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
    supabase.from("topic_activity").select("topic, questions, correct, consultations, reviews, last_activity").eq("user_id", user.id),
    supabase.from("login_days").select("activity_date").eq("user_id", user.id).order("activity_date", { ascending: true }),
    getProStatus(supabase, user.id),
  ]);

  const profile = profileRes.data;
  const attempts = attemptsRes.data || [];
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

  const questionsTotal = attempts.reduce((sum, a) => sum + (a.total || 0), 0);
  const correctTotal = attempts.reduce((sum, a) => sum + (a.correct || 0), 0);
  const consultationsTotal = (topicsRes.data || []).reduce((sum, t) => sum + (t.consultations || 0), 0);

  const mastery = (topicsRes.data || []).map((row) => ({
    topic: row.topic,
    score: row.questions > 0 ? Math.round((row.correct / row.questions) * 100) : null,
    status: row.questions === 0 ? "Não iniciado" : row.correct / row.questions >= 0.8 ? "Dominado" : "Em progresso",
    questions: row.questions,
    consultations: row.consultations,
    reviews: row.reviews,
    sources: [row.questions > 0 ? "quiz" : null, row.consultations > 0 ? "patient" : null].filter(Boolean) as string[],
    lastActivity: row.last_activity ? new Date(row.last_activity).getTime() : null,
  }));

  return Response.json({
    profile: { displayName: profile?.name || "Usuário", email: profile?.email || user.email, xp: profile?.xp || 0 },
    ranking: (rankingRes.data || []).map((row: { display_name: string; xp: number }) => ({ displayName: row.display_name, xp: row.xp })),
    errors,
    attempts,
    mastery,
    stats: {
      attempts: attempts.length,
      questions: questionsTotal,
      correct: correctTotal,
      consultations: consultationsTotal,
      averageScore: questionsTotal > 0 ? Math.round((correctTotal / questionsTotal) * 100) : null,
    },
    loginDays: (loginDaysRes.data || []).map((row) => row.activity_date),
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
    const activityDate = body.activityDate && /^\d{4}-\d{2}-\d{2}$/.test(body.activityDate)
      ? body.activityDate
      : new Date().toISOString().slice(0, 10);
    // ignora duplicidade: um único registro por usuário por dia (UNIQUE no banco)
    await supabase.from("login_days").insert({ user_id: user.id, activity_date: activityDate });
    return Response.json({ ok: true });
  }

  return Response.json({ message: "Ação inválida." }, { status: 400 });
}
