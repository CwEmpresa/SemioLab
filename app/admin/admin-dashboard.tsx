"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import {
  LayoutDashboard, Wallet, Users, TrendingUp, Settings, ShieldCheck, BookOpen,
  ArrowUpRight, ArrowDownRight, Activity, Stethoscope, ClipboardCheck,
  RefreshCw, Menu, X, Crown, Compass,
} from "lucide-react";
import Avatar from "../avatar";
import { useScreenTransition, useStaggerReveal, useCountUp, usePulseGlow } from "@/components/animations";

type Overview = {
  totalUsers: number; confirmedUsers: number; pendingUsers: number;
  signups7d: number; signups30d: number; activeToday: number;
  proCount: number; trialCount: number; freeCount: number;
  aiCostToday: number; aiCostMonth: number;
  consultationsTotal: number; quizAttemptsTotal: number; simuladoAttemptsTotal: number;
  lastQuestionJob: { status: string; questions_created: number; questions_rejected: number; started_at: string; finished_at: string | null } | null;
  failedNotifications: number;
};
type UserRow = {
  id: string; email: string; name: string | null; xp: number; tier: string; stage: string;
  created_at: string; email_confirmed_at: string | null; last_sign_in_at: string | null; trial_started_at: string | null;
};
type UserDetail = {
  id: string; email: string; name: string | null; xp: number; createdAt: string;
  emailConfirmedAt: string | null; lastSignInAt: string | null; trialStartedAt: string | null;
  subscription: { status: string; plan: string; updated_at: string } | null;
  streakDays: number; quizAttempts: number; simuladoAttempts: number; patientAttempts: number;
  aiCostTotal: number; pushSubscriptions: number; stage: string;
};
type Funnel = {
  days: number; signups: number; confirmed: number; firstLogin: number; startedActivity: number;
  activated: number; returnedD1: number; returnedD3: number; clickedPro: number; becamePro: number;
};
type TimeSeries = {
  signups30d: { date: string; count: number }[];
  activity7d: { date: string; quiz: number; simulado: number; patient: number }[];
  aiCost30d: { date: string; cost: number }[];
};
type Operations = {
  questionGeneration: { lastJob: { status: string; questions_created: number; questions_rejected: number; started_at: string; finished_at: string | null; error_message: string | null } | null; totalPublished: number; totalRejected: number };
  notifications: { deliveries7d: number; activeSubscriptions: number };
  webhooks: { total30d: number; errors30d: number; recent: { event: string; status: string; received_at: string }[] };
  aiCost: { today: number; month: number };
};
type AuditLog = { id: string; action: string; result: string; created_at: string; actor_email: string | null; target_email: string | null };
type Revenue = {
  mrr: number; arr: number; arpu: number;
  activeCount: number; monthlyPlanCount: number; annualPlanCount: number;
  trialCount: number; pastDueCount: number; pausedCount: number;
  canceledCount: number; refundedCount: number; chargebackCount: number; expiredCount: number;
  newMrr30d: number; churnedMrr30d: number; new30dCount: number; churned30dCount: number;
  statusBreakdown: { status: string; count: number }[];
  recentEvents: { event: string; status: string; received_at: string; customer_email: string | null; plan: string | null }[];
  series: { month: string; mrr: number }[];
};
type ContentStats = {
  patientCases: { total: number; active: number };
  simuladoQuestions: { published: number; draft: number; rejected: number };
  errorNotebookEntries: number;
  topTopics: { topic: string; questions: number; consultations: number; total: number }[];
  weeklyRankTop: { rank: number; xp: number; name: string | null; email: string | null }[];
};
type Engagement = {
  featureUsage: { feature: string; label: string; attempts30d: number; uniqueUsers30d: number }[];
  patientSessions: { total: number; finished: number; notFinished: number; avgMessagesFinished: number; avgMessagesNotFinished: number };
  simulado: { started: number; completed: number };
  dormancy: { bucket: string; count: number }[];
};
type ActivationDay = { date: string; signups: number; activated: number; dau: number };

