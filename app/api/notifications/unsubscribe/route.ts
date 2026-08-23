import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { endpoint?: string };
  if (!body.endpoint) return Response.json({ error: "endpoint obrigatório." }, { status: 400 });

  // RLS já garante que só apaga se user_id = auth.uid(); o filtro extra
  // aqui é só para clareza, não é a única barreira de segurança.
  await supabase.from("push_subscriptions").delete().eq("endpoint", body.endpoint).eq("user_id", user.id);
  return Response.json({ ok: true });
}
