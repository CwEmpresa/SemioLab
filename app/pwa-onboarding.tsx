"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { firstExperienceCompletionAcknowledged } from "./first-experience";
import { getDeferredInstallPrompt, consumeDeferredInstallPrompt, subscribeInstallPrompt } from "./pwa-install-prompt";

/** Trava o scroll da página e some com a bottom-nav enquanto qualquer
 * modal PWA estiver aberto — restaura tudo ao fechar/desmontar. */
function useModalBodyLock(active: boolean) {
  useEffect(() => {
    if (!active) return;
    document.body.classList.add("pwa-modal-open");
    return () => document.body.classList.remove("pwa-modal-open");
  }, [active]);
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

function isIos() {
  return typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isAndroid() {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}
function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/** Passo a passo numerado — mostra só o do dispositivo detectado. */
function InstallSteps() {
  const steps = isIos()
    ? ["Toque em Compartilhar (ícone com uma seta) na barra do Safari.", "Toque em \"Adicionar à Tela de Início\".", "Toque em \"Adicionar\".", "Abra o SemioLab pelo ícone criado na tela inicial.", "Dentro do app instalado, ative as notificações — no iPhone elas só funcionam assim."]
    : isAndroid()
    ? ["Toque nos três pontinhos do menu do navegador.", "Toque em \"Instalar app\" (ou \"Adicionar à tela inicial\").", "Toque em \"Instalar\".", "Abra o SemioLab pelo ícone criado."]
    : ["Clique no ícone de instalação na barra de endereço do navegador.", "Clique em \"Instalar\"."];
  return (
    <ol className="pwa-install-steps">
      {steps.map((step, i) => <li key={i}><b>{i + 1}</b><span>{step}</span></li>)}
    </ol>
  );
}

/** Ativa notificações: pede permissão (só quando chamado por clique real,
 * nunca automaticamente), registra o service worker e inscreve no Web
 * Push. Retorna o resultado para a UI decidir o que mostrar. */
export async function enablePushNotifications(): Promise<"granted" | "denied" | "unsupported" | "error"> {
  if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return "unsupported";
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return "denied";
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return "error";
    const subscription =
      (await registration.pushManager.getSubscription()) ||
      (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    const json = subscription.toJSON();
    await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
    });
    return "granted";
  } catch {
    return "error";
  }
}

/** Painel reutilizável (usado no onboarding e permanentemente no Perfil). */
export function NotificationSettingsPanel() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(() =>
    typeof window === "undefined" ? "default" : "Notification" in window ? Notification.permission : "unsupported",
  );
  const [busy, setBusy] = useState(false);

  const activate = async () => {
    setBusy(true);
    const result = await enablePushNotifications();
    setPermission(result === "unsupported" ? "unsupported" : "Notification" in window ? Notification.permission : "denied");
    setBusy(false);
  };

  return (
    <div className="pwa-settings-panel">
      <h3>Notificações</h3>
      {permission === "unsupported" && <p>Seu navegador não suporta notificações push.</p>}
      {permission === "granted" && <p>Notificações ativadas neste dispositivo.</p>}
      {permission === "denied" && <p>Notificações bloqueadas. Ative manualmente nas configurações do navegador para receber avisos.</p>}
      {permission === "default" && (
        <>
          <p>Receba até 2 avisos por dia: um novo paciente/simulado pela manhã e um lembrete à noite.</p>
          <button className="primary" disabled={busy} onClick={activate}>{busy ? "Ativando..." : "Ativar notificações"}</button>
        </>
      )}
      <h3 style={{ marginTop: 18 }}>Como instalar o app</h3>
      <InstallSteps />
    </div>
  );
}

const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000; // reaparece depois, nunca em todo reload

export function pwaInstallPending(userId: string): boolean {
  if (typeof window === "undefined") return false;
  if (isStandalone()) return false;
  if (localStorage.getItem(`semiolab:${userId}:pwa-installed:v2`)) return false;
  const dismissedUntil = Number(localStorage.getItem(`semiolab:${userId}:pwa-install-dismissed-until:v2`) || 0);
  if (dismissedUntil && Date.now() < dismissedUntil) return false;
  return firstExperienceCompletionAcknowledged(userId);
}