const STAGE_LABELS: Record<string, string> = {
  pending_email: "E-mail pendente",
  confirmed_no_login: "Confirmado, sem login",
  logged_in_no_activity: "Entrou, sem atividade",
  started_abandoned: "Iniciou e abandonou",
  activated: "Ativado",
  returned: "Retornou",
  clicked_pro: "Clicou no Pro",
  pro: "Pro",
};
const SUB_STATUS_LABELS: Record<string, string> = {
  pending: "Pendente", active: "Ativa", trial: "Trial", past_due: "Inadimplente",
  paused: "Pausada", canceled: "Cancelada", expired: "Expirada", refunded: "Reembolsada", chargeback: "Chargeback",
};
const EVENT_LABELS: Record<string, string> = {
  purchase_approved: "Compra aprovada", subscription_created: "Assinatura criada",
  subscription_renewed: "Assinatura renovada", subscription_renewal_refused: "Renovação recusada",
  subscription_paused: "Assinatura pausada", subscription_resumed: "Assinatura retomada",
  subscription_canceled: "Assinatura cancelada", refund: "Reembolso", chargeback: "Chargeback",
  initiate_checkout: "Checkout iniciado", checkout_abandonment: "Checkout abandonado",
  purchase_refused: "Compra recusada", pix_gerado: "Pix gerado", boleto_gerado: "Boleto gerado",
  picpay_gerado: "PicPay gerado", openfinance_nubank_gerado: "Open Finance gerado",
};
const FUNNEL_STEPS: { key: keyof Funnel; label: string }[] = [
  { key: "signups", label: "Cadastrados" },
  { key: "confirmed", label: "Confirmaram" },
  { key: "firstLogin", label: "Primeiro login" },
  { key: "startedActivity", label: "Iniciaram atividade" },
  { key: "activated", label: "Ativaram" },
  { key: "returnedD1", label: "Retornaram D1" },
  { key: "returnedD3", label: "Retornaram D3" },
  { key: "clickedPro", label: "Clicaram no Pro" },
  { key: "becamePro", label: "Viraram Pro" },
];
const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "pending", label: "Pendentes" },
  { id: "free", label: "Free" },
  { id: "trial", label: "Trial" },
  { id: "pro", label: "Pro" },
  { id: "recent", label: "Cadastro recente" },
] as const;
const SECTIONS = [
  { id: "overview", label: "Visão geral", icon: LayoutDashboard },
  { id: "revenue", label: "Receita", icon: Wallet },
  { id: "users", label: "Usuários", icon: Users },
  { id: "activation", label: "Ativação", icon: TrendingUp },
  { id: "engagement", label: "Uso do produto", icon: Compass },
  { id: "content", label: "Conteúdo", icon: BookOpen },
  { id: "operations", label: "Operação", icon: Settings },
  { id: "audit", label: "Auditoria", icon: ShieldCheck },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
function fmtDateShort(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
}
function fmtMonthShort(month: string) {
  return new Date(`${month}-01T12:00:00Z`).toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "America/Sao_Paulo" }).replace(".", "");
}
function tierOf(u: UserDetail): "free" | "trial" | "pro" {
  if (u.subscription?.status === "active") return "pro";
  if (u.trialStartedAt && Date.now() - new Date(u.trialStartedAt).getTime() < 7 * 24 * 60 * 60 * 1000) return "trial";
  return "free";
}
const TRIAL_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
function trialEndsLabel(trialStartedAt: string | null) {
  if (!trialStartedAt) return "Sem período de teste";
  const endsAt = new Date(trialStartedAt).getTime() + TRIAL_DAYS_MS;
  return fmtDate(new Date(endsAt).toISOString()) ?? "—";
}
function fmtUsd(n: number) {
  return `$${n.toFixed(4)}`;
}
function fmtBRL(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function fmtPct(n: number) {
  return `${n.toFixed(0)}%`;
}

function LineChartCard({ title, points, formatValue, color = "#35c9b1", badge }: { title: string; points: { label: string; value: number }[]; formatValue: (n: number) => string; color?: string; badge?: string }) {
  const max = Math.max(...points.map((p) => p.value), 0.0001);
  const w = 600, h = 140, pad = 8;
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => [pad + i * stepX, h - pad - (p.value / max) * (h - pad * 2)] as const);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1]?.[0] ?? pad},${h - pad} L${pad},${h - pad} Z`;
  const total = points.reduce((s, p) => s + p.value, 0);
  return (
    <article className="admin-chart-card">
      <header><h3>{title}</h3><b>{badge ?? formatValue(points[points.length - 1]?.value ?? total)}</b></header>
      {points.length === 0 || total === 0 ? (
        <div className="admin-chart-empty">Sem dados neste período ainda</div>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="admin-chart-svg">
          <defs>
            <linearGradient id={`grad-${title.replace(/\s+/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.35" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#grad-${title.replace(/\s+/g, "")})`} stroke="none" />
          <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          {coords.length > 0 && <circle cx={coords[coords.length - 1][0]} cy={coords[coords.length - 1][1]} r="4" fill={color} />}
        </svg>
      )}
      <footer><span>{points[0]?.label}</span><span>{points[points.length - 1]?.label}</span></footer>
    </article>
  );
}

function ActivityBarsCard({ points }: { points: { label: string; quiz: number; simulado: number; patient: number }[] }) {
  const max = Math.max(...points.map((p) => p.quiz + p.simulado + p.patient), 1);
  const total = points.reduce((s, p) => s + p.quiz + p.simulado + p.patient, 0);
  return (
    <article className="admin-chart-card">
      <header><h3>Atividades — últimos 7 dias</h3><b>{total}</b></header>
      {total === 0 ? (
        <div className="admin-chart-empty">Nenhuma atividade nesta semana ainda</div>
      ) : (
        <div className="admin-bars">
          {points.map((p) => (
            <div className="admin-bar-col" key={p.label}>
              <div className="admin-bar-stack" style={{ height: `${Math.max(4, ((p.quiz + p.simulado + p.patient) / max) * 100)}%` }}>
                {p.patient > 0 && <span style={{ flex: p.patient, background: "#46d6c1" }} title={`Paciente IA: ${p.patient}`} />}
                {p.simulado > 0 && <span style={{ flex: p.simulado, background: "#7fa8ff" }} title={`Simulado: ${p.simulado}`} />}
                {p.quiz > 0 && <span style={{ flex: p.quiz, background: "#f0c14e" }} title={`Quiz: ${p.quiz}`} />}
              </div>
              <small>{p.label}</small>
            </div>
          ))}
        </div>
      )}
      <div className="admin-legend">
        <span><i style={{ background: "#f0c14e" }} /> Quiz</span>
        <span><i style={{ background: "#7fa8ff" }} /> Simulado</span>
        <span><i style={{ background: "#46d6c1" }} /> Paciente IA</span>
      </div>
    </article>
  );
}

