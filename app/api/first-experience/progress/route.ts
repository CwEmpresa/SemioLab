import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

const STEPS = ["intro", "conversation", "exam", "xray_request", "xray_viewer", "interpretation", "hypothesis", "completed"] as const;
const BodySchema = z.object({ step: z.enum(STEPS) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Etapa inválida." }, { status: 400 });

  const service = createServiceClient();
  // Nunca sobrescreve uma conclusão já registrada: só atualiza se a linha
  // existe e ainda não foi concluída; se ainda não existe, cria.
  const { data: updated } = await service
    .from("first_experience_progress")
    .update({ step: parsed.data.step, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("completed_at", null)
    .select("user_id")
    .maybeSingle();
  if (!updated) {
    await service.from("first_experience_progress").insert({ user_id: user.id, step: parsed.data.step }).select().maybeSingle();
  }

  return Response.json({ ok: true });
}
