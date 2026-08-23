import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

async function bumpTopicActivity(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  topic: string,
  delta: { questions?: number; correct?: number; reviews?: number },
) {
  const { data: existing } = await service
    .from("topic_activity")
    .select("questions, correct, consultations, reviews")
    .eq("user_id", userId)
    .eq("topic", topic)
    .maybeSingle();
  await service.from("topic_activity").upsert(
    {
      user_id: userId,
      topic,
      questions: (existing?.questions || 0) + (delta.questions || 0),
      correct: (existing?.correct || 0) + (delta.correct || 0),
      consultations: existing?.consultations || 0,
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
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    topic?: string;
    answers?: { questionId: string; selectedText: string }[];
  };
  const answers = body.answers ?? [];
  if (answers.length === 0) return Response.json({ error: "Nenhuma resposta enviada." }, { status: 400 });

  const service = createServiceClient();

  // Nunca confia em "correto"/"total" vindos do cliente — busca as
  // questões reais e avalia tudo de novo aqui, no servidor.
  const ids = answers.map((a) => a.questionId);
  const { data: questions } = await service
    .from("simulado_questions")
    .select("id, topic, text, options, correct_index, explanation")
    .in("id", ids);
  const byId = new Map((questions ?? []).map((q) => [q.id, q]));

  const results: { questionId: string; correct: boolean; correctText: string; explanation: string }[] = [];
  const byTopic: Record<string, { topic: string; total: number; correct: number }> = {};
  const errors: { questionId: string; topic: string; question: string; selectedAnswer: string; correctAnswer: string; explanation: string }[] = [];

  for (const answer of answers) {
    const q = byId.get(answer.questionId);
    if (!q) continue; // ignora IDs que não existem/foram despublicados nesse meio-tempo
    const correctText = q.options[q.correct_index];
    const isCorrect = answer.selectedText === correctText;
    results.push({ questionId: q.id, correct: isCorrect, correctText, explanation: q.explanation });

    const bucket = byTopic[q.topic] || { topic: q.topic, total: 0, correct: 0 };
    bucket.total += 1;
    if (isCorrect) bucket.correct += 1;
    byTopic[q.topic] = bucket;

    if (!isCorrect) {
      errors.push({
        questionId: q.id,
        topic: q.topic,
        question: q.text,
        selectedAnswer: answer.selectedText || "Sem resposta",
        correctAnswer: correctText,
        explanation: q.explanation,
      });
    }
  }

  const total = results.length;
  const correct = results.filter((r) => r.correct).length;
  if (total === 0) return Response.json({ error: "Nenhuma questão válida encontrada." }, { status: 400 });

  // Mesma gravação já usada pelo quiz — sem duplicar XP: 1 insert por
  // envio, disparando o mesmo trigger de XP de sempre.
  await service.from("quiz_attempts").insert({
    user_id: user.id,
    topic: body.topic || "Geral",
    total,
    correct,
    topic_results: Object.values(byTopic),
  });

  for (const bucket of Object.values(byTopic)) {
    await bumpTopicActivity(service, user.id, bucket.topic, { questions: bucket.total, correct: bucket.correct });
  }

  if (errors.length) {
    await service.from("error_notebook").insert(
      errors.map((item) => ({
        user_id: user.id,
        question_id: item.questionId,
        topic: item.topic,
        question: item.question,
        selected_answer: item.selectedAnswer,
        correct_answer: item.correctAnswer,
        explanation: item.explanation,
      })),
    );
    for (const item of errors) await bumpTopicActivity(service, user.id, item.topic, { reviews: 1 });
  }

  return Response.json({ total, correct, results });
}
