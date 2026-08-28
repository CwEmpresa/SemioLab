"use client";

/** Captura o `beforeinstallprompt` assim que este módulo é importado — o
 * mais cedo possível na árvore (ver app-gate.tsx), antes de qualquer
 * componente que possa precisar dele existir. O navegador só dispara esse
 * evento uma vez por carregamento e ele não pode ser reconstruído depois,
 * então perder a captura aqui significa nunca mais ter instalação nativa
 * real disponível naquela sessão. */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let listenerAttached = false;
const subscribers = new Set<() => void>();

function attach() {
  if (listenerAttached || typeof window === "undefined") return;
  listenerAttached = true; // nunca duplica o listener, mesmo se o módulo for importado várias vezes
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    subscribers.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
  });
}
attach();

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

/** O evento não pode ser reutilizado depois de chamado prompt() — consome
 * explicitamente para nunca tentar de novo com o mesmo evento. */
export function consumeDeferredInstallPrompt() {
  deferredPrompt = null;
}

export function subscribeInstallPrompt(cb: () => void): () => void {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}
