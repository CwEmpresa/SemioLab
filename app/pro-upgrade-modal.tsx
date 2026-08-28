"use client";

import { useEffect, useState } from "react";
import { pwaInstallPending } from "./pwa-onboarding";
import { createPortal } from "react-dom";
import { ArrowLeft, Check, HeartPulse, ShieldCheck, Sparkles, X } from "lucide-react";
import { useLearningSummary } from "./use-learning-summary";

export type ProUpgradeReason = "daily" | "patient" | "simulado" | "auscultation" | "audio" | "limit" | "backend";

const REASON_COPY: Record<ProUpgradeReason, { small: string; title: string; subtitle: string }> = {
  daily: { small: "SEMIOLAB PRO", title: "Desbloqueie o SemioLab Pro", subtitle: "Aprenda, pratique e evolua todos os dias." },
  patient: { small: "RECURSO PRO", title: "Recurso exclusivo do Pro", subtitle: "O Paciente Virtual é um recurso do plano Pro (ou do período de teste)." },
  simulado: { small: "RECURSO PRO", title: "Recurso exclusivo do Pro", subtitle: "Simulados são um recurso do plano Pro (ou do período de teste)." },
  auscultation: { small: "RECURSO PRO", title: "Recurso exclusivo do Pro", subtitle: "O Laboratório de Ausculta é um recurso do plano Pro (ou do período de teste)." },
  audio: { small: "RECURSO PRO", title: "Recurso exclusivo do Pro", subtitle: "Perguntar por voz e ouvir o paciente são recursos exclusivos do plano Pro." },
  limit: { small: "LIMITE DIÁRIO", title: "Seu limite diário acabou", subtitle: "Volte amanhã ou assine o Pro para continuar agora mesmo." },
  backend: { small: "RECURSO PRO", title: "Recurso exclusivo do Pro", subtitle: "Esse recurso não está disponível no seu plano atual." },
};

const EVENT_NAME = "semiolab:open-pro-upgrade";

/** Dispara o modal de qualquer lugar do app, sem precisar de contexto —
 * mesmo padrão já usado pelo evento "semiolab:learning-updated". */
export function openProUpgradeModal(reason: ProUpgradeReason = "backend") {
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { reason } }));
}

