"use client";

import { useEffect, useState } from "react";

export type MasteryRecord = {
  topic: string;
  score: number | null;
  status: string;
  questions: number;
  consultations: number;
  reviews: number;
  sources: string[];
  lastActivity: number | null;
};

export type ProStatus = {
  plan: "monthly" | "annual" | "unknown";
  status: string;
  active: boolean;
  nextPaymentDate: string | null;
  canceledAt: string | null;
  checkoutUrls: { monthly: string; annual: string };
  tier: "trial" | "free" | "pro";
  trialDaysLeft: number;
};

export type RecentConsultation = {
  id: string;
  finishedAt: number | null;
  score: number;
  level: string;
  title: string;
  patientName: string;
  patientAge: number;
  hypothesis: string;
  strengths: string[];
  gaps: string[];
  examLearning: string[];
};

export type LearningSummary = {
  profile?: { xp?: number };
  mastery?: MasteryRecord[];
  stats?: { attempts?: number; questions?: number; correct?: number; consultations?: number; activities?: number; averageScore?: number };
  loginDays?: string[];
  streak?: number;
  weeklyActivity?: number[];
  recentConsultations?: RecentConsultation[];
  pro?: ProStatus;
};

/** Cache em memória (só dura enquanto a página está aberta — nunca
 * localStorage/sessionStorage) + deduplicação de requisições simultâneas.
 * Várias telas chamam useLearningSummary() ao mesmo tempo (menu lateral,
 * Home, Progresso etc.) — sem isso, cada uma disparava sua própria
 * requisição a /api/learning para o MESMO dado, multiplicando chamadas de
 * rede à toa e atrasando a primeira renderização. Como o app faz um
 * reload completo (window.location.assign) ao trocar de conta, este cache
 * nunca sobrevive entre usuários diferentes. */
let cachedSummary: LearningSummary | null = null;
let cachedAt = 0;
let inFlight: Promise<LearningSummary | null> | null = null;
const CACHE_TTL_MS = 15_000;

function fetchLearningSummary(force = false): Promise<LearningSummary | null> {
  const fresh = !force && cachedSummary !== null && Date.now() - cachedAt < CACHE_TTL_MS;
  if (fresh) return Promise.resolve(cachedSummary);
  if (inFlight) return inFlight;
  inFlight = fetch("/api/learning")
    .then((response) => (response.ok ? response.json() : null))
    .then((value: LearningSummary | null) => {
      cachedSummary = value;
      cachedAt = Date.now();
      return value;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Busca o resumo de aprendizado do usuário autenticado (Supabase, via
 * /api/learning — nunca do localStorage). Recarrega quando o evento
 * "semiolab:learning-updated" é disparado (ex.: após finalizar um quiz ou
 * atendimento). Se outra tela já buscou o mesmo resumo há pouco, reaproveita
 * o resultado em memória em vez de gerar uma nova requisição de rede — o
 * consumidor recebe os dados já disponíveis imediatamente. */
export function useLearningSummary() {
  const [summary, setSummary] = useState<LearningSummary | null>(cachedSummary);
  const [loading, setLoading] = useState(cachedSummary === null);
  useEffect(() => {
    let active = true;
    const load = (force = false) => {
      if (!cachedSummary || force) setLoading(true);
      fetchLearningSummary(force).then((value) => {
        if (active) {
          setSummary(value);
          setLoading(false);
        }
      });
    };
    load();
    const onUpdated = () => load(true);
    window.addEventListener("semiolab:learning-updated", onUpdated);
    return () => { active = false; window.removeEventListener("semiolab:learning-updated", onUpdated); };
  }, []);
  return { summary, loading };
}
