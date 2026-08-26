import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_time_series");
  if (error) return Response.json({ error: "Falha ao carregar séries." }, { status: 500 });
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
