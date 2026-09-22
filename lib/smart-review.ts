import { createServiceClient } from "@/lib/supabase/service";
import type {
  ReviewDifficulty,
  ReviewQuestion,
  ReviewSection,
  SmartReviewProps,
  TopicPerformance,
} from "@/remotion/smart-review/types";

export type SmartReviewResult =
  | { status: "ready"; review: SmartReviewProps }
  | { status: "not_found" }
  | { status: "in_progress" };

const LETTERS = ["A", "B", "C", "D", "E", "F"];
const UNDEFINED_TOPIC = "Tema geral";
const MAX_PRIORITY_CONCEPTS = 3;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Errar uma questão fácil revela uma lacuna mais básica do que errar uma
 * difícil — por isso pesa mais na prioridade da revisão. */
const DIFFICULTY_WEIGHT: Record<ReviewDifficulty, number> = { facil: 3, medio: 2, dificil: 1, desconhecida: 2 };

type AttemptQuestionRow = {
  order_index: number;
  selected_index: number | null;
  simulado_questions: {
    topic: string | null;
    subtopic: string | null;
    difficulty: string | null;
    text: string;
    options: unknown;
    correct_index: number;
    explanation: string | null;
  } | null;
};

function toDifficulty(value: string | null): ReviewDifficulty {
  return value === "facil" || value === "medio" || value === "dificil" ? value : "desconhecida";
}

