import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const ParamsSchema = z.object({ id: z.string().uuid() });

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "ID inválido." }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_user_detail", { p_user_id: parsed.data.id });
  if (error || !data?.id) return Response.json({ error: "Usuário não encontrado." }, { status: 404 });

  return Response.json(data, { headers: { "Cache-Control": "no-store" } });
}
