"use client";

import { useEffect, useState } from "react";

/* Aba "Comportamento" do admin: responde "por que as pessoas se cadastram
   e somem?" com dados — retenção por coorte, o que cada grupo fez no 1º
   dia, funil completo, rota entre telas, paywall, abandono e latência. */

type Cohort = { week: string; size: number; opened: number; d1: number; w1: number; m1: number; consult_d0: number };
type Segment = { label: string; n: number; returned: number };
type FunnelStep = { label: string; value: number };
type Transition = { from: string; to: string; n: number; users: number };
type ScreenTotal = { screen: string; views: number; users: number };
type ExitScreen = { screen: string; users: number };
type Paywall = { reason: string; shown: number; shown_users: number; clicks: number; click_users: number };
type Bucket = { bucket: string; n: number };
type LatencyDay = { day: string; n: number; ttft_p50: number; ttft_p90: number; total_p50: number; total_p90: number };

type Behavior = {
  totals: { users: number; neverOpened: number; d1: number; w1: number; didNothingReal: number; pushOn: number };
  cohorts: Cohort[];
  segments: Segment[];
  funnel: FunnelStep[];
  transitions: Transition[];
  screens: ScreenTotal[];
  exits: ExitScreen[];
  paywall: Paywall[];
  abandoned: Bucket[];
  latency: LatencyDay[];
  latencyLegacy: { p50: number | null; p90: number | null; n: number } | null;
  hours: { hour: number; n: number }[];
};

const SCREEN_LABELS: Record<string, string> = {
  home: "Início", patient: "Paciente IA", quiz: "Quiz / Simulados", study: "Atlas TC 3D", auscultation: "Laboratório de ausculta",
  profile: "Perfil", progress: "Progresso", ranking: "Ranking", achievements: "Conquistas", semiology: "Semiologia",
  flashcards: "Flashcards", research: "Pesquisa", referrals: "Indicações",
};
const PAYWALL_LABELS: Record<string, string> = {
  daily: "Oferta diária automática", limit: "Limite diário de consultas", weekly: "Consulta da semana (gratuito)",
  auscultation: "Laboratório de ausculta", audio: "Voz", patient: "Paciente IA", simulado: "Simulados",
  exams: "Limite de exames", flashcards: "Limite de flashcards", backend: "Recurso bloqueado",
};
const screenLabel = (id: string | null) => (id ? SCREEN_LABELS[id] ?? id : "—");
const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
const ms = (value: number | null | undefined) => (value == null ? "—" : `${(value / 1000).toFixed(1).replace(".", ",")} s`);
const weekLabel = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};

function Bars<T>({ rows, label, value, suffix }: { rows: T[]; label: (row: T) => string; value: (row: T) => number; suffix?: (row: T) => string }) {
  const max = Math.max(...rows.map(value), 1);
  return (
    <div className="admin-topic-bars admin-topic-bars-wide">
      {rows.map((row, index) => (
        <div className="admin-topic-row" key={`${label(row)}-${index}`}>
          <span>{label(row)}</span>
          <div className="admin-topic-track"><i style={{ width: `${(value(row) / max) * 100}%` }} /></div>
          <b>{suffix ? suffix(row) : value(row)}</b>
        </div>
      ))}
    </div>
  );
}

