"use client";

import { useEffect, useState, useCallback } from "react";

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
  id: string; email: string; name: string | null; xp: number; tier: string;
  created_at: string; email_confirmed_at: string | null; last_sign_in_at: string | null; trial_started_at: string | null;
};
type UserDetail = {
  id: string; email: string; name: string | null; xp: number; createdAt: string;
  emailConfirmedAt: string | null; lastSignInAt: string | null; trialStartedAt: string | null;
  subscription: { status: string; plan: string; updated_at: string } | null;
  streakDays: number; quizAttempts: number; simuladoAttempts: number; patientAttempts: number;
  aiCostTotal: number; pushSubscriptions: number;
};

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "pending", label: "Pendentes" },
  { id: "free", label: "Free" },
  { id: "trial", label: "Trial" },
  { id: "pro", label: "Pro" },
  { id: "recent", label: "Cadastro recente" },
] as const;

function fmtDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}
function tierOf(u: UserDetail): "free" | "trial" | "pro" {
  if (u.subscription?.status === "active") return "pro";
  if (u.trialStartedAt && Date.now() - new Date(u.trialStartedAt).getTime() < 7 * 24 * 60 * 60 * 1000) return "trial";
  return "free";
}
function fmtUsd(n: number) {
  return `$${n.toFixed(4)}`;
}

export default function AdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [selected, setSelected] = useState<UserDetail | null>(null);
  const [confirmAction, setConfirmAction] = useState<"resend" | "reset" | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    fetch("/api/admin/overview").then((r) => (r.ok ? r.json() : null)).then(setOverview).catch(() => {});
  }, []);

  const loadUsers = useCallback(() => {
    const params = new URLSearchParams({ search, filter, page: String(page) });
    fetch(`/api/admin/users?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) { setUsers(data.users || []); setTotal(data.total || 0); } })
      .catch(() => {});
  }, [search, filter, page]);
  useEffect(() => { loadUsers(); }, [loadUsers]);

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

  return (
    <div className="admin-page">
      <header className="admin-header"><h1>SemioLab — Administração</h1></header>

      {overview && (
        <section className="admin-grid">
          <article><small>Usuários totais</small><b>{overview.totalUsers}</b></article>
          <article><small>Confirmados</small><b>{overview.confirmedUsers}</b></article>
          <article><small>Pendentes</small><b>{overview.pendingUsers}</b></article>
          <article><small>Cadastros 7d / 30d</small><b>{overview.signups7d} / {overview.signups30d}</b></article>
          <article><small>Ativos hoje</small><b>{overview.activeToday}</b></article>
          <article><small>Free / Trial / Pro</small><b>{overview.freeCount} / {overview.trialCount} / {overview.proCount}</b></article>
          <article><small>Custo IA hoje / mês</small><b>{fmtUsd(overview.aiCostToday)} / {fmtUsd(overview.aiCostMonth)}</b></article>
          <article><small>Atendimentos</small><b>{overview.consultationsTotal}</b></article>
          <article><small>Quizzes</small><b>{overview.quizAttemptsTotal}</b></article>
          <article><small>Simulados</small><b>{overview.simuladoAttemptsTotal}</b></article>
          <article><small>Último job de questões</small><b>{overview.lastQuestionJob?.status ?? "—"}</b></article>
          <article><small>Notificações sem entrega hoje</small><b>{overview.failedNotifications}</b></article>
        </section>
      )}

      <section className="admin-users-panel">
        <div className="admin-toolbar">
          <input placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          <div className="admin-filters">
            {FILTERS.map((f) => (
              <button key={f.id} className={filter === f.id ? "active" : ""} onClick={() => { setFilter(f.id); setPage(1); }}>{f.label}</button>
            ))}
          </div>
        </div>
        <table className="admin-table">
          <thead><tr><th>Nome</th><th>E-mail</th><th>Cadastro</th><th>Confirmado</th><th>Último login</th><th>Tier</th><th>Trial até</th><th>XP</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} onClick={() => openDetail(u.id)}>
                <td>{u.name || "—"}</td>
                <td>{u.email}</td>
                <td>{fmtDate(u.created_at) ?? "—"}</td>
                <td>{u.email_confirmed_at ? "Sim" : "Não"}</td>
                <td>{fmtDate(u.last_sign_in_at) ?? "—"}</td>
                <td><span className={`admin-tier admin-tier-${u.tier}`}>{u.tier}</span></td>
                <td>{fmtDate(u.trial_started_at) ?? "—"}</td>
                <td>{u.xp}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="admin-pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</button>
          <span>Página {page} de {Math.max(1, Math.ceil(total / 20))} · {total} usuários</span>
          <button disabled={page * 20 >= total} onClick={() => setPage((p) => p + 1)}>Próxima</button>
        </div>
      </section>

      {selected && (
        <div className="overlay pwa-modal-overlay" onMouseDown={() => setSelected(null)}>
          <section className="clinical-modal admin-detail-modal" onMouseDown={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setSelected(null)}>×</button>
            <header className="admin-detail-head">
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
              </div>
            </header>

            <div className="admin-detail-block">
              <h3>Conta</h3>
              <div className="admin-detail-grid">
                <span><small>Cadastro</small><b>{fmtDate(selected.createdAt) ?? "Data indisponível"}</b></span>
                <span><small>Confirmado</small><b>{fmtDate(selected.emailConfirmedAt) ?? "Não confirmado"}</b></span>
                <span><small>Último login</small><b>{fmtDate(selected.lastSignInAt) ?? "Nunca acessou"}</b></span>
              </div>
            </div>

            <div className="admin-detail-block">
              <h3>Plano</h3>
              <div className="admin-detail-grid">
                <span><small>Trial desde</small><b>{fmtDate(selected.trialStartedAt) ?? "Sem período de teste"}</b></span>
                <span><small>Assinatura</small><b>{selected.subscription ? `${selected.subscription.plan} (${selected.subscription.status})` : "Nenhuma assinatura"}</b></span>
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
