"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Avatar from "../avatar";

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
  { id: "overview", label: "Visão geral" },
  { id: "users", label: "Usuários" },
  { id: "activation", label: "Ativação" },
  { id: "operations", label: "Operação" },
  { id: "audit", label: "Auditoria" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
function fmtDateShort(iso: string) {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" });
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

function LineChartCard({ title, points, formatValue, color = "#35c9b1" }: { title: string; points: { label: string; value: number }[]; formatValue: (n: number) => string; color?: string }) {
  const max = Math.max(...points.map((p) => p.value), 0.0001);
  const w = 600, h = 140, pad = 8;
  const stepX = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const coords = points.map((p, i) => [pad + i * stepX, h - pad - (p.value / max) * (h - pad * 2)] as const);
  const linePath = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1]?.[0] ?? pad},${h - pad} L${pad},${h - pad} Z`;
  const total = points.reduce((s, p) => s + p.value, 0);
  return (
    <article className="admin-chart-card">
      <header><h3>{title}</h3><b>{formatValue(total)}</b></header>
      {points.length === 0 || total === 0 ? (
        <div className="admin-chart-empty">Sem dados neste período ainda</div>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="admin-chart-svg">
          <path d={areaPath} fill={color} fillOpacity="0.14" stroke="none" />
          <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    fetch("/api/admin/funnel?days=7").then((r) => (r.ok ? r.json() : null)).then(setFunnel7).catch(() => {});
    fetch("/api/admin/funnel?days=30").then((r) => (r.ok ? r.json() : null)).then(setFunnel30).catch(() => {});
    fetch("/api/admin/time-series").then((r) => (r.ok ? r.json() : null)).then(setSeries).catch(() => {});
    fetch("/api/admin/operations").then((r) => (r.ok ? r.json() : null)).then(setOperations).catch(() => {});
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
  const sectionLabel = SECTIONS.find((s) => s.id === section)?.label ?? "";

  return (
    <div className="admin-shell">
      <button className="admin-mobile-nav-trigger" onClick={() => setMobileNavOpen(true)} aria-label="Abrir menu">☰</button>
      {mobileNavOpen && <div className="overlay admin-mobile-nav-overlay" onMouseDown={() => setMobileNavOpen(false)} />}
      <aside className={`admin-sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="admin-sidebar-brand">
          <span className="admin-sidebar-logo">S</span>
          <b>SemioLab</b>
        </div>
        <nav className="admin-sidebar-nav">
          {SECTIONS.map((s) => (
            <button key={s.id} className={section === s.id ? "active" : ""} onClick={() => { setSection(s.id); setMobileNavOpen(false); }}>{s.label}</button>
          ))}
        </nav>
        <Link className="admin-sidebar-back" href="/">← Voltar ao app</Link>
      </aside>

      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <h1>{sectionLabel}</h1>
            <small>{lastUpdated ? `Atualizado às ${lastUpdated.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : "Carregando..."}</small>
          </div>
          <button className="admin-refresh" onClick={() => { loadOverview(); if (section === "users") loadUsers(); if (section === "audit") loadAudit(); }}>Atualizar</button>
          <div className="admin-identity"><i>{adminEmail ? adminEmail[0]?.toUpperCase() : "A"}</i><span><b>{adminEmail || "Administrador"}</b><small>{adminRole === "super_admin" ? "Super admin" : "Admin"}</small></span></div>
        </header>

        {section === "overview" && (
          <>
            {!overview ? (
              <div className="admin-loading">Carregando visão geral...</div>
            ) : (
              <>
                <section className="admin-kpi-grid">
                  <article className="admin-kpi"><small>Usuários totais</small><b>{overview.totalUsers}</b><span>Base completa</span></article>
                  <article className="admin-kpi"><small>Confirmados</small><b>{overview.confirmedUsers}</b><span>{overview.pendingUsers} pendentes</span></article>
                  <article className="admin-kpi"><small>Ativos hoje</small><b>{overview.activeToday}</b><span>{overview.signups7d} cadastros em 7d</span></article>
                  <article className="admin-kpi"><small>Free / Trial / Pro</small><b>{overview.freeCount} / {overview.trialCount} / {overview.proCount}</b><span>Distribuição atual</span></article>
                  <article className="admin-kpi"><small>Custo IA hoje</small><b>{fmtUsd(overview.aiCostToday)}</b><span>{fmtUsd(overview.aiCostMonth)} no mês</span></article>
                  <article className="admin-kpi"><small>Atividade total</small><b>{overview.consultationsTotal + overview.quizAttemptsTotal + overview.simuladoAttemptsTotal}</b><span>{overview.quizAttemptsTotal} quiz · {overview.simuladoAttemptsTotal} simulado · {overview.consultationsTotal} paciente</span></article>
                </section>

                {series && (
                  <section className="admin-charts-grid">
                    <LineChartCard title="Cadastros — últimos 30 dias" points={series.signups30d.map((p) => ({ label: fmtDateShort(p.date), value: p.count }))} formatValue={(n) => `${n} cadastros`} color="#35c9b1" />
                    <LineChartCard title="Custo de IA — últimos 30 dias" points={series.aiCost30d.map((p) => ({ label: fmtDateShort(p.date), value: p.cost }))} formatValue={(n) => fmtUsd(n)} color="#f0a84e" />
                    <ActivityBarsCard points={series.activity7d.map((p) => ({ label: fmtDateShort(p.date), quiz: p.quiz, simulado: p.simulado, patient: p.patient }))} />
                  </section>
                )}
              </>
            )}
          </>
        )}

        {section === "activation" && (
          <section className="admin-funnel-panel">
            <div className="admin-funnel-toggle">
              <button className={funnelDays === 7 ? "active" : ""} onClick={() => setFunnelDays(7)}>7 dias</button>
              <button className={funnelDays === 30 ? "active" : ""} onClick={() => setFunnelDays(30)}>30 dias</button>
            </div>
            {!activeFunnel ? (
              <div className="admin-loading">Carregando funil...</div>
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
              <div className="admin-loading">Carregando operação...</div>
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
