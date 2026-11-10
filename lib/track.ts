/** Registro de eventos de produto no cliente — alimenta o painel de
 * comportamento do admin (rota entre telas, paywall, abandono).
 *
 * Nunca envia conteúdo clínico, mensagem, e-mail ou token: só o nome do
 * evento e metadados curtos de uma lista fechada (validados no servidor,
 * app/api/events/route.ts). Falha em silêncio: medir nunca pode atrapalhar
 * o estudo. */
export type TrackEvent =
  | "screen_viewed"
  | "paywall_shown"
  | "consult_abandoned"
  | "checkout_clicked";

type TrackMeta = { screen?: string; reason?: string; step?: string; plan?: "monthly" | "annual" };

export function track(eventName: TrackEvent, source: string, safeMetadata?: TrackMeta) {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ eventName, source, safeMetadata });
    // keepalive: o evento ainda sai mesmo se a pessoa fechar a aba em seguida
    // — justamente o momento que mais interessa para entender abandono.
    fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* medir nunca pode quebrar a tela */
  }
}
