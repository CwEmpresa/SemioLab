import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

/** Comportamento da base: retenção por coorte, o que cada grupo fez no 1º
 * dia e se voltou, funil completo, rota entre telas, paywall, consultas
 * abandonadas e latência da IA. Só agregados — nunca conteúdo clínico. */
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });

  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_behavior_stats");
  if (error) {
    return Response.json(
      { error: "Falha ao carregar o comportamento. Confira se a migração 20261110_audit_security_behavior foi aplicada." },
      { status: 500 },
    );
  }
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
