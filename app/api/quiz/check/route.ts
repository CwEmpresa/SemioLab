import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthUserId } from "@/lib/auth-fast";
import { loadQuestions } from "@/lib/option-explanations";

export const dynamic = "force-dynamic";

/** Correção de UMA questão do Quiz rápido, logo depois que o aluno
 * responde. Só lê — a gravação do resultado (XP, caderno de erros, temas)
 * continua sendo feita uma vez só, no fim, por /api/quiz/submit. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const [userId, body] = await Promise.all([
    getAuthUserId(supabase),
    request.json().catch(() => ({})) as Promise<{ questionId?: string; selectedText?: string }>,
  ]);
  if (!userId) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (!body.questionId || typeof body.selectedText !== "string") {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { rows } = await loadQuestions(createServiceClient(), [body.questionId]);
  const q = rows[0];
  if (!q) return Response.json({ error: "Questão não encontrada." }, { status: 404 });

  const correctText = q.options[q.correct_index];
  const correct = body.selectedText === correctText;
  const explanations = q.option_explanations ?? null;
  return Response.json({
    correct,
    correctText,
    explanation: q.explanation,
    correctWhy: explanations?.[correctText] ?? null,
    // Null quando ainda não há explicação salva para a alternativa marcada —
    // o cliente pede em /api/quiz/why-wrong sem travar a correção.
    whyWrong: correct ? null : explanations?.[body.selectedText] ?? null,
  });
}
