import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthUserId } from "@/lib/auth-fast";
import { findCase, gradeCase } from "@/lib/clinical-simulado";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/** Corrige UM caso do Simulado clínico. O cliente chama assim que o aluno
 * avança para o próximo caso — então, ao finalizar, os anteriores já estão
 * corrigidos e o resultado aparece na hora. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const [userId, body] = await Promise.all([
    getAuthUserId(supabase),
    request.json().catch(() => ({})) as Promise<{ caseId?: string; answer?: string }>,
  ]);
  if (!userId) return Response.json({ error: "Não autenticado" }, { status: 401 });
  if (!body.caseId || typeof body.answer !== "string") return Response.json({ error: "Dados inválidos." }, { status: 400 });

  const service = createServiceClient();
  const c = await findCase(service, body.caseId);
  if (!c) return Response.json({ error: "Caso não encontrado." }, { status: 404 });

  const grade = await gradeCase(service, userId, c, body.answer.slice(0, 6000));
  return Response.json({ ...grade, title: c.title, topic: c.topic });
}