export default function PwaOnboarding({ userId }: { userId: string }) {
  const [step, setStep] = useState<"hidden" | "install" | "notifications">("hidden");
  // "checking": navegador ainda pode disparar o evento a qualquer momento;
  // "ready": instalação nativa real disponível; "unavailable": não vai vir
  // (timeout ou iOS/incompatível) — nunca mostra botão falso de instalar.
  const [nativeState, setNativeState] = useState<"checking" | "ready" | "unavailable">(() =>
    isIos() ? "unavailable" : getDeferredInstallPrompt() ? "ready" : "checking",
  );
  const [installBusy, setInstallBusy] = useState(false);

  useEffect(() => {
    // Prioridade exclusiva: 1) instalação, 2) notificações só depois da
    // instalação confirmada (na próxima abertura do PWA já instalado),
    // 3) nunca os dois juntos. Reavalia sem precisar recarregar a página.
    const checkInstall = () => {
      if (pwaInstallPending(userId)) setStep("install");
    };
    const checkNotifications = () => {
      if (!isStandalone()) return; // nunca pede fora do PWA instalado
      if (!localStorage.getItem(`semiolab:${userId}:pwa-notif-pending`)) return;
      if (typeof Notification === "undefined" || Notification.permission !== "default") {
        // já decidido (concedido/negado) por outro caminho — nunca pede de novo
        localStorage.removeItem(`semiolab:${userId}:pwa-notif-pending`);
        return;
      }
      setStep((s) => (s === "install" ? s : "notifications"));
    };
    checkInstall();
    checkNotifications();
    window.addEventListener("semiolab:first-experience-completed", checkInstall);
    return () => window.removeEventListener("semiolab:first-experience-completed", checkInstall);
  }, [userId]);

  useEffect(() => {
    // Continua "avaliando instalabilidade" só enquanto o popup de
    // instalação está de fato aberto — nunca trava a interface: timeout
    // curto libera "Continuar no navegador" se o evento não vier.
    if (step !== "install" || nativeState !== "checking") return;
    if (getDeferredInstallPrompt()) {
      const already = window.setTimeout(() => setNativeState("ready"), 0); // já tinha chegado antes de abrir
      return () => window.clearTimeout(already);
    }
    const unsubscribe = subscribeInstallPrompt(() => setNativeState("ready"));
    const timeout = window.setTimeout(() => setNativeState((s) => (s === "ready" ? s : "unavailable")), 1800);
    return () => { unsubscribe(); window.clearTimeout(timeout); };
  }, [step, nativeState]);

  const finishInstall = (accepted: boolean) => {
    if (accepted) {
      localStorage.setItem(`semiolab:${userId}:pwa-installed:v2`, "1");
      localStorage.removeItem(`semiolab:${userId}:pwa-install-dismissed-until:v2`);
      // Não pede notificação agora — só marca pendente para a próxima
      // abertura já dentro do PWA instalado (display-mode: standalone).
      localStorage.setItem(`semiolab:${userId}:pwa-notif-pending`, "1");
    } else {
      // Recusou/fechou: reaparece depois, nunca em todo reload nem nunca
      // mais — nunca marcado como instalado.
      localStorage.setItem(`semiolab:${userId}:pwa-install-dismissed-until:v2`, String(Date.now() + DISMISS_COOLDOWN_MS));
    }
    setStep("hidden");
    // Libera outros popups (ex.: Pro diário) que ficaram bloqueados
    // esperando a instalação ser resolvida.
    window.dispatchEvent(new Event("semiolab:pwa-install-resolved"));
  };

  const handleNativeInstall = async () => {
    const promptEvent = getDeferredInstallPrompt();
    if (!promptEvent || installBusy) return;
    setInstallBusy(true);
    try {
      // Só chamado por clique real do usuário — nunca automaticamente.
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice.catch(() => ({ outcome: "dismissed" as const }));
      consumeDeferredInstallPrompt(); // nunca reutilizável
      finishInstall(choice.outcome === "accepted");
    } finally {
      setInstallBusy(false);
    }
  };
  const finishNotifications = () => setStep("hidden");

  useModalBodyLock(step !== "hidden");
  if (step === "hidden") return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="overlay pwa-modal-overlay" onMouseDown={() => (step === "install" ? finishInstall(false) : finishNotifications())}>
      <section className="clinical-modal pwa-onboarding-modal" onMouseDown={(e) => e.stopPropagation()}>
        {step === "install" ? (
          <>
            <h2>Instale o SemioLab</h2>
            {nativeState === "checking" ? (
              <p className="pwa-install-checking">Preparando instalação...</p>
            ) : (
              <InstallSteps />
            )}
            {nativeState === "ready" && (
              <button className="primary" disabled={installBusy} onClick={handleNativeInstall}>
                {installBusy ? "Abrindo..." : "Instalar o SemioLab"}
              </button>
            )}
            <button onClick={() => finishInstall(isStandalone())}>
              {nativeState === "ready" ? "Agora não" : "Continuar no navegador"}
            </button>
          </>
        ) : (
          <>
            <h2>Ativar notificações?</h2>
            <p>Avisamos quando um novo paciente ou simulado estiver disponível, e lembramos você antes de perder o streak — no máximo 2 avisos por dia.</p>
            <button className="primary" onClick={async () => { await enablePushNotifications(); finishNotifications(); }}>Ativar notificações</button>
            <button onClick={finishNotifications}>Agora não</button>
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
