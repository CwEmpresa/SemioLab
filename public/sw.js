// Versionado: mudar este valor força a limpeza de caches antigos no
// próximo activate, sem prender ninguém numa versão velha.
const CACHE_VERSION = "semiolab-static-v1";

// Só isto pode ser cacheado — nunca /api/*, nunca a página raiz (que é
// renderizada no servidor com dados de sessão/autenticação), nunca nada
// que possa conter dado de usuário.
function isCacheableStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/manifest.json" ||
    url.pathname === "/favicon.svg" ||
    /^\/(icon-|semiolab-).*\.(png|webp|svg)$/.test(url.pathname)
  );
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET" || !isCacheableStaticAsset(url)) return; // nunca intercepta o resto
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      const cached = await cache.match(event.request);
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) cache.put(event.request, response.clone());
      return response;
    })(),
  );
});

// --- Web Push -------------------------------------------------------
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const title = payload.title || "SemioLab";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = allClients.find((c) => "focus" in c);
      if (existing) {
        existing.navigate(targetUrl);
        existing.focus();
        return;
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