export function BehaviorSection() {
  const [data, setData] = useState<Behavior | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/behavior")
      .then(async (r) => {
        const body = await r.json().catch(() => null);
        if (cancelled) return;
        if (!r.ok || !body) setError(body?.error || "Não foi possível carregar o comportamento.");
        else setData(body);
      })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar o comportamento."); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <p className="admin-hero-sub admin-note" role="alert">{error}</p>;
  if (!data) return <div className="admin-kpi-grid" aria-busy="true">{[0, 1, 2, 3].map((i) => <article className="admin-kpi" key={i} style={{ minHeight: 92 }} />)}</div>;

  const { totals } = data;
  const base = data.segments.find((s) => s.label === "Todos os cadastros");
  const baseRate = base ? pct(base.returned, base.n) : 0;
  const funnelTop = data.funnel[0]?.value ?? 0;
  const worstDrop = data.funnel.slice(1).reduce<{ label: string; lost: number; pctLost: number } | null>((worst, step, index) => {
    const previous = data.funnel[index];
    // "Voltou em outro dia" e "Virou assinante" não são etapas em sequência
    // estrita da anterior — a maior queda só compara o caminho de ativação.
    if (index >= 6 || previous.value <= 0) return worst;
    const lost = previous.value - step.value;
    const pctLost = Math.round((lost / previous.value) * 100);
    return !worst || pctLost > worst.pctLost ? { label: `${previous.label} → ${step.label}`, lost, pctLost } : worst;
  }, null);
  const hasScreens = data.screens.length > 0;
  const latestLatency = data.latency[0];

  return (
    <>
      <section className="admin-kpi-grid">
        <article className="admin-kpi">
          <small>Voltaram no dia seguinte (D1)</small>
          <b>{pct(totals.d1, totals.users)}%</b>
          <span>{totals.d1} de {totals.users} cadastros</span>
        </article>
        <article className="admin-kpi">
          <small>Voltaram em até 7 dias</small>
          <b>{pct(totals.w1, totals.users)}%</b>
          <span>{totals.w1} de {totals.users} cadastros</span>
        </article>
        <article className="admin-kpi">
          <small>Nunca fizeram consulta nem quiz</small>
          <b className="admin-text-warn">{pct(totals.didNothingReal, totals.users)}%</b>
          <span>{totals.didNothingReal} pessoas só viram o microcaso (ou nada)</span>
        </article>
        <article className="admin-kpi">
          <small>Nunca abriram o app</small>
          <b>{totals.neverOpened}</b>
          <span>cadastraram e não entraram · {totals.pushOn} com push ativo</span>
        </article>
      </section>

      {worstDrop && (
        <p className="admin-hero-sub admin-note">
          Maior perda do funil: <b>{worstDrop.label}</b> — {worstDrop.lost} pessoas ficam pelo caminho ({worstDrop.pctLost}% da etapa).
        </p>
      )}

      <h3 className="admin-subheading">Funil completo — todos os cadastros</h3>
      <section className="admin-funnel-panel">
        <div className="admin-funnel-steps">
          {data.funnel.map((step, index) => {
            const previous = index === 0 ? null : data.funnel[index - 1].value;
            return (
              <div className="admin-funnel-step" key={step.label}>
                <small>{step.label}</small>
                <b>{step.value}</b>
                <div className="admin-funnel-bar"><i style={{ width: `${pct(step.value, funnelTop)}%` }} /></div>
                <span>{previous ? `${pct(step.value, previous)}% da etapa anterior` : "—"} · {pct(step.value, funnelTop)}% do total</span>
              </div>
            );
          })}
        </div>
      </section>

      <h3 className="admin-subheading">O que a pessoa fez no 1º dia × se voltou em até 14 dias</h3>
      <section className="admin-chart-card">
        <div className="admin-table-wrap">
          <table className="admin-table admin-table-static">
            <thead><tr><th>Grupo</th><th>Pessoas</th><th>Voltaram</th><th>Taxa de retorno</th><th>vs. média</th></tr></thead>
            <tbody>
              {data.segments.map((segment) => {
                const rate = pct(segment.returned, segment.n);
                const diff = rate - baseRate;
                return (
                  <tr key={segment.label}>
                    <td>{segment.label}</td>
                    <td>{segment.n}</td>
                    <td>{segment.returned}</td>
                    <td><b>{rate}%</b></td>
                    <td className={diff > 0 ? "admin-diff-up" : diff < 0 ? "admin-diff-down" : ""}>{segment.label === "Todos os cadastros" ? "—" : `${diff > 0 ? "+" : ""}${diff} p.p.`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="admin-hero-sub admin-note">Só entram cadastros com 14+ dias. Os grupos com taxa bem acima da média mostram qual ação do 1º dia segura o usuário — é para lá que o onboarding deve empurrar.</p>
      </section>

      <h3 className="admin-subheading">Retenção por semana de cadastro</h3>
      <section className="admin-chart-card">
        <div className="admin-table-wrap">
          <table className="admin-table admin-table-static">
            <thead><tr><th>Semana</th><th>Cadastros</th><th>Abriram o app</th><th>Consulta no 1º dia</th><th>D1</th><th>Dias 1–7</th><th>Dias 8–30</th></tr></thead>
            <tbody>
              {data.cohorts.map((cohort) => (
                <tr key={cohort.week}>
                  <td>{weekLabel(cohort.week)}</td>
                  <td>{cohort.size}</td>
                  <td>{pct(cohort.opened, cohort.size)}%</td>
                  <td>{pct(cohort.consult_d0, cohort.size)}%</td>
                  <td>{pct(cohort.d1, cohort.size)}%</td>
                  <td>{pct(cohort.w1, cohort.size)}%</td>
                  <td>{pct(cohort.m1, cohort.size)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="admin-hero-sub admin-note">Semanas recentes ainda não tiveram tempo de completar as colunas de 7 e 30 dias.</p>
      </section>

      <h3 className="admin-subheading">Rota dentro do app — últimos 30 dias</h3>
      {!hasScreens ? (
        <p className="admin-hero-sub admin-note">Ainda sem dados: a rota entre telas começou a ser registrada nesta versão. Os números aparecem aqui conforme os usuários navegarem.</p>
      ) : (
        <section className="admin-charts-grid">
          <article className="admin-chart-card">
            <header><h3>Telas mais visitadas (usuários únicos)</h3></header>
            <Bars rows={data.screens} label={(row) => screenLabel(row.screen)} value={(row) => row.users} suffix={(row) => `${row.users} · ${row.views} visitas`} />
          </article>
          <article className="admin-chart-card">
            <header><h3>Caminhos mais comuns (de → para)</h3></header>
            <Bars rows={data.transitions.slice(0, 12)} label={(row) => `${screenLabel(row.from)} → ${screenLabel(row.to)}`} value={(row) => row.n} suffix={(row) => `${row.n} · ${row.users} usuários`} />
          </article>
          <article className="admin-chart-card">
            <header><h3>Última tela de quem sumiu (3+ dias sem voltar)</h3></header>
            {data.exits.length ? <Bars rows={data.exits} label={(row) => screenLabel(row.screen)} value={(row) => row.users} /> : <p className="admin-hero-sub">Ninguém nessa condição ainda.</p>}
            <p className="admin-hero-sub admin-note">A tela em que a pessoa estava quando desistiu — o primeiro lugar para procurar atrito.</p>
          </article>
        </section>
      )}

      <h3 className="admin-subheading">Paywall, abandono e resposta da IA</h3>
      <section className="admin-charts-grid">
        <article className="admin-chart-card">
          <header><h3>Paywall: exibições × cliques em assinar</h3></header>
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-static">
              <thead><tr><th>Motivo</th><th>Exibido</th><th>Cliques</th><th>Conversão</th></tr></thead>
              <tbody>
                {data.paywall.length === 0 && <tr className="admin-table-empty"><td colSpan={4}>Nenhum registro ainda.</td></tr>}
                {data.paywall.map((row) => (
                  <tr key={row.reason}>
                    <td>{PAYWALL_LABELS[row.reason] ?? row.reason}</td>
                    <td>{row.shown > 0 ? `${row.shown} (${row.shown_users} pessoas)` : "—"}</td>
                    <td>{row.clicks} ({row.click_users} pessoas)</td>
                    <td>{row.shown_users > 0 ? `${pct(row.click_users, row.shown_users)}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="admin-hero-sub admin-note">As exibições começaram a ser contadas nesta versão; cliques anteriores aparecem sem exibição correspondente.</p>
        </article>
        <article className="admin-chart-card">
          <header><h3>Consultas abandonadas (abertas há 6+ horas)</h3><b>{data.abandoned.reduce((sum, row) => sum + row.n, 0)}</b></header>
          {data.abandoned.length ? <Bars rows={data.abandoned} label={(row) => row.bucket} value={(row) => row.n} /> : <p className="admin-hero-sub">Nenhuma consulta abandonada.</p>}
          <p className="admin-hero-sub admin-note">Abandono com 0–2 perguntas indica que a pessoa travou logo no começo: não soube o que perguntar.</p>
        </article>
        <article className="admin-chart-card">
          <header><h3>Tempo de resposta do Paciente IA</h3><b>{latestLatency ? ms(latestLatency.ttft_p50) : ms(data.latencyLegacy?.p50)}</b></header>
          {data.latency.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table admin-table-static">
                <thead><tr><th>Dia</th><th>Respostas</th><th>1ª palavra (mediana)</th><th>1ª palavra (90%)</th><th>Resposta inteira (90%)</th></tr></thead>
                <tbody>
                  {data.latency.map((day) => (
                    <tr key={day.day}>
                      <td>{weekLabel(day.day)}</td><td>{day.n}</td><td>{ms(day.ttft_p50)}</td><td>{ms(day.ttft_p90)}</td><td>{ms(day.total_p90)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-hero-sub">
              Medição direta ainda sem dados. Estimativa dos últimos 30 dias (resposta inteira): mediana {ms(data.latencyLegacy?.p50)}, 90% abaixo de {ms(data.latencyLegacy?.p90)} ({data.latencyLegacy?.n ?? 0} respostas).
            </p>
          )}
          <p className="admin-hero-sub admin-note">&quot;1ª palavra&quot; é o tempo entre o estudante enviar a pergunta e o paciente começar a responder.</p>
        </article>
        <article className="admin-chart-card">
          <header><h3>Horário das consultas (Brasília)</h3></header>
          <div className="admin-hour-bars" role="img" aria-label="Consultas iniciadas por hora do dia">
            {Array.from({ length: 24 }, (_, hour) => {
              const count = data.hours.find((h) => h.hour === hour)?.n ?? 0;
              const max = Math.max(...data.hours.map((h) => h.n), 1);
              return <span key={hour} title={`${hour}h: ${count} consultas`}><i style={{ height: `${Math.max(4, (count / max) * 100)}%` }} /><small>{hour % 3 === 0 ? `${hour}h` : ""}</small></span>;
            })}
          </div>
          <p className="admin-hero-sub admin-note">Use os picos para escolher o horário das notificações e dos e-mails de retorno.</p>
        </article>
      </section>
    </>
  );
}

type TimelineEvent = { at: string; kind: string; label: string };

/** Linha do tempo de um usuário no detalhe do admin: a sequência real do
 * que ele fez — para ver exatamente onde cada pessoa parou. */
export function UserTimeline({ userId }: { userId: string }) {
  const [state, setState] = useState<{ userId: string; events: TimelineEvent[] | null; error: boolean }>({ userId, events: null, error: false });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/users/${userId}/timeline`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("falha"))))
      .then((body) => { if (!cancelled) setState({ userId, events: body.events ?? [], error: false }); })
      .catch(() => { if (!cancelled) setState({ userId, events: null, error: true }); });
    return () => { cancelled = true; };
  }, [userId]);

  const current = state.userId === userId ? state : { userId, events: null, error: false };
  const screenText = (label: string) => label.replace(/^Abriu a tela: (.+)$/, (_, id: string) => `Abriu a tela: ${screenLabel(id)}`);

  return (
    <div className="admin-detail-block">
      <h3>Linha do tempo</h3>
      {current.error ? (
        <p className="admin-action-hint">Não foi possível carregar a linha do tempo.</p>
      ) : !current.events ? (
        <p className="admin-action-hint">Carregando…</p>
      ) : current.events.length === 0 ? (
        <p className="admin-action-hint">Nenhuma atividade registrada.</p>
      ) : (
        <ol className="admin-timeline">
          {current.events.map((event, index) => (
            <li key={`${event.at}-${index}`} className={`admin-timeline-${event.kind}`}>
              <time dateTime={event.at}>{new Date(event.at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</time>
              <span>{screenText(event.label)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
