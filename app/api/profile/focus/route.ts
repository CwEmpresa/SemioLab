import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getAuthUserId } from "@/lib/auth-fast";
import { toCanonicalTopic } from "@/lib/canonical-topics";

export const dynamic = "force-dynamic";

/** Grava o que o estudante está vendo na faculdade agora. A missão diária
 * e a escolha do próximo paciente passam a priorizar esse tema. Só aceita
 * um dos temas canônicos (ou null para voltar à escolha automática). */
export async function POST(request: Request) {
  const supabase = await createClient();
  const userId = await getAuthUserId(supabase);
  if (!userId) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { focus?: unknown };
  const raw = typeof body.focus === "string" ? body.focus : null;
  const focus = toCanonicalTopic(raw);
  if (raw && !focus) return Response.json({ error: "Tema inválido." }, { status: 400 });

  const { error } = await createServiceClient().from("profiles").update({ study_focus: focus }).eq("id", userId);
  if (error) return Response.json({ error: "Não foi possível salvar o tema agora." }, { status: 500 });
  return Response.json({ ok: true, focus });
}
