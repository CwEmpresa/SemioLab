import { getAuthUserId } from "@/lib/auth-fast";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { after } from "next/server";
import { ensureOptionExplanations } from "@/lib/option-explanations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const VALID_AMOUNTS = [5, 10, 20];

export async function POST(request: Request) {
  const supabase = await createClient();
  const authUserId = await getAuthUserId(supabase);
  const user = authUserId ? { id: authUserId } : null;
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { topic?: string; amount?: number };
  const amount = VALID_AMOUNTS.includes(body.amount ?? 10) ? (body.amount as number) : 10;
  const topic = body.topic && body.topic !== "Todos" ? body.topic : null;

  const service = createServiceClient();
  let query = service
    .from("simulado_questions")
    .select("id, topic, difficulty, subtopic, text, options")
    .eq("status", "published")
    .eq("is_active", true);
  if (topic) query = query.eq("topic", topic);
  const { data: rows } = await query;

  const pool = rows ?? [];
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const questions = shuffled.slice(0, amount).map((q) => ({ ...q, options: [...q.options].sort(() => Math.random() - 0.5) }));
  // Já prepara, em segundo plano, a explicação de cada alternativa destas
  // questões — quando o aluno errar, o "por que está errada" já está pronto.
  const ids = questions.map((q) => q.id);
  after(() => ensureOptionExplanations(service, ids, { warmOnly: true }).then(() => undefined));
  // Nunca envia correct_index/explanation aqui — só depois do envio da
  // resposta, em /api/quiz/submit.
  return Response.json({ questions, available: pool.length, requested: amount });
}
