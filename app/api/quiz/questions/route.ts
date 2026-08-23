import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const VALID_AMOUNTS = [5, 10, 20];

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  // Nunca envia correct_index/explanation aqui — só depois do envio da
  // resposta, em /api/quiz/submit.
  return Response.json({ questions, available: pool.length, requested: amount });
}