function HeroStat({
  icon: Icon, label, value, sub, delta, accent, glow, countTarget,
}: {
  icon: React.ComponentType<{ size?: number }>; label: string; value: string; sub?: string;
  delta?: { positive: boolean; label: string } | null; accent?: "mint" | "gold" | "blue";
  glow?: boolean; countTarget?: number;
}) {
  const cardRef = useRef<HTMLElement>(null);
  usePulseGlow(cardRef, "#35c9b1");
  const countRef = useCountUp(countTarget ?? 0, "", 0);
  return (
    <article className={`admin-hero-card admin-hero-card-${accent ?? "mint"}${glow ? " admin-hero-glow" : ""}`} ref={glow ? cardRef : undefined}>
      <i className="admin-hero-icon"><Icon size={18} /></i>
      <small>{label}</small>
      <b ref={countTarget !== undefined ? countRef : undefined}>{countTarget === undefined ? value : null}</b>
      <div className="admin-hero-foot">
        {sub && <span className="admin-hero-sub">{sub}</span>}
        {delta && (
          <span className={`admin-hero-delta ${delta.positive ? "up" : "down"}`}>
            {delta.positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{delta.label}
          </span>
        )}
      </div>
    </article>
  );
}

function SkeletonGrid({ count = 4, height = 92 }: { count?: number; height?: number }) {
  return (
    <div className="admin-skel-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="admin-skel-card" style={{ height, animationDelay: `${i * 0.08}s` }} />
      ))}
    </div>
  );
}