function clean(text: string | null | undefined) {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** Primeira frase da explicação = conceito central (as explicações do
 * banco já abrem pela ideia principal). Se a explicação tem uma frase só
 * (repetiria o texto já exibido) ou não existe, o ponto de memorização é a
 * própria alternativa correta. */
function extractKeyPoint(explanation: string | null, correctText: string) {
  const first = explanation?.match(/^.+?[.!?](?=\s|$)/)?.[0]?.trim();
  if (explanation && first && first.length < explanation.length) return first;
  return `Guarde: ${correctText}`;
}

function firstName(name: string | null | undefined, email: string | null | undefined) {
  const base = clean(name) || clean(email?.split("@")[0]);
  return base.split(" ")[0] || "Aluno";
}

/** Monta a Revisão Inteligente de uma tentativa de simulado. A tentativa é
 * sempre buscada filtrando pelo usuário autenticado — outro usuário recebe
 * "not_found", sem revelar que a tentativa existe. */
export async function buildSmartReview(attemptId: string, user: { id: string; email?: string | null }): Promise<SmartReviewResult> {
  if (!UUID.test(attemptId)) return { status: "not_found" };

  // Mesmo padrão das rotas /api/simulados/*: simulado_questions só é legível
  // com service role, então a posse da tentativa é verificada explicitamente.
  const service = createServiceClient();
  const { data: attempt } = await service
    .from("simulado_attempts")
    .select("id, status")
    .eq("id", attemptId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!attempt) return { status: "not_found" };
  if (attempt.status !== "completed") return { status: "in_progress" };

  const [{ data: rows }, { data: profile }] = await Promise.all([
    service
      .from("simulado_attempt_questions")
      .select("order_index, selected_index, simulado_questions(topic, subtopic, difficulty, text, options, correct_index, explanation)")
      .eq("attempt_id", attemptId)
      .order("order_index", { ascending: true }),
    service.from("profiles").select("name").eq("id", user.id).maybeSingle(),
  ]);

  const questions = ((rows ?? []) as unknown as AttemptQuestionRow[]).filter((row) => row.simulado_questions);
  if (!questions.length) return { status: "not_found" };

  const topicStats = new Map<string, { total: number; correct: number }>();
  const wrong: ReviewQuestion[] = [];
  let answered = 0;
  let correctCount = 0;

  for (const row of questions) {
    const q = row.simulado_questions!;
    const options = Array.isArray(q.options) ? (q.options as unknown[]).map((o) => clean(String(o))) : [];
    const topic = clean(q.topic) || UNDEFINED_TOPIC;
    const hasAnswer = row.selected_index !== null && row.selected_index >= 0 && row.selected_index < options.length;
    const isCorrect = hasAnswer && row.selected_index === q.correct_index;
    if (hasAnswer) answered += 1;
    if (isCorrect) correctCount += 1;

    const stats = topicStats.get(topic) ?? { total: 0, correct: 0 };
    stats.total += 1;
    if (isCorrect) stats.correct += 1;
    topicStats.set(topic, stats);

    if (isCorrect) continue;
    const correctText = options[q.correct_index] ?? "";
    const explanation = clean(q.explanation) || null;
    wrong.push({
      number: row.order_index + 1,
      topic,
      subtopic: clean(q.subtopic) || null,
      difficulty: toDifficulty(q.difficulty),
      statement: clean(q.text),
      selectedLetter: hasAnswer ? LETTERS[row.selected_index!] ?? null : null,
      selectedText: hasAnswer ? options[row.selected_index!] ?? null : null,
      correctLetter: LETTERS[q.correct_index] ?? "?",
      correctText,
      explanation,
      keyPoint: extractKeyPoint(explanation, correctText),
    });
  }

  const topics: TopicPerformance[] = [...topicStats.entries()]
    .map(([topic, s]) => ({ topic, total: s.total, correct: s.correct, accuracy: Math.round((s.correct / s.total) * 100) }))
    .sort((a, b) => a.accuracy - b.accuracy || b.total - a.total);
  const accuracyOf = (topic: string) => topics.find((t) => t.topic === topic)?.accuracy ?? 0;

  const sections = buildSections(wrong, accuracyOf);
  const priorityConcepts = sections
    .flatMap((section) => (section.kind === "group" ? section.questions : [section.question]))
    .map((q) => q.keyPoint)
    .filter((point, index, all) => all.indexOf(point) === index)
    .slice(0, MAX_PRIORITY_CONCEPTS);

  const total = questions.length;
  return {
    status: "ready",
    review: {
      attemptId,
      studentFirstName: firstName(profile?.name, user.email),
      totalQuestions: total,
      answeredQuestions: answered,
      correctAnswers: correctCount,
      wrongAnswers: wrong.length,
      score: Math.round((correctCount / total) * 100),
      topics,
      sections,
      priorityConcepts,
      nextStep: nextStepFor(sections, topics),
    },
  };
}

/** Agrupa erros do mesmo assunto (subtópico, ou tema quando não houver) e
 * ordena por prioridade: pior desempenho no tema → conceitos repetidos →
 * erros mais importantes (dificuldade) → ordem da prova. */
function buildSections(wrong: ReviewQuestion[], accuracyOf: (topic: string) => number): ReviewSection[] {
  const buckets = new Map<string, ReviewQuestion[]>();
  for (const q of wrong) {
    const key = `${q.topic}::${q.subtopic ?? ""}`;
    buckets.set(key, [...(buckets.get(key) ?? []), q]);
  }

  // Subtópicos com um único erro dentro de um tema com vários erros são
  // agrupados pelo tema, para não fragmentar a revisão.
  const byTopic = new Map<string, ReviewQuestion[][]>();
  for (const group of buckets.values()) byTopic.set(group[0].topic, [...(byTopic.get(group[0].topic) ?? []), group]);
  const groups: { title: string; topic: string; questions: ReviewQuestion[] }[] = [];
  for (const [topic, topicGroups] of byTopic) {
    const multi = topicGroups.filter((g) => g.length > 1);
    const loose = topicGroups.filter((g) => g.length === 1).flat();
    for (const g of multi) groups.push({ title: g[0].subtopic ?? topic, topic, questions: g });
    if (loose.length > 1) groups.push({ title: topic, topic, questions: loose });
    else if (loose.length === 1) groups.push({ title: loose[0].subtopic ?? topic, topic, questions: loose });
  }

  const importance = (qs: ReviewQuestion[]) => Math.max(...qs.map((q) => DIFFICULTY_WEIGHT[q.difficulty]));
  groups.sort((a, b) =>
    accuracyOf(a.topic) - accuracyOf(b.topic)
    || b.questions.length - a.questions.length
    || importance(b.questions) - importance(a.questions)
    || a.questions[0].number - b.questions[0].number,
  );

  return groups.map((g) => {
    const questions = [...g.questions].sort((a, b) => DIFFICULTY_WEIGHT[b.difficulty] - DIFFICULTY_WEIGHT[a.difficulty] || a.number - b.number);
    return questions.length > 1
      ? { kind: "group" as const, title: g.title, topic: g.topic, accuracy: accuracyOf(g.topic), questions }
      : { kind: "single" as const, question: questions[0] };
  });
}

function nextStepFor(sections: ReviewSection[], topics: TopicPerformance[]) {
  const first = sections[0];
  if (!first) {
    const smallest = [...topics].sort((a, b) => a.total - b.total)[0];
    return smallest
      ? `Mantenha o ritmo: faça um novo simulado e aprofunde ${smallest.topic}, o tema com menos questões nesta prova.`
      : "Mantenha o ritmo com um novo simulado.";
  }
  const subject = first.kind === "group" ? first.title : first.question.subtopic ?? first.question.topic;
  return `Revise ${subject} novamente antes do próximo simulado.`;
}
