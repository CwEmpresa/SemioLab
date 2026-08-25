import { z } from "zod";
import { requireAdmin, logAdminAction, checkResendRateLimit, isSameOrigin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";
const ACTION = "send_password_reset";
const ParamsSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Não autorizado." }, { status: 403 });
  if (!isSameOrigin(request)) return Response.json({ error: "Origem inválida." }, { status: 403 });

  const parsed = ParamsSchema.safeParse(await params);
  if (!parsed.success) return Response.json({ error: "ID inválido." }, { status: 400 });
  const targetUserId = parsed.data.id;

  const service = createServiceClient();
  const { data: userRow, error: userError } = await service.auth.admin.getUserById(targetUserId);
  if (userError || !userRow?.user) return Response.json({ error: "Usuário não encontrado." }, { status: 404 });
  const { email, email_confirmed_at } = userRow.user;
  if (!email_confirmed_at) {
    return Response.json({ error: "Só é possível enviar recuperação para contas já confirmadas." }, { status: 409 });
  }
  if (!email) return Response.json({ error: "Usuário sem e-mail cadastrado." }, { status: 400 });

  const rate = await checkResendRateLimit(targetUserId, ACTION);
  if (!rate.ok) {
    const message = rate.reason === "cooldown" ? "Aguarde 60 segundos antes de tentar novamente." : "Limite de 5 tentativas em 24 horas atingido.";
    await logAdminAction({ actorUserId: admin.userId, targetUserId, action: ACTION, result: "error", safeMetadata: { reason: rate.reason } });
    return Response.json({ error: message }, { status: 429 });
  }

  const redirectTo = `${new URL(request.url).origin}/auth/confirm`;
  const { error: resetError } = await service.auth.resetPasswordForEmail(email, { redirectTo });
  if (resetError) {
    await logAdminAction({ actorUserId: admin.userId, targetUserId, action: ACTION, result: "error", safeMetadata: { message: resetError.message } });
    return Response.json({ error: "Não foi possível enviar a recuperação de senha." }, { status: 500 });
  }

  await logAdminAction({ actorUserId: admin.userId, targetUserId, action: ACTION, result: "success" });
  return Response.json({ ok: true });
}
