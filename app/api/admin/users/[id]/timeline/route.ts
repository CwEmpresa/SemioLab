import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

const ParamsSchema = z.object({ id: z.string().uuid() });

/** Linha do tempo de um usuário (tudo o que ele fez, em ordem) — para
 * entender caso a caso por que alguém parou de usar. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "ID inválido." }, { status: 400 });

  const service = createServiceClient();
  const { data, error } = await service.rpc("admin_user_timeline", { p_user_id: parsed.data.id });
  if (error) return Response.json({ error: "Falha ao carregar a linha do tempo." }, { status: 500 });

  return Response.json({ events: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
