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
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
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
                <td>{fmtDate(u.created_at)}</td>
                <td>{u.email_confirmed_at ? "Sim" : "Não"}</td>
                <td>{fmtDate(u.last_sign_in_at)}</td>
                <td><span className={`admin-tier admin-tier-${u.tier}`}>{u.tier}</span></td>
                <td>{fmtDate(u.trial_started_at)}</td>
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
            <h2>{selected.name || "Sem nome"}</h2>
            <p>{selected.email}</p>
            <div className="admin-detail-grid">
              <span><small>Cadastro</small><b>{fmtDate(selected.createdAt)}</b></span>
              <span><small>Confirmado</small><b>{fmtDate(selected.emailConfirmedAt)}</b></span>
              <span><small>Último login</small><b>{fmtDate(selected.lastSignInAt)}</b></span>
              <span><small>Trial desde</small><b>{fmtDate(selected.trialStartedAt)}</b></span>
              <span><small>Assinatura</small><b>{selected.subscription ? `${selected.subscription.plan} (${selected.subscription.status})` : "—"}</b></span>
              <span><small>XP</small><b>{selected.xp}</b></span>
              <span><small>Streak</small><b>{selected.streakDays} dias</b></span>
              <span><small>Quiz / Simulado / Paciente</small><b>{selected.quizAttempts} / {selected.simuladoAttempts} / {selected.patientAttempts}</b></span>
              <span><small>Custo IA total</small><b>{fmtUsd(selected.aiCostTotal)}</b></span>
              <span><small>Notificações ativas</small><b>{selected.pushSubscriptions}</b></span>
            </div>
            <div className="admin-actions">
              <button disabled={!!selected.emailConfirmedAt} onClick={() => setConfirmAction("resend")}>Reenviar confirmação</button>
              <button disabled={!selected.emailConfirmedAt} onClick={() => setConfirmAction("reset")}>Enviar recuperação de senha</button>
            </div>
            {actionMessage && <p className="admin-action-message">{actionMessage}</p>}
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
