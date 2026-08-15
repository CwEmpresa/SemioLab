import crypto from "node:crypto";

// URLs de checkout reais — NÃO alterar. Usadas tanto para exibir a oferta
// quanto para identificar o plano (mensal/anual) a partir de
// `data.checkoutUrl` no payload do webhook da Cakto.
export const CAKTO_CHECKOUT_URLS = {
  monthly: "https://pay.cakto.com.br/hf4wgnz_1041214",
  annual: "https://pay.cakto.com.br/pdgqt5d",
} as const;

export type Plan = "monthly" | "annual" | "unknown";
export type SubStatus =
  | "pending"
  | "active"
  | "trial"
  | "past_due"
  | "paused"
  | "canceled"
  | "expired"
  | "refunded"
  | "chargeback";

// Status que concedem acesso Pro. "past_due" (falha de renovação) NÃO
// concede acesso — assunção conservadora, sem período de graça, já que a
// Cakto não especifica um comportamento padrão para isso.
export const PRO_ACTIVE_STATUSES: ReadonlySet<SubStatus> = new Set(["active", "trial"]);

// Catálogo oficial de eventos do webhook da Cakto (docs.cakto.com.br/conceitos/webhooks).
// Eventos de checkout/cobrança-gerada (initiate_checkout, checkout_abandonment,
// pix_gerado, boleto_gerado, picpay_gerado, openfinance_nubank_gerado,
// purchase_refused) não afetam o acesso Pro e são apenas registrados.
export const CAKTO_EVENTS = [
  "initiate_checkout",
  "checkout_abandonment",
  "purchase_approved",
  "purchase_refused",
  "pix_gerado",
  "boleto_gerado",
  "picpay_gerado",
  "openfinance_nubank_gerado",
  "chargeback",
  "refund",
  "subscription_created",
  "subscription_renewed",
  "subscription_renewal_refused",
  "subscription_paused",
  "subscription_resumed",
  "subscription_canceled",
] as const;
export type CaktoEvent = (typeof CAKTO_EVENTS)[number];

export function isKnownCaktoEvent(value: unknown): value is CaktoEvent {
  return typeof value === "string" && (CAKTO_EVENTS as readonly string[]).includes(value);
}

// Eventos que de fato alteram o status da assinatura/acesso Pro.
const STATUS_BY_EVENT: Partial<Record<CaktoEvent, SubStatus>> = {
  purchase_approved: "active",
  subscription_created: "active",
  subscription_renewed: "active",
  subscription_renewal_refused: "past_due",
  subscription_paused: "paused",
  subscription_resumed: "active",
  subscription_canceled: "canceled",
  refund: "refunded",
  chargeback: "chargeback",
};

// Estados possíveis de `data.subscription.status` na API da Cakto
// (docs.cakto.com.br/api-reference/subscriptions/retrieve). Usado quando o
// payload já traz o objeto subscription embutido, para não perder
// granularidade (ex.: "trial").
const CAKTO_SUBSCRIPTION_STATUS: Record<string, SubStatus> = {
  active: "active",
  trial: "trial",
  paused: "paused",
  canceled: "canceled",
  expired: "expired",
  inactive: "expired",
};

/** Deriva o status interno a partir do evento recebido e, se presente, do
 * objeto `data.subscription` embutido no payload. */
export function statusForEvent(event: CaktoEvent, subscriptionStatus?: unknown): SubStatus {
  if (typeof subscriptionStatus === "string" && subscriptionStatus in CAKTO_SUBSCRIPTION_STATUS) {
    // subscription_canceled/refund/chargeback são fatos definitivos: o
    // evento manda mais que o snapshot de status embutido.
    if (event === "subscription_canceled" || event === "refund" || event === "chargeback") {
      return STATUS_BY_EVENT[event] as SubStatus;
    }
    return CAKTO_SUBSCRIPTION_STATUS[subscriptionStatus];
  }
  return STATUS_BY_EVENT[event] ?? "pending";
}

export function isProActive(status: string | null | undefined): boolean {
  return !!status && PRO_ACTIVE_STATUSES.has(status as SubStatus);
}

/** Identifica mensal/anual comparando `data.checkoutUrl` com as URLs reais
 * de checkout. Nunca inventa um plano: se não bater, retorna "unknown". */
export function planFromCheckoutUrl(checkoutUrl: unknown): Plan {
  if (typeof checkoutUrl !== "string") return "unknown";
  const normalized = checkoutUrl.trim().replace(/\/+$/, "");
  if (normalized === CAKTO_CHECKOUT_URLS.monthly) return "monthly";
  if (normalized === CAKTO_CHECKOUT_URLS.annual) return "annual";
  return "unknown";
}

/** Comparação em tempo constante — mesma técnica recomendada na
 * documentação oficial da Cakto (docs.cakto.com.br/conceitos/webhooks). */
export function timingSafeEqualStrings(received: string, expected: string): boolean {
  const a = Buffer.from(received || "");
  const b = Buffer.from(expected || "");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
