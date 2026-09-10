import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });

  const service = createServiceClient();
  const [stats, series] = await Promise.all([
    service.rpc("admin_revenue_stats"),
    service.rpc("admin_revenue_series"),
  ]);
  if (stats.error || series.error) return Response.json({ error: "Falha ao carregar receita." }, { status: 500 });

  return Response.json({ ...stats.data, series: series.data }, { headers: { "Cache-Control": "no-store" } });
}
