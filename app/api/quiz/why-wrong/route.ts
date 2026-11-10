import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthUserId } from "@/lib/auth-fast";
import { ensureOptionExplanations } from "@/lib/option-explanations";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Explicação de por que a alternativa marcada está errada (e por que a
 * correta é a certa). Gera na hora se ainda não existir e guarda no cache
 * quando a coluna opcional existe. Usado pelo Quiz rápido e pelo Simulado. */
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

  const map = await ensureOptionExplanations(createServiceClient(), [body.questionId]);
  const explanations = map.get(body.questionId) ?? {};
  return Response.json({ whyWrong: explanations[body.selectedText] ?? null });
}
