import { createServiceClient } from "@/lib/supabase/service";
import { timingSafeEqualStrings } from "@/lib/pro";
import { buildLifecycleEmail, emailConfigured, sendEmail, type LifecycleKind } from "@/lib/lifecycle-email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Teto por execução: cabe no plano gratuito do Resend (100 e-mails/dia)
 * e no tempo máximo da função. O que sobrar entra no dia seguinte, enquanto
 * a pessoa ainda estiver na janela do e-mail. */
const MAX_PER_RUN = 90;

type Candidate = { user_id: string; email: string; name: string | null; kind: LifecycleKind; finished_consult: boolean };

async function handle(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret) return Response.json({ error: "CRON_SECRET não configurado — job inacessível." }, { status: 503 });
  const auth = request.headers.get("authorization") ?? "";
  if (!timingSafeEqualStrings(auth, `Bearer ${secret}`)) return Response.json({ error: "Não autorizado." }, { status: 401 });

  // Sem provedor configurado nada é enviado NEM marcado como enviado: no
  // dia em que a chave entrar, quem ainda está na janela recebe.
  if (!emailConfigured()) {
    return Response.json({ ok: true, skipped: "RESEND_API_KEY/EMAIL_FROM não configurados." });
  }

  const service = createServiceClient();
  const { data, error } = await service.rpc("lifecycle_email_candidates");
  if (error) {
    return Response.json({ error: "Função lifecycle_email_candidates indisponível — aplique a migração 20261111." }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;
  let skippedDuplicate = 0;
  for (const candidate of ((data ?? []) as Candidate[]).slice(0, MAX_PER_RUN)) {
    // Reserva antes de enviar (índice único user_id+kind): duas execuções
    // concorrentes nunca mandam o mesmo e-mail duas vezes.
    const { error: claimError } = await service.from("lifecycle_emails").insert({ user_id: candidate.user_id, kind: candidate.kind });
    if (claimError) { skippedDuplicate += 1; continue; }

    const email = buildLifecycleEmail({
      kind: candidate.kind,
      userId: candidate.user_id,
      name: candidate.name,
      finishedConsult: candidate.finished_consult,
    });
    const ok = await sendEmail({ to: candidate.email, ...email }).catch(() => false);
    if (ok) {
      sent += 1;
    } else {
      // Falhou: libera a reserva para tentar de novo na próxima execução.
      failed += 1;
      await service.from("lifecycle_emails").delete().eq("user_id", candidate.user_id).eq("kind", candidate.kind);
    }
  }

  return Response.json({ ok: true, candidates: (data ?? []).length, sent, failed, skippedDuplicate });
}

// A Vercel Cron dispara via GET com o cabeçalho Authorization (CRON_SECRET);
// POST fica disponível para disparo manual com a mesma proteção.
export async function GET(request: Request) {
  return handle(request);
}
export async function POST(request: Request) {
  return handle(request);
}
