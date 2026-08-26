import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const service = createServiceClient();
  // Atômico: nunca concede XP duas vezes, mesmo em reload, clique duplo
  // ou requisições concorrentes (testado diretamente no banco antes do
  // deploy — ver relatório).
  const { data: xpAwarded, error } = await service.rpc("first_experience_complete", { p_user_id: user.id });
  if (error) return Response.json({ error: "Falha ao concluir." }, { status: 500 });

  return Response.json({ ok: true, xpAwarded: !!xpAwarded });
}
