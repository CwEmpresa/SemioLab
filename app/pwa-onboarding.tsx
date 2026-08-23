"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

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

export default function PwaOnboarding({ userId }: { userId: string }) {
  const [step, setStep] = useState<"hidden" | "notifications" | "install">(() => {
    if (typeof window === "undefined" || isStandalone()) return "hidden"; // já instalado, sem onboarding
    return localStorage.getItem(`semiolab:${userId}:pwa-onboarding-seen`) ? "hidden" : "notifications";
  });
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferredPrompt(e); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const finish = () => {
    localStorage.setItem(`semiolab:${userId}:pwa-onboarding-seen`, "1");
    setStep("hidden");
  };

  useModalBodyLock(step !== "hidden");
  if (step === "hidden") return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="overlay pwa-modal-overlay" onMouseDown={finish}>
      <section className="clinical-modal pwa-onboarding-modal" onMouseDown={(e) => e.stopPropagation()}>
        {step === "notifications" ? (
          <>
            <h2>Ativar notificações?</h2>
            <p>Avisamos quando um novo paciente ou simulado estiver disponível, e lembramos você antes de perder o streak — no máximo 2 avisos por dia.</p>
            <button className="primary" onClick={async () => { await enablePushNotifications(); setStep("install"); }}>Ativar notificações</button>
            <button onClick={() => setStep("install")}>Agora não</button>
          </>
        ) : (
          <>
            <h2>Instale o SemioLab</h2>
            <InstallSteps />
            {!isIos() && deferredPrompt && (
              <button className="primary" onClick={async () => { (deferredPrompt as unknown as { prompt: () => void }).prompt(); finish(); }}>Instalar agora</button>
            )}
            <button onClick={finish}>Concluir</button>
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
