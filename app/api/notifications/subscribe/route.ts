import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return Response.json({ error: "Payload de inscrição inválido." }, { status: 400 });
  }

  // Insert idempotente por endpoint (nunca update): se o mesmo dispositivo
  // já está inscrito, ignora silenciosamente — não precisa de policy de
  // UPDATE (mantida revogada de propósito). Sempre vinculado ao usuário
  // autenticado, nunca a um user_id vindo do cliente.
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id: user.id, endpoint: body.endpoint, p256dh: body.keys.p256dh, auth_key: body.keys.auth }, { onConflict: "endpoint", ignoreDuplicates: true });
  if (error) return Response.json({ error: "Não foi possível salvar a inscrição." }, { status: 500 });

  return Response.json({ ok: true });
}
