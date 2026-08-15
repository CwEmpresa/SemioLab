import { createServiceClient } from "@/lib/supabase/service";
import {
  isKnownCaktoEvent,
  planFromCheckoutUrl,
  statusForEvent,
  timingSafeEqualStrings,
  type CaktoEvent,
} from "@/lib/pro";

export const dynamic = "force-dynamic";

type CaktoPayload = {
  secret?: unknown;
  event?: unknown;
  data?: {
    id?: unknown;
    refId?: unknown;
    checkoutUrl?: unknown;
    customer?: { name?: unknown; email?: unknown; docNumber?: unknown };
    offer?: { id?: unknown; name?: unknown };
    subscription?: { id?: unknown; status?: unknown; next_payment_date?: unknown; canceledAt?: unknown } | null;
  };
};

function badRequest(message: string) {
  return Response.json({ error: message }, { status: 400 });
}

export async function POST(request: Request) {
  let body: CaktoPayload;
  try {
    body = await request.json();
  } catch {
    return badRequest("payload inválido");
  }

  // 1) Nunca confiar no payload sem validar o segredo. A Cakto não assina
  // com HMAC nem envia header de assinatura — a validação oficial é
  // comparar `secret` no CORPO da requisição (docs.cakto.com.br/conceitos/webhooks).
  const receivedSecret = typeof body?.secret === "string" ? body.secret : "";
  const expectedSecret = process.env.CAKTO_WEBHOOK_SECRET || "";
  if (!expectedSecret || !timingSafeEqualStrings(receivedSecret, expectedSecret)) {
    return Response.json({ error: "não autorizado" }, { status: 401 });
  }

  const event = body?.event;
  const data = body?.data;
  if (!isKnownCaktoEvent(event) || !data || typeof data !== "object") {
    return badRequest("evento ou payload não reconhecido");
  }

  const orderRef = String(data.id ?? data.subscription?.id ?? "");
  if (!orderRef) return badRequest("payload sem identificador");

  const supabase = createServiceClient();

  // 2) Idempotência: (order_ref, event) é UNIQUE no banco. Retentativas da
  // Cakto (até 5, por até 8s de timeout) batem aqui e são descartadas sem
  // reprocessar, mas ainda respondemos 2xx para não gerar mais retentativas.
  const redactedPayload = { ...body, secret: undefined };
  const { error: insertEventError } = await supabase.from("payment_events").insert({
    order_ref: orderRef,
    event,
    payload: redactedPayload,
  });

  if (insertEventError) {
    if (insertEventError.code === "23505") {
      return Response.json({ ok: true, duplicate: true });
    }
    console.error("[webhooks/cakto] falha ao registrar evento", insertEventError.message);
    return Response.json({ error: "erro interno" }, { status: 500 });
  }

  try {
    const subscriptionId = await applyEvent(supabase, event, data);
    await supabase
      .from("payment_events")
      .update({ status: "processed", processed_at: new Date().toISOString(), subscription_id: subscriptionId })
      .eq("order_ref", orderRef)
      .eq("event", event);
  } catch (err) {
    await supabase
      .from("payment_events")
      .update({ status: "error", error_message: err instanceof Error ? err.message : "erro desconhecido" })
      .eq("order_ref", orderRef)
      .eq("event", event);
    console.error("[webhooks/cakto] falha ao processar evento", event, err);
    return Response.json({ error: "erro ao processar evento" }, { status: 500 });
  }

  return Response.json({ ok: true });
}

async function applyEvent(
  supabase: ReturnType<typeof createServiceClient>,
  event: CaktoEvent,
  data: NonNullable<CaktoPayload["data"]>,
): Promise<string | null> {
  const customerEmail = typeof data.customer?.email === "string" ? data.customer.email.toLowerCase().trim() : "";
  if (!customerEmail) throw new Error("payload sem e-mail do cliente");

  const status = statusForEvent(event, data.subscription?.status);
  const plan = planFromCheckoutUrl(data.checkoutUrl);

  // Tenta vincular a um usuário já cadastrado pelo e-mail (case-insensitive).
  // Se a pessoa ainda não criou conta no SemioLab, a assinatura fica
  // registrada sem user_id e pode ser vinculada depois.
  const { data: profileMatch } = await supabase
    .from("profiles")
    .select("id")
    .ilike("email", customerEmail)
    .maybeSingle();
  const userId = profileMatch?.id ?? null;

  const fields = {
    customer_email: customerEmail,
    customer_name: typeof data.customer?.name === "string" ? data.customer.name : null,
    customer_doc: typeof data.customer?.docNumber === "string" ? data.customer.docNumber : null,
    cakto_order_id: typeof data.id === "string" ? data.id : null,
    cakto_ref_id: typeof data.refId === "string" ? data.refId : null,
    cakto_subscription_id: typeof data.subscription?.id === "string" ? data.subscription.id : null,
    offer_id: typeof data.offer?.id === "string" ? data.offer.id : null,
    offer_name: typeof data.offer?.name === "string" ? data.offer.name : null,
    status,
    next_payment_date:
      typeof data.subscription?.next_payment_date === "string" ? data.subscription.next_payment_date : null,
    canceled_at:
      event === "subscription_canceled"
        ? new Date().toISOString()
        : typeof data.subscription?.canceledAt === "string"
          ? data.subscription.canceledAt
          : null,
  };
  // plano só é sobrescrito quando identificado com certeza (evita apagar um
  // valor já conhecido com "unknown" em eventos que não trazem checkoutUrl)
  const planField = plan !== "unknown" ? { plan } : {};

  const matchColumn = userId ? "user_id" : "customer_email";
  const matchValue = userId ?? customerEmail;
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, started_at")
    .eq(matchColumn, matchValue)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("subscriptions")
      .update({ ...fields, ...planField, user_id: userId ?? undefined })
      .eq("id", existing.id);
    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("subscriptions")
    .insert({
      user_id: userId,
      ...fields,
      plan: plan === "unknown" ? "unknown" : plan,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return inserted?.id ?? null;
}