function StatusBarList({ items }: { items: { status: string; count: number }[] }) {
  const max = Math.max(...items.map((i) => i.count), 1);
  const colorFor = (status: string) =>
    status === "active" ? "#35c9b1" : status === "trial" ? "#6db7e8" : status === "past_due" || status === "paused" ? "#f0a84e" : "#e05a5a";
  return (
    <div className="admin-status-bars">
      {items.length === 0 ? (
        <div className="admin-chart-empty">Nenhuma assinatura ainda</div>
      ) : items.map((it) => (
        <div className="admin-status-row" key={it.status}>
          <span>{SUB_STATUS_LABELS[it.status] || it.status}</span>
          <div className="admin-status-track"><i style={{ width: `${(it.count / max) * 100}%`, background: colorFor(it.status) }} /></div>
          <b>{it.count}</b>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboard({ adminEmail, adminRole }: { adminEmail: string; adminRole: string }) {
  const [section, setSection] = useState<SectionId>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [series, setSeries] = useState<TimeSeries | null>(null);
  const [operations, setOperations] = useState<Operations | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [confirmAction, setConfirmAction] = useState<"resend" | "reset" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [funnelDays, setFunnelDays] = useState<7 | 30>(7);
  const [funnel7, setFunnel7] = useState<Funnel | null>(null);
  const [funnel30, setFunnel30] = useState<Funnel | null>(null);
  const [revenue, setRevenue] = useState<Revenue | null>(null);
  const [content, setContent] = useState<ContentStats | null>(null);
  const [engagement, setEngagement] = useState<Engagement | null>(null);
  const [activationDaily, setActivationDaily] = useState<ActivationDay[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const sectionRef = useScreenTransition(section);
  const staggerRef = useStaggerReveal(".admin-hero-card, .admin-kpi, .admin-chart-card, .admin-ops-card, .admin-funnel-step", [section, overview, revenue, content, engagement, activationDaily, operations, funnel7, funnel30, funnelDays]);
  const setSectionNode = useCallback((node: HTMLDivElement | null) => {
    sectionRef.current = node;
    staggerRef.current = node;
  }, [sectionRef, staggerRef]);

  useEffect(() => {
    fetch("/api/admin/funnel?days=7").then((r) => (r.ok ? r.json() : null)).then(setFunnel7).catch(() => {});
    fetch("/api/admin/funnel?days=30").then((r) => (r.ok ? r.json() : null)).then(setFunnel30).catch(() => {});
    fetch("/api/admin/time-series").then((r) => (r.ok ? r.json() : null)).then(setSeries).catch(() => {});
    fetch("/api/admin/operations").then((r) => (r.ok ? r.json() : null)).then(setOperations).catch(() => {});
    fetch("/api/admin/revenue").then((r) => (r.ok ? r.json() : null)).then(setRevenue).catch(() => {});
    fetch("/api/admin/content").then((r) => (r.ok ? r.json() : null)).then(setContent).catch(() => {});
    fetch("/api/admin/engagement").then((r) => (r.ok ? r.json() : null)).then(setEngagement).catch(() => {});
    fetch("/api/admin/activation-daily?days=14").then((r) => (r.ok ? r.json() : null)).then(setActivationDaily).catch(() => {});
  }, []);

  const loadOverview = useCallback(() => {
    fetch("/api/admin/overview").then((r) => (r.ok ? r.json() : null)).then((data) => { if (data) { setOverview(data); setLastUpdated(new Date()); } }).catch(() => {});
  }, []);
  useEffect(() => { loadOverview(); }, [loadOverview]);

  const loadUsers = useCallback(() => {
    const params = new URLSearchParams({ search, filter, page: String(page) });
    fetch(`/api/admin/users?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) { setUsers(data.users || []); setTotal(data.total || 0); } })
      .catch(() => {});
  }, [search, filter, page]);
  useEffect(() => { if (section === "users") loadUsers(); }, [loadUsers, section]);

  const loadAudit = useCallback(() => {
    fetch(`/api/admin/audit-logs?page=${auditPage}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) { setAuditLogs(data.logs || []); setAuditTotal(data.total || 0); } })
      .catch(() => {});
  }, [auditPage]);
  useEffect(() => { if (section === "audit") loadAudit(); }, [loadAudit, section]);

  const loadRevenue = useCallback(() => {
    fetch("/api/admin/revenue").then((r) => (r.ok ? r.json() : null)).then((data) => { if (data) setRevenue(data); }).catch(() => {});
  }, []);

  const openDetail = (id: string) => {
    setActionMessage("");
    fetch(`/api/admin/users/${id}`).then((r) => (r.ok ? r.json() : null)).then(setSelected).catch(() => {});
  };

  const runAction = async () => {
    if (!selected || !confirmAction) return;
    setActionBusy(true);
    setActionMessage("");
    const path = confirmAction === "resend" ? "resend-confirmation" : "send-password-reset";
    try {
      const response = await fetch(`/api/admin/users/${selected.id}/${path}`, { method: "POST" });
      const data = await response.json().catch(() => ({}));
      setActionMessage(response.ok ? "Enviado com sucesso." : data.error || "Falha ao enviar.");
    } catch {
      setActionMessage("Falha ao enviar.");
    } finally {
      setActionBusy(false);
      setConfirmAction(null);
    }
  };

  const activeFunnel = funnelDays === 7 ? funnel7 : funnel30;
  const activeSection = SECTIONS.find((s) => s.id === section);
  const sectionLabel = activeSection?.label ?? "";
  const netMrr30d = revenue ? revenue.newMrr30d - revenue.churnedMrr30d : 0;
  const maxTopic = Math.max(...(content?.topTopics.map((t) => t.total) ?? [1]), 1);

  return (
    <div className="admin-shell">
      <button className="admin-mobile-nav-trigger" onClick={() => setMobileNavOpen(true)} aria-label="Abrir menu"><Menu size={20} /></button>
      {mobileNavOpen && <div className="overlay admin-mobile-nav-overlay" onMouseDown={() => setMobileNavOpen(false)} />}
      <aside className={`admin-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="admin-sidebar-brand">
          <span className="admin-sidebar-logo">S</span>
          <b>SemioLab</b>
          <button className="admin-sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Fechar menu"><X size={16} /></button>
        </div>
        <nav className="admin-sidebar-nav">
          {SECTIONS.map((s) => (
            <button key={s.id} className={section === s.id ? "active" : ""} onClick={() => { setSection(s.id); setMobileNavOpen(false); }}>
              <s.icon size={16} /><span>{s.label}</span>
            </button>
          ))}
        </nav>
        <Link className="admin-sidebar-back" href="/">← Voltar ao app</Link>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>{activeSection && <activeSection.icon size={20} />}{sectionLabel}</h1>
            <small>{lastUpdated ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Carregando..."}</small>
          </div>
          <button className="admin-refresh" onClick={() => { loadOverview(); loadRevenue(); if (section === "users") loadUsers(); if (section === "audit") loadAudit(); }}>
            <RefreshCw size={14} /> Atualizar
          </button>
          <div className="admin-identity"><i>{adminEmail ? adminEmail[0]?.toUpperCase() : "A"}</i><span><b>{adminEmail || "Administrador"}</b><small>{adminRole === "super_admin" ? "Super admin" : "Admin"}</small></span></div>
        </header>

        <div ref={setSectionNode}>
        {section === "overview" && (
          <>
            {!overview ? (
              <SkeletonGrid count={4} height={110} />
            ) : (
              <>
                <section className="admin-hero-grid">
                  <HeroStat icon={Wallet} label="MRR — receita recorrente mensal" value={fmtBRL(revenue?.mrr ?? 0)} sub={revenue ? `ARR ${fmtBRL(revenue.arr)}` : undefined} accent="mint" glow
                    delta={revenue ? { positive: netMrr30d >= 0, label: `${netMrr30d >= 0 ? "+" : ""}${fmtBRL(netMrr30d)} em 30d` } : null} />
                  <HeroStat icon={Users} label="Usuários totais" value={String(overview.totalUsers)} countTarget={overview.totalUsers} sub={`${overview.confirmedUsers} confirmados`} accent="blue" />
                  <HeroStat icon={Activity} label="Ativos hoje" value={String(overview.activeToday)} countTarget={overview.activeToday} sub={`${overview.signups7d} cadastros em 7d`} accent="gold" />
                  <HeroStat icon={Crown} label="Assinantes Pro" value={String(overview.proCount)} countTarget={overview.proCount} sub={`${overview.trialCount} em trial · ${overview.freeCount} free`} accent="mint" />
                </section>

                <section className="admin-kpi-grid">
                  <article className="admin-kpi"><small>Confirmados</small><b>{overview.confirmedUsers}</b><span>{overview.pendingUsers} pendentes</span></article>
                  <article className="admin-kpi"><small>Free / Trial / Pro</small><b>{overview.freeCount} / {overview.trialCount} / {overview.proCount}</b><span>Distribuição atual</span></article>
                  <article className="admin-kpi"><small>Custo IA hoje</small><b>{fmtUsd(overview.aiCostToday)}</b><span>{fmtUsd(overview.aiCostMonth)} no mês</span></article>
                  <article className="admin-kpi"><small>Atividade total</small><b>{overview.consultationsTotal + overview.quizAttemptsTotal + overview.simuladoAttemptsTotal}</b><span>{overview.quizAttemptsTotal} quiz · {overview.simuladoAttemptsTotal} simulado · {overview.consultationsTotal} paciente</span></article>
                </section>

                {series && (
                  <section className="admin-charts-grid">
                    {revenue && <LineChartCard title="MRR — últimos 12 meses" points={revenue.series.map((p) => ({ label: fmtMonthShort(p.month), value: p.mrr }))} formatValue={fmtBRL} color="#35c9b1" />}
                    <LineChartCard title="Cadastros — últimos 30 dias" points={series.signups30d.map((p) => ({ label: fmtDateShort(p.date), value: p.count }))} formatValue={(n) => `${n} cadastros`} color="#6db7e8" badge={`${overview.signups30d} no total`} />
                    <ActivityBarsCard points={series.activity7d.map((p) => ({ label: fmtDateShort(p.date), quiz: p.quiz, simulado: p.simulado, patient: p.patient }))} />
                  </section>
                )}
              </>
            )}
          </>
        )}

        {section === "revenue" && (
          <>
            {!revenue ? (
              <SkeletonGrid count={4} height={110} />
            ) : (
              <>
                <section className="admin-hero-grid">
                  <HeroStat icon={Wallet} label="MRR atual" value={fmtBRL(revenue.mrr)} sub={`ARR ${fmtBRL(revenue.arr)}`} accent="mint" glow
                    delta={{ positive: netMrr30d >= 0, label: `${netMrr30d >= 0 ? "+" : ""}${fmtBRL(netMrr30d)} em 30d` }} />
                  <HeroStat icon={Users} label="Assinantes ativos" value={String(revenue.activeCount)} countTarget={revenue.activeCount} sub={`${revenue.monthlyPlanCount} mensal · ${revenue.annualPlanCount} anual`} accent="blue" />
                  <HeroStat icon={TrendingUp} label="ARPU" value={fmtBRL(revenue.arpu)} sub="Receita média por assinante" accent="gold" />
                  <HeroStat icon={ArrowUpRight} label="Novo MRR (30d)" value={fmtBRL(revenue.newMrr30d)} sub={`${revenue.new30dCount} novas assinaturas`} accent="mint" />
                </section>

                <section className="admin-charts-grid">
                  <LineChartCard title="MRR — últimos 12 meses" points={revenue.series.map((p) => ({ label: fmtMonthShort(p.month), value: p.mrr }))} formatValue={fmtBRL} color="#35c9b1" />
                  <article className="admin-chart-card">
                    <header><h3>Assinaturas por status</h3><b>{revenue.activeCount + revenue.trialCount + revenue.pastDueCount + revenue.pausedCount + revenue.canceledCount + revenue.expiredCount + revenue.refundedCount + revenue.chargebackCount}</b></header>
                    <StatusBarList items={revenue.statusBreakdown} />
                  </article>
                  <article className="admin-chart-card">
                    <header><h3>Churn — últimos 30 dias</h3><b className="admin-text-warn">{fmtBRL(revenue.churnedMrr30d)}</b></header>
                    <div className="admin-detail-grid">
                      <span><small>Cancelamentos</small><b>{revenue.churned30dCount}</b></span>
                      <span><small>MRR perdido</small><b>{fmtBRL(revenue.churnedMrr30d)}</b></span>
                      <span><small>Inadimplentes</small><b>{revenue.pastDueCount}</b></span>
                      <span><small>Pausadas</small><b>{revenue.pausedCount}</b></span>
                    </div>
                  </article>
                </section>

                <section className="admin-ops-card admin-events-card">
                  <h3>Eventos recentes de pagamento</h3>
                  {revenue.recentEvents.length === 0 ? (
                    <div className="admin-chart-empty">Nenhum evento registrado ainda</div>
                  ) : (
                    <ul className="admin-ops-list">
                      {revenue.recentEvents.map((e, i) => (
                        <li key={i}>
                          <span>{EVENT_LABELS[e.event] || e.event}{e.customer_email ? ` · ${e.customer_email}` : ""}{e.plan && e.plan !== "unknown" ? ` (${e.plan === "monthly" ? "mensal" : "anual"})` : ""}</span>
                          <em className={e.status === "error" ? "admin-badge-warn" : "admin-badge-ok"}>{e.status}</em>
                          <small>{fmtDate(e.received_at)}</small>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </>
        )}

        {section === "activation" && (
          <>
            <section className="admin-funnel-panel">
              <div className="admin-funnel-toggle">
                <button className={funnelDays === 7 ? "active" : ""} onClick={() => setFunnelDays(7)}>7 dias</button>
                <button className={funnelDays === 30 ? "active" : ""} onClick={() => setFunnelDays(30)}>30 dias</button>
              </div>
              {!activeFunnel ? (
                <SkeletonGrid count={9} height={92} />
              ) : (
                <div className="admin-funnel-steps">
                  {FUNNEL_STEPS.map((step, idx) => {
                    const value = activeFunnel[step.key] as number;
                    const prevValue = idx === 0 ? null : (activeFunnel[FUNNEL_STEPS[idx - 1].key] as number);
                    const pctPrev = prevValue && prevValue > 0 ? Math.round((value / prevValue) * 100) : null;
                    const pctTotal = activeFunnel.signups > 0 ? Math.round((value / activeFunnel.signups) * 100) : null;
                    return (
                      <div className="admin-funnel-step" key={step.key}>
                        <small>{step.label}</small>
                        <b>{value}</b>
                        <div className="admin-funnel-bar"><i style={{ width: `${pctTotal ?? 0}%` }} /></div>
                        <span>{pctPrev !== null ? `${pctPrev}% da etapa anterior` : "—"} · {pctTotal !== null ? `${pctTotal}% do total` : "—"}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <h3 className="admin-subheading">Dia a dia — últimos 14 dias</h3>
            {!activationDaily ? (
              <SkeletonGrid count={3} height={160} />
            ) : (
              <>
                <section className="admin-charts-grid">
                  <LineChartCard title="Cadastros por dia" points={activationDaily.map((d) => ({ label: fmtDateShort(d.date), value: d.signups }))} formatValue={(n) => `${n} cadastros`} color="#6db7e8" />
                  <LineChartCard title="Usuários ativos por dia (DAU)" points={activationDaily.map((d) => ({ label: fmtDateShort(d.date), value: d.dau }))} formatValue={(n) => `${n} ativos`} color="#35c9b1" />
                  <LineChartCard title="Taxa de ativação por dia" points={activationDaily.map((d) => ({ label: fmtDateShort(d.date), value: d.signups > 0 ? (d.activated / d.signups) * 100 : 0 }))} formatValue={fmtPct} color="#f0a84e" />
                </section>
                <p className="admin-hero-sub admin-note">A taxa de ativação é medida com o estágio atual de cada cadastro — dias mais recentes tendem a aparecer mais baixos porque ainda não tiveram tempo de ativar.</p>
              </>
            )}
          </>
        )}

        {section === "engagement" && (
          <>
            {!engagement ? (
              <SkeletonGrid count={3} height={100} />
            ) : (
              <>
                <section className="admin-kpi-grid">
                  <article className="admin-kpi">
                    <small>Sessões com Paciente IA</small>
                    <b>{engagement.patientSessions.finished}/{engagement.patientSessions.total}</b>
                    <span>concluídas · {engagement.patientSessions.notFinished} não concluídas</span>
                  </article>
                  <article className="admin-kpi">
                    <small>Simulados concluídos</small>
                    <b>{engagement.simulado.completed}/{engagement.simulado.started}</b>
                    <span>{engagement.simulado.started > 0 ? fmtPct((engagement.simulado.completed / engagement.simulado.started) * 100) : "—"} de conclusão</span>
                  </article>
                  <article className="admin-kpi">
                    <small>Mensagens até concluir</small>
                    <b>{engagement.patientSessions.avgMessagesFinished}</b>
                    <span>{engagement.patientSessions.avgMessagesNotFinished} nas sessões não concluídas</span>
                  </article>
                </section>

                <section className="admin-charts-grid">
                  <article className="admin-chart-card">
                    <header><h3>Onde o usuário mais usa (últimos 30 dias)</h3></header>
                    <div className="admin-topic-bars">
                      {engagement.featureUsage.map((f) => (
                        <div className="admin-topic-row" key={f.feature}>
                          <span>{f.label}</span>
                          <div className="admin-topic-track"><i style={{ width: `${(f.attempts30d / Math.max(...engagement.featureUsage.map((x) => x.attempts30d), 1)) * 100}%` }} /></div>
                          <b>{f.attempts30d}</b>
                        </div>
                      ))}
                    </div>
                    <p className="admin-hero-sub admin-note">
                      {engagement.featureUsage.map((f) => `${f.label}: ${f.uniqueUsers30d} usuários únicos`).join(" · ")}
                    </p>
                  </article>
                  <article className="admin-chart-card">
                    <header><h3>Inatividade da base</h3></header>
                    <div className="admin-topic-bars admin-topic-bars-wide">
                      {engagement.dormancy.map((d) => (
                        <div className="admin-topic-row" key={d.bucket}>
                          <span>{d.bucket}</span>
                          <div className="admin-topic-track"><i style={{ width: `${(d.count / Math.max(...engagement.dormancy.map((x) => x.count), 1)) * 100}%` }} /></div>
                          <b>{d.count}</b>
                        </div>
                      ))}
                    </div>
                    <p className="admin-hero-sub admin-note">Quanto mais usuários em &quot;Sumiu há 30+ dias&quot; ou &quot;Nunca voltou&quot;, maior o sinal de abandono da base.</p>
                  </article>
                </section>
              </>
            )}
          </>
        )}

        {section === "content" && (
          <>
            {!content ? (
              <SkeletonGrid count={3} height={100} />
            ) : (
              <>
                <section className="admin-kpi-grid">
                  <article className="admin-kpi admin-kpi-icon"><i><Stethoscope size={16} /></i><small>Casos clínicos ativos</small><b>{content.patientCases.active}/{content.patientCases.total}</b><span>Simulador de paciente com IA</span></article>
                  <article className="admin-kpi admin-kpi-icon"><i><ClipboardCheck size={16} /></i><small>Questões publicadas</small><b>{content.simuladoQuestions.published}</b><span>{content.simuladoQuestions.draft} rascunho · {content.simuladoQuestions.rejected} rejeitadas</span></article>
                  <article className="admin-kpi admin-kpi-icon"><i><BookOpen size={16} /></i><small>Caderno de erros</small><b>{content.errorNotebookEntries}</b><span>Entradas registradas pelos usuários</span></article>
                </section>

                <section className="admin-charts-grid">
                  <article className="admin-chart-card">
                    <header><h3>Tópicos mais praticados</h3></header>
                    {content.topTopics.length === 0 ? <div className="admin-chart-empty">Sem dados ainda</div> : (
                      <div className="admin-topic-bars">
                        {content.topTopics.map((t) => (
                          <div className="admin-topic-row" key={t.topic}>
                            <span>{t.topic}</span>
                            <div className="admin-topic-track"><i style={{ width: `${(t.total / maxTopic) * 100}%` }} /></div>
                            <b>{t.total}</b>
                          </div>
                        ))}
                      </div>
                    )}
                  </article>
                  <article className="admin-chart-card">
                    <header><h3>Top do ranking semanal</h3></header>
                    {content.weeklyRankTop.length === 0 ? <div className="admin-chart-empty">Sem ranking calculado ainda</div> : (
                      <ul className="admin-ops-list">
                        {content.weeklyRankTop.map((u) => (
                          <li key={u.rank}><span>#{u.rank} {u.name || u.email || "—"}</span><b>{u.xp} XP</b></li>
                        ))}
                      </ul>
                    )}
                  </article>
                </section>
              </>
            )}
          </>
        )}

        {section === "users" && (
          <section className="admin-users-panel">
            <div className="admin-toolbar">
              <input placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
              <div className="admin-filters">
                {FILTERS.map((f) => (
                  <button key={f.id} className={filter === f.id ? "active" : ""} onClick={() => { setFilter(f.id); setPage(1); }}>{f.label}</button>
                ))}
              </div>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Usuário</th><th>Cadastro</th><th>Confirmado</th><th>Último login</th><th>Tier</th><th>Trial até</th><th>XP</th><th>Estágio</th></tr></thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr className="admin-table-empty"><td colSpan={8}>Nenhum usuário encontrado.</td></tr>
                  ) : users.map((u) => (
                    <tr key={u.id} onClick={() => openDetail(u.id)}>
                      <td className="admin-table-user">
                        <i className="admin-table-avatar"><Avatar url={null} name={u.name || u.email} /></i>
                        <span><b>{u.name || "Sem nome"}</b><small>{u.email}</small></span>
                      </td>
                      <td>{fmtDate(u.created_at) ?? "—"}</td>
                      <td>{u.email_confirmed_at ? "Sim" : "Nunca confirmou"}</td>
                      <td>{fmtDate(u.last_sign_in_at) ?? "Nunca entrou"}</td>
                      <td><span className={`admin-tier admin-tier-${u.tier}`}>{u.tier}</span></td>
                      <td>{trialEndsLabel(u.trial_started_at)}</td>
                      <td>{u.xp}</td>
                      <td><span className="admin-stage-pill">{STAGE_LABELS[u.stage] || u.stage}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-pagination">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
              <span>Página {page} de {Math.max(1, Math.ceil(total / 20))} · {total} usuários</span>
              <button disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Próxima</button>
            </div>
          </section>
        )}

        {section === "operations" && (
          <section className="admin-ops-grid">
            {!operations ? (
              <SkeletonGrid count={4} height={140} />
            ) : (
              <>
                <article className="admin-ops-card">
                  <h3>Gerador de questões</h3>
                  <div className="admin-detail-grid">
                    <span><small>Último job</small><b>{operations.questionGeneration.lastJob?.status ?? "Nunca rodou"}</b></span>
                    <span><small>Publicadas</small><b>{operations.questionGeneration.totalPublished}</b></span>
                    <span><small>Rejeitadas</small><b>{operations.questionGeneration.totalRejected}</b></span>
                  </div>
                </article>
                <article className="admin-ops-card">
                  <h3>Notificações</h3>
                  <div className="admin-detail-grid">
                    <span><small>Entregas em 7 dias</small><b>{operations.notifications.deliveries7d}</b></span>
                    <span><small>Dispositivos ativos</small><b>{operations.notifications.activeSubscriptions}</b></span>
                  </div>
                </article>
                <article className="admin-ops-card">
                  <h3>Webhooks (Cakto)</h3>
                  <div className="admin-detail-grid">
                    <span><small>Últimos 30 dias</small><b>{operations.webhooks.total30d}</b></span>
                    <span><small>Erros em 30 dias</small><b>{operations.webhooks.errors30d}</b></span>
                  </div>
                  {operations.webhooks.recent.length > 0 && (
                    <ul className="admin-ops-list">
                      {operations.webhooks.recent.slice(0, 5).map((e, i) => (
                        <li key={i}><span>{e.event}</span><em className={e.status === "error" ? "admin-badge-warn" : "admin-badge-ok"}>{e.status}</em><small>{fmtDate(e.received_at)}</small></li>
                      ))}
                    </ul>
                  )}
                </article>
                <article className="admin-ops-card">
                  <h3>Custo de IA</h3>
                  <div className="admin-detail-grid">
                    <span><small>Hoje</small><b>{fmtUsd(operations.aiCost.today)}</b></span>
                    <span><small>Este mês</small><b>{fmtUsd(operations.aiCost.month)}</b></span>
                  </div>
                </article>
              </>
            )}
          </section>
        )}

        {section === "audit" && (
          <section className="admin-users-panel">
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Ator</th><th>Ação</th><th>Alvo</th><th>Resultado</th><th>Horário</th></tr></thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr className="admin-table-empty"><td colSpan={5}>Nenhum evento de auditoria ainda.</td></tr>
                  ) : auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td>{log.actor_email || "—"}</td>
                      <td>{log.action}</td>
                      <td>{log.target_email || "—"}</td>
                      <td><span className={log.result === "success" ? "admin-badge admin-badge-ok" : "admin-badge admin-badge-warn"}>{log.result}</span></td>
                      <td>{fmtDate(log.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="admin-pagination">
              <button disabled={auditPage <= 1} onClick={() => setAuditPage((p) => p - 1)}>Anterior</button>
              <span>Página {auditPage} de {Math.max(1, Math.ceil(auditTotal / 30))} · {auditTotal} eventos</span>
              <button disabled={auditPage * 30 >= auditTotal} onClick={() => setAuditPage((p) => p + 1)}>Próxima</button>
            </div>
          </section>
        )}
        </div>
      </main>

      {selected && (
        <div className="overlay admin-drawer-overlay" onMouseDown={() => setSelected(null)}>
          <section className="admin-drawer" onMouseDown={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)}>×</button>
            <header className="admin-detail-head">
              <i className="admin-drawer-avatar"><Avatar url={null} name={selected.name || selected.email} /></i>
              <h2>{selected.name || "Sem nome"}</h2>
              <div className="admin-detail-email">
                <span>{selected.email}</span>
                <button
                  className="admin-copy-btn"
                  onClick={() => { navigator.clipboard?.writeText(selected.email); setActionMessage("E-mail copiado."); window.setTimeout(() => setActionMessage(""), 1800); }}
                >
                  Copiar
                </button>
              </div>
              <div className="admin-badges">
                <span className={selected.emailConfirmedAt ? "admin-badge admin-badge-ok" : "admin-badge admin-badge-warn"}>
                  {selected.emailConfirmedAt ? "E-mail confirmado" : "E-mail pendente"}
                </span>
                <span className={`admin-badge admin-tier-${tierOf(selected)}`}>{tierOf(selected) === "free" ? "Free" : tierOf(selected) === "trial" ? "Trial" : "Pro"}</span>
                <span className="admin-badge admin-badge-stage">{STAGE_LABELS[selected.stage] || selected.stage}</span>
              </div>
            </header>

            <div className="admin-detail-block">
              <h3>Conta</h3>
              <div className="admin-detail-grid">
                <span><small>Cadastro</small><b>{fmtDate(selected.createdAt) ?? "Data indisponível"}</b></span>
                <span><small>Confirmado</small><b>{fmtDate(selected.emailConfirmedAt) ?? "Nunca confirmou"}</b></span>
                <span><small>Último login</small><b>{fmtDate(selected.lastSignInAt) ?? "Nunca entrou"}</b></span>
              </div>
            </div>

            <div className="admin-detail-block">
              <h3>Plano</h3>
              <div className="admin-detail-grid">
                <span><small>Trial desde</small><b>{fmtDate(selected.trialStartedAt) ?? "Sem período de teste"}</b></span>
                <span><small>Trial até</small><b>{trialEndsLabel(selected.trialStartedAt)}</b></span>
                <span><small>Assinatura</small><b>{selected.subscription ? `${selected.subscription.plan} (${selected.subscription.status})` : "Sem assinatura"}</b></span>
              </div>
            </div>

            <div className="admin-detail-block">
              <h3>Atividade</h3>
              <div className="admin-detail-grid">
                <span><small>XP</small><b>{selected.xp}</b></span>
                <span><small>Streak</small><b>{selected.streakDays > 0 ? `${selected.streakDays} dias` : "Streak: 0 dias"}</b></span>
                <span><small>Quiz / Simulado / Paciente</small><b>{selected.quizAttempts} / {selected.simuladoAttempts} / {selected.patientAttempts}</b></span>
                <span><small>Custo IA total</small><b>{fmtUsd(selected.aiCostTotal)}</b></span>
                <span><small>Notificações</small><b>{selected.pushSubscriptions > 0 ? `${selected.pushSubscriptions} dispositivo${selected.pushSubscriptions > 1 ? "s" : ""} ativo${selected.pushSubscriptions > 1 ? "s" : ""}` : "Nenhum dispositivo ativo"}</b></span>
              </div>
            </div>

            <div className="admin-detail-block">
              <h3>Suporte</h3>
              <div className="admin-actions">
                <button className="admin-action-btn admin-action-resend" disabled={!!selected.emailConfirmedAt} onClick={() => setConfirmAction("resend")}>
                  Reenviar confirmação
                </button>
                {!selected.emailConfirmedAt ? null : <small className="admin-action-hint">E-mail já confirmado — reenvio não disponível.</small>}
                <button className="admin-action-btn admin-action-reset" disabled={!selected.emailConfirmedAt} onClick={() => setConfirmAction("reset")}>
                  Enviar recuperação de senha
                </button>
                {!selected.emailConfirmedAt && <small className="admin-action-hint">Disponível após a confirmação do e-mail.</small>}
              </div>
              {actionMessage && <p className="admin-action-message" role="status">{actionMessage}</p>}
            </div>
          </section>
        </div>
      )}

      {confirmAction && (
        <div className="overlay pwa-modal-overlay" onMouseDown={() => !actionBusy && setConfirmAction(null)}>
          <section className="clinical-modal admin-confirm-modal" onMouseDown={(e) => e.stopPropagation()}>
            <h2>Confirmar ação</h2>
            <p>{confirmAction === "resend" ? "Reenviar o e-mail de confirmação para este usuário?" : "Enviar e-mail de recuperação de senha para este usuário?"}</p>
            <button className="primary" disabled={actionBusy} onClick={runAction}>{actionBusy ? "Enviando..." : "Confirmar"}</button>
            <button disabled={actionBusy} onClick={() => setConfirmAction(null)}>Cancelar</button>
          </section>
        </div>
      )}
    </div>
  );
}
