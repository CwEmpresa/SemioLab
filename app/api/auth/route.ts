import { supabaseRequest } from "../../supabase-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json() as { action?: string; email?: string; password?: string; name?: string; refreshToken?: string };
  let path = "";
  let payload: Record<string, unknown> = {};
  if (body.action === "signin") {
    path = "/token?grant_type=password";
    payload = { email: body.email, password: body.password };
  } else if (body.action === "signup") {
    path = "/signup";
    payload = { email: body.email, password: body.password, data: { name: body.name } };
  } else if (body.action === "refresh") {
    path = "/token?grant_type=refresh_token";
    payload = { refresh_token: body.refreshToken };
  } else if (body.action === "recover") {
    path = "/recover";
    payload = { email: body.email };
  } else return Response.json({ message: "Ação inválida." }, { status: 400 });

  const upstream = await supabaseRequest(path, { method: "POST", body: JSON.stringify(payload) });
  const data = await upstream.json().catch(() => ({})) as Record<string, unknown>;
  if (!upstream.ok) {
    const original = String(data.msg || data.message || data.error_description || "Não foi possível autenticar.");
    const message = /invalid login credentials/i.test(original) ? "E-mail ou senha incorretos." : /already registered/i.test(original) ? "Este e-mail já possui uma conta." : original;
    return Response.json({ message }, { status: upstream.status });
  }
  if (body.action === "recover") return Response.json({ ok: true });
  const session = data.access_token ? data : null;
  return Response.json({ session, needsConfirmation: body.action === "signup" && !session });
}
