import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const QuerySchema = z.object({
  search: z.string().max(200).default(""),
  filter: z.enum(["all", "pending", "free", "trial", "pro", "recent"]).default("all"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    search: url.searchParams.get("search") ?? undefined,
    filter: url.searchParams.get("filter") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
  });
  if (!parsed.success) return Response.json({ error: "Parâmetros inválidos." }, { status: 400 });
  const { search, filter, page } = parsed.data;

  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_list_users", {
    p_search: search,
    p_filter: filter,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
  });
  if (error) return Response.json({ error: "Falha ao buscar usuários." }, { status: 500 });

  return Response.json({ ...data, page, pageSize: PAGE_SIZE }, { headers: { "Cache-Control": "no-store" } });
}
