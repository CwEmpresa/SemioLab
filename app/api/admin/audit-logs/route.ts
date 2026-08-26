import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const QuerySchema = z.object({ page: z.coerce.number().int().min(1).default(1) });

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({ page: url.searchParams.get("page") ?? undefined });
  if (!parsed.success) return Response.json({ error: "Parâmetro inválido." }, { status: 400 });
  const limit = 30;
  const offset = (parsed.data.page - 1) * limit;
  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_list_audit_logs", { p_limit: limit, p_offset: offset });
  if (error) return Response.json({ error: "Falha ao carregar auditoria." }, { status: 500 });
  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