function brasiliaDateKey(): string {
  const BRASILIA_OFFSET_MS = 3 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() - BRASILIA_OFFSET_MS);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`;
}

const POPUP_VERSION = "v1";

const LIMIT_INFO_EVENT = "semiolab:open-daily-limit-info";

/** Modal separado só pra Pro batendo no limite diário — nunca é o
 * ProUpgradeModal, nunca mostra checkout, é só um aviso informativo. */
export function openDailyLimitInfo() {
  window.dispatchEvent(new CustomEvent(LIMIT_INFO_EVENT));
}

export function DailyLimitInfoModal() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener(LIMIT_INFO_EVENT, handler);
    return () => window.removeEventListener(LIMIT_INFO_EVENT, handler);
  }, []);
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("pwa-modal-open");
    return () => document.body.classList.remove("pwa-modal-open");
  }, [open]);
  if (!open || typeof document === "undefined") return null;
  const close = () => setOpen(false);
  return createPortal(
    <div className="overlay pwa-modal-overlay" onMouseDown={close}>
      <section className="clinical-modal daily-limit-info-modal" onMouseDown={(e) => e.stopPropagation()}>
        <h2>Limite diário atingido</h2>
        <p>Novos atendimentos estarão disponíveis amanhã.</p>
        <button className="primary" onClick={close}>Entendi</button>
      </section>
    </div>,
    document.body,
  );
}

export default function ProUpgradeModal({ userId }: { userId: string }) {
  const { summary: learning } = useLearningSummary();
  const [reason, setReason] = useState<ProUpgradeReason | null>(null);
  const [installResolvedTick, setInstallResolvedTick] = useState(0);
  const [plan, setPlan] = useState<"monthly" | "annual">("annual");
  const [checkoutLoading, setCheckoutLoading] = useState<"monthly" | "annual" | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ reason: ProUpgradeReason }>).detail;
      setReason(detail?.reason ?? "backend");
    };
    window.addEventListener(EVENT_NAME, handler);
    return () => window.removeEventListener(EVENT_NAME, handler);
  }, []);

  // Gatilho diário: Free sempre; Trial só a partir do 3º dia (trialDaysLeft
  // <= 5 de um total de 7); Pro nunca. Uma vez por dia (Brasília) por
  // usuário, via localStorage — nunca compartilhado entre contas.
  useEffect(() => {
    if (!learning?.pro || reason) return;
    // Nunca junto com o modal de instalação — instalação sempre vem
    // primeiro, na ordem exclusiva de popups.
    if (pwaInstallPending(userId)) return;
    const tier = learning.pro.tier;
    const eligible = tier === "free" || (tier === "trial" && (learning.pro.trialDaysLeft ?? 7) <= 5);
    if (!eligible) return;
    const key = `semiolab:${userId}:pro-upgrade-seen:${brasiliaDateKey()}:${POPUP_VERSION}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    const timer = window.setTimeout(() => setReason("daily"), 0);
    return () => window.clearTimeout(timer);
  }, [learning?.pro, userId, reason, installResolvedTick]);

  useEffect(() => {
    // Reavalia o gatilho diário assim que a instalação for resolvida —
    // sem isso, ficaria bloqueado até o próximo recarregamento.
    const bump = () => setInstallResolvedTick((n) => n + 1);
    window.addEventListener("semiolab:pwa-install-resolved", bump);
    return () => window.removeEventListener("semiolab:pwa-install-resolved", bump);
  }, []);

  useEffect(() => {
    if (!reason) return;
    document.body.classList.add("pwa-modal-open");
    return () => document.body.classList.remove("pwa-modal-open");
  }, [reason]);

  if (!reason || typeof document === "undefined") return null;
  const copy = REASON_COPY[reason];
  const checkoutUrls = learning?.pro?.checkoutUrls;
  const close = () => setReason(null);

  return createPortal(
    <div className="overlay pro-offer-overlay pwa-modal-overlay" onMouseDown={close}>
      <section className="premium-modal pro-offer" onMouseDown={(e) => e.stopPropagation()}>
        <header className="pro-offer-topbar">
          <button aria-label="Voltar" onClick={close}><ArrowLeft /></button>
          <button aria-label="Fechar oferta" onClick={close}><X /></button>
        </header>
        <div className="pro-offer-hero">
          <span className="pro-medical-cross" aria-hidden="true" />
          <span className="pro-organ-line" aria-hidden="true"><HeartPulse /></span>
          <img src="/semiolab-pro-fox.webp" alt="Raposa médica do SemioLab" width="560" height="560" decoding="sync" />
        </div>
        <div className="pro-offer-sheet">
          <div className="pro-offer-title">
            <small>{copy.small}</small>
            <h2>{copy.title}</h2>
            <p>{copy.subtitle}</p>
            {learning?.pro?.tier === "trial" && (
              <p className="pro-trial-days">Faltam {learning.pro.trialDaysLeft ?? 0} dia{(learning.pro.trialDaysLeft ?? 0) === 1 ? "" : "s"} do seu período de teste.</p>
            )}
          </div>
          <div className="pro-benefits">
            <span><i><Check /></i>3 atendimentos por dia com o Paciente Virtual</span>
            <span><i><Check /></i>3 simulados por dia, sem repetir questão</span>
            <span><i><Check /></i>Exames ilimitados por atendimento</span>
            <span><i><Check /></i>Pergunte por voz e ouça a resposta do paciente</span>
            <span><i><Check /></i>Laboratório de Ausculta liberado</span>
          </div>
          <div className="pro-plans" role="radiogroup" aria-label="Escolha o plano">
            <button className={plan === "monthly" ? "selected" : ""} onClick={() => setPlan("monthly")} role="radio" aria-checked={plan === "monthly"}>
              <span className="pro-plan-head">
                <i>{plan === "monthly" && <Check />}</i>
                <small>MENSAL</small>
              </span>
              <span className="pro-plan-copy">Flexibilidade para começar</span>
              <b className="pro-plan-price"><em>R$</em> 29,90 <span>/mês</span></b>
              <span className="pro-plan-billing">Cobrança mensal</span>
            </button>
            <button className={`recommended ${plan === "annual" ? "selected" : ""}`} onClick={() => setPlan("annual")} role="radio" aria-checked={plan === "annual"}>
              <strong className="pro-best-badge"><Sparkles /> MELHOR ESCOLHA</strong>
              <span className="pro-plan-head">
                <i>{plan === "annual" && <Check />}</i>
                <small>ANUAL</small>
              </span>
              <span className="pro-plan-copy">Acesso completo por 12 meses</span>
              <b className="pro-plan-price"><em>R$</em> 199,90 <span>/ano</span></b>
              <span className="pro-plan-equivalent">equivale a <b>R$ 16,66/mês</b></span>
            </button>
          </div>
          {checkoutUrls ? (
            <a
              className="pro-unlock"
              href={checkoutLoading ? undefined : checkoutUrls[plan]}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!!checkoutLoading}
              onClick={(e) => {
                if (checkoutLoading) { e.preventDefault(); return; }
                setCheckoutLoading(plan);
                window.setTimeout(() => setCheckoutLoading(null), 2500);
                // Fire-and-forget: falha na telemetria nunca bloqueia o
                // link real de checkout, que já abre normalmente (href).
                fetch("/api/events", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ eventName: "checkout_clicked", source: "pro_upgrade_modal", safeMetadata: { plan, reason } }),
                }).catch(() => {});
              }}
            >
              {checkoutLoading ? "Abrindo checkout..." : "QUERO DESBLOQUEAR O PRO"}
            </a>
          ) : (
            <span className="pro-unlock" aria-disabled="true">Carregando checkout...</span>
          )}
          <p className="pro-cancel"><ShieldCheck /> Cancele quando quiser</p>
          <button className="pro-continue" onClick={close}>Continuar no plano gratuito</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
