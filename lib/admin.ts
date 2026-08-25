import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export type AdminIdentity = { userId: string; role: "admin" | "super_admin" };

/** Confirma que o usuário autenticado é admin. Nunca confia em nada vindo
 * do cliente — deriva tudo da sessão real e consulta admin_users via
 * service role (a tabela em si é inacessível para anon/authenticated). */
export async function requireAdmin(): Promise<AdminIdentity | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const service = createServiceClient();
  const { data } = await service.from("admin_users").select("role").eq("user_id", user.id).maybeSingle();
  if (!data) return null;
  return { userId: user.id, role: data.role as "admin" | "super_admin" };
}

/** Registra uma ação administrativa — nunca inclui senha, token, segredo,
 * link de confirmação, payload bruto da Cakto ou conteúdo clínico. */
export async function logAdminAction(params: {
  actorUserId: string;
  targetUserId?: string | null;
  action: string;
  result: "success" | "error";
  safeMetadata?: Record<string, unknown>;
}) {
  const service = createServiceClient();
  await service.from("admin_audit_logs").insert({
    actor_user_id: params.actorUserId,
    target_user_id: params.targetUserId ?? null,
    action: params.action,
    result: params.result,
    safe_metadata: params.safeMetadata ?? null,
  });
}

/** Cooldown de 60s + máximo de 5 tentativas em 24h por usuário-alvo,
 * reaproveitando o próprio audit log (nenhuma tabela nova). */
export async function checkResendRateLimit(
  targetUserId: string,
  action: string,
): Promise<{ ok: true } | { ok: false; reason: "cooldown" | "daily_limit" }> {
  const service = createServiceClient();
  const { data: recent } = await service
    .from("admin_audit_logs")
    .select("created_at")
    .eq("target_user_id", targetUserId)
    .eq("action", action)
    .eq("result", "success")
    .order("created_at", { ascending: false })
    .limit(5);

  if (recent && recent.length > 0) {
    const lastAt = new Date(recent[0].created_at).getTime();
    if (Date.now() - lastAt < 60_000) return { ok: false, reason: "cooldown" };
  }
  const last24h = (recent ?? []).filter((r) => Date.now() - new Date(r.created_at).getTime() < 24 * 60 * 60 * 1000);
  if (last24h.length >= 5) return { ok: false, reason: "daily_limit" };
  return { ok: true };
}

/** Confirma que a requisição de mutação veio da própria origem — barreira
 * simples contra CSRF/chamadas de outros domínios. */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(request.url).host;
  } catch {
    return false;
  }
}
