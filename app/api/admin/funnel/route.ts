import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const QuerySchema = z.object({ days: z.coerce.number().int().refine((v) => v === 7 || v === 30) });

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({ days: url.searchParams.get("days") ?? undefined });
  if (!parsed.success) return Response.json({ error: "Parâmetro inválido." }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_activation_funnel", { p_days: parsed.data.days });
  if (error) return Response.json({ error: "Falha ao carregar o funil." }, { status: 500 });

  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
