import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

// Só estes — nunca evento arbitrário do cliente.
const ALLOWED_EVENTS = ["checkout_clicked", "onboarding_started", "onboarding_skipped", "onboarding_completed"] as const;

const BodySchema = z.object({
  eventName: z.enum(ALLOWED_EVENTS),
  source: z.string().max(60).optional(),
  // Metadado deliberadamente restrito — nunca e-mail, mensagem, token ou
  // diagnóstico. Só o que a UI de fato precisa medir.
  safeMetadata: z.object({
    plan: z.enum(["monthly", "annual"]).optional(),
    reason: z.string().max(40).optional(),
  }).strict().optional(),
});

const MAX_EVENTS_PER_MINUTE = 20;

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const parsed = BodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Payload inválido." }, { status: 400 });

  const service = createServiceClient();

  // Rate limit simples: no máximo 20 eventos/minuto por usuário — evita
  // abuso sem precisar de tabela nova só para isso.
  const { count } = await service
    .from("product_events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", new Date(Date.now() - 60_000).toISOString());
  if ((count ?? 0) >= MAX_EVENTS_PER_MINUTE) {
    return Response.json({ error: "Muitos eventos em pouco tempo." }, { status: 429 });
  }

  // Sempre auth.uid() — nunca um user_id vindo do corpo da requisição.
  const { error } = await service.from("product_events").insert({
    user_id: user.id,
    event_name: parsed.data.eventName,
    source: parsed.data.source ?? null,
    safe_metadata: parsed.data.safeMetadata ?? null,
  });
  if (error) return Response.json({ error: "Não foi possível registrar o evento." }, { status: 500 });

  return Response.json({ ok: true });
}
