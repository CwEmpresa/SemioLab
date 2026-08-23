import { createServiceClient } from "@/lib/supabase/service";
import { resolveUserAccess } from "@/lib/user-access";
import { brasiliaDateKey, startOfBrasiliaDayUtc } from "@/lib/ai-usage";
import { getWebPush, DEEP_LINKS, NOTIFICATION_MESSAGES } from "@/lib/push";
import { MAX_SESSIONS_PER_DAY } from "@/lib/patient-ai-rules";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Kind = keyof typeof NOTIFICATION_MESSAGES;

async function pickMessage(
  service: ReturnType<typeof createServiceClient>,
  userId: string,
  slot: "morning" | "evening",
): Promise<Kind | null> {
  const access = await resolveUserAccess(
    // resolveUserAccess espera o client tipado do server; aqui usamos o
    // service role só para leitura, com filtro sempre travado no userId.
    service as unknown as Parameters<typeof resolveUserAccess>[0],
    userId,
  );
  const startOfDay = startOfBrasiliaDayUtc();

  if (slot === "morning") {
    if (access.tier === "free") return "streak"; // Free nunca recebe convite a recurso bloqueado
    const consultationLimit = Math.min(MAX_SESSIONS_PER_DAY, access.limits.consultationsPerDay);
    const { count: sessionsToday } = await service
      .from("patient_sessions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("started_at", startOfDay);
    if ((sessionsToday ?? 0) < consultationLimit) return "patient";

    const { count: simuladosToday } = await service
      .from("simulado_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("started_at", startOfDay);
    if ((simuladosToday ?? 0) < access.limits.simuladosPerDay) return "simulado";

    return "streak"; // já concluiu tudo disponível hoje — nunca convida pra algo já feito
  }

  // slot === "evening"
  const { data: loginToday } = await service
    .from("login_days")
    .select("activity_date")
    .eq("user_id", userId)
    .eq("activity_date", brasiliaDateKey())
    .maybeSingle();
  if (!loginToday) return "streak"; // risco real de perder o streak hoje

  if (access.limits.auscultationAllowed) return "auscultation";
  return null; // Free, já logou hoje: nada útil e não bloqueado para oferecer
}

export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return Response.json({ error: "Não autorizado." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { slot?: string };
  if (body.slot !== "morning" && body.slot !== "evening") {
    return Response.json({ error: "slot inválido." }, { status: 400 });
  }
  const slot = body.slot;

  const service = createServiceClient();
  let webpush;
  try {
    webpush = getWebPush();
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "VAPID não configurado." }, { status: 503 });
  }

  const today = brasiliaDateKey();
  const { data: subsByUser } = await service.from("push_subscriptions").select("id, user_id, endpoint, p256dh, auth_key");
  const userIds = [...new Set((subsByUser ?? []).map((s) => s.user_id))];

  let sent = 0;
  let skippedDuplicate = 0;
  let skippedNoMessage = 0;
  let removedInvalid = 0;

  for (const userId of userIds) {
    // Reserva o slot ATOMICAMENTE antes de enviar — nunca 2 disparos no
    // mesmo dia+slot para o mesmo usuário, mesmo com execuções concorrentes
    // (índice único em user_id+delivery_date+slot).
    const kind = await pickMessage(service, userId, slot);
    if (!kind) { skippedNoMessage += 1; continue; }

    const { error: claimError } = await service
      .from("notification_deliveries")
      .insert({ user_id: userId, delivery_date: today, slot, message_kind: kind });
    if (claimError) { skippedDuplicate += 1; continue; } // conflito = já enviado hoje nesse slot

    const message = NOTIFICATION_MESSAGES[kind];
    const url = DEEP_LINKS[kind];
    const subs = (subsByUser ?? []).filter((s) => s.user_id === userId);
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          JSON.stringify({ title: message.title, body: message.body, url }),
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await service.from("push_subscriptions").delete().eq("id", sub.id);
          removedInvalid += 1;
        }
      }
    }
  }

  return Response.json({ ok: true, slot, usersConsidered: userIds.length, sent, skippedDuplicate, skippedNoMessage, removedInvalid });
}
