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

/** Busca o resumo de aprendizado do usuário autenticado (Supabase, via
 * /api/learning — nunca do localStorage). Recarrega quando o evento
 * "semiolab:learning-updated" é disparado (ex.: após finalizar um quiz ou
 * atendimento). */
export function useLearningSummary() {
  const [summary, setSummary] = useState<LearningSummary | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const load = () => {
      setLoading(true);
      fetch("/api/learning")
        .then((response) => (response.ok ? response.json() : null))
        .then((value) => { if (active) setSummary(value); })
        .catch(() => {})
        .finally(() => { if (active) setLoading(false); });
    };
    load();
    window.addEventListener("semiolab:learning-updated", load);
    return () => { active = false; window.removeEventListener("semiolab:learning-updated", load); };
  }, []);
  return { summary, loading };
}
