"use client";
import { useMemo, useState, useRef, useEffect } from "react";
import {
  Activity, ArrowLeft, Award, BarChart3, Bell, BookOpen, Brain, Check,
  BadgeCheck, Camera, ChevronRight, CircleAlert, ClipboardCheck, Clock3, CreditCard, FileText, Flame, HeartPulse,
  AudioLines, HelpCircle, Mail, MessageCircle, Palette,
  Home, LibraryBig, LockKeyhole, LogOut, Menu, MessageSquareText,
  Search, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Stethoscope, Target,
  Trophy, UserRound, X, Zap,
} from "lucide-react";
import PatientExperience from "./patient-experience";
import QuizExperience from "./quiz-experience";
import RankingExperience, { HomeRankCard } from "./ranking-experience";
import PwaOnboarding, { NotificationSettingsPanel } from "./pwa-onboarding";
import { HeartDashboardHero } from "@/components/ui/heart-dashboard-hero";
import { createPortal } from "react-dom";
import { useUser } from "./user-context";
import { createClient } from "@/lib/supabase/client";
import { levelFromXp, safeDisplayName } from "@/lib/level";
import { useLearningSummary } from "./use-learning-summary";
import {
  useScreenTransition, useStaggerReveal, useCountUp, useMasteryBars,
  useStreakPop, useModalEntrance, usePulseGlow, useSidebarReveal, useChartBars,
} from "@/components/animations";

type Screen = "home"|"study"|"auscultation"|"patient"|"quiz"|"profile"|"progress"|"ranking"|"achievements";

/* ─── Data ─────────────────────────────────────────────────────── */
const systems = [
  { name:"Cardiovascular", done:68, lessons:8, icon:HeartPulse, color:"mint", summary:"Organize inspeção, palpação e ausculta para reconhecer perfis hemodinâmicos e valvopatias.", topics:["Pressão arterial e pulsos","Turgência jugular","Bulhas e desdobramentos","Sopros e manobras"], clinical:"Relacione cada achado ao mecanismo: volume, pressão, fluxo e função valvar. Um sopro nunca deve ser interpretado sem localização, tempo, intensidade, irradiação e resposta às manobras." },
  { name:"Respiratório",   done:46, lessons:7, icon:Activity,   color:"blue", summary:"Use o exame do tórax para diferenciar consolidação, derrame, obstrução e excesso de ar.", topics:["Padrão respiratório","Expansibilidade e frêmito","Percussão pulmonar","Murmúrio e ruídos adventícios"], clinical:"Compare os dois hemitórax e integre inspeção, palpação, percussão e ausculta. Achados isolados têm menor valor do que padrões concordantes." },
  { name:"Anamnese",       done:82, lessons:6, icon:MessageSquareText, color:"gold", summary:"Conduza uma entrevista centrada no paciente sem perder precisão cronológica e clínica.", topics:["Abertura da consulta","História da doença atual","Antecedentes e medicamentos","Revisão de sistemas"], clinical:"Comece com perguntas abertas, esclareça as palavras do paciente e depois focalize duração, evolução, intensidade, fatores associados, agravantes e atenuantes." },
  { name:"Neurológico",    done:31, lessons:9, icon:Brain,      color:"violet", summary:"Localize a lesão antes de nomear a doença com um exame neurológico dirigido.", topics:["Estado mental e linguagem","Pares cranianos","Força, tônus e reflexos","Coordenação, sensibilidade e marcha"], clinical:"Observe simetria, compare segmentos e confirme déficits com mais de uma manobra. A combinação dos achados é o que permite a localização neuroanatômica." },
  { name:"Abdome e digestório", done:24, lessons:8, icon:Stethoscope, color:"rose", summary:"Interprete dor, distensão, massas e sinais de irritação peritoneal com sequência correta.", topics:["Inspeção e ausculta","Percussão e ascite","Palpação superficial e profunda","Fígado, baço e sinais especiais"], clinical:"No abdome, ausculte antes de percutir e palpar. Considere topografia, defesa, rigidez e dor à descompressão como partes de um contexto clínico, não como diagnósticos isolados." },
  { name:"Exame físico",   done:57, lessons:7, icon:ClipboardCheck, color:"cyan", summary:"Construa uma avaliação geral reprodutível, dos sinais vitais ao exame por sistemas.", topics:["Estado geral e consciência","Sinais vitais","Pele e mucosas","Edema, linfonodos e antropometria"], clinical:"Descreva o que observou com medidas e termos padronizados. Reavalie sinais vitais anormais e priorize achados que mudam a urgência ou a hipótese clínica." },
];
const questions = [
  { text:"Na estenose mitral, qual achado é mais característico à ausculta?", options:["Sopro sistólico ejetivo","Ruflar diastólico em foco mitral","Sopro contínuo","Atrito pericárdico"], correct:1, why:"O ruflar diastólico ocorre pela passagem turbulenta do sangue através da valva mitral estreitada." },
  { text:"Qual sinal sugere comprometimento do trato corticoespinhal?", options:["Romberg","Babinski","Lasègue","Murphy"], correct:1, why:"O sinal de Babinski indica disfunção do neurônio motor superior e do trato corticoespinhal." },
  { text:"Macicez à percussão e redução do murmúrio vesicular sugerem:", options:["Pneumotórax","Asma","Derrame pleural","Bronquite"], correct:2, why:"O líquido pleural produz macicez e reduz a transmissão do murmúrio vesicular." },
];
/* ─── Logo ──────────────────────────────────────────────────────── */
function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className={`logo ${small ? "logo-compact" : "logo-signature"}`}>
      {small
        ? <img className="brand-mark" src="/semiolab-fox.png" alt="SemioLab" />
        : <img className="brand-wordmark" src="/semiolab-wordmark.png" alt="SemioLab" />
      }
    </div>
  );
}

const nav = [
  { id:"home"    as Screen, name:"Início",        icon:Home },
  { id:"study"   as Screen, name:"Ensino",         icon:LibraryBig },
  { id:"auscultation" as Screen, name:"Laboratório", icon:AudioLines },
  { id:"patient" as Screen, name:"Paciente",       icon:Stethoscope },
  { id:"quiz"    as Screen, name:"Quiz e simulados", icon:ClipboardCheck },
  { id:"profile" as Screen, name:"Perfil",         icon:UserRound },
];

const mobileNav = nav.filter((item) => item.id !== "auscultation");
const drawerNav = [
  ...nav,
  { id:"progress" as Screen, name:"Progresso", icon:BarChart3 },
  { id:"ranking" as Screen, name:"Ranking", icon:Trophy },
  { id:"achievements" as Screen, name:"Conquistas", icon:Award },
];

const embeddedRoutes: Partial<Record<Screen, string>> = {
  study: "/atlas-tc-3d-portugues-v2.html",
  auscultation: "/semiolab-laboratorio-ausculta.html",
};

function warmEmbedded(screen: Screen) {
  const href = embeddedRoutes[screen];
  if (!href || typeof document === "undefined") return;
  if (document.head.querySelector(`link[data-semiolab-prefetch="${screen}"]`)) return;
  const link = document.createElement("link");
  link.rel = "prefetch";
  link.as = "document";
  link.href = href;
  link.dataset.semiolabPrefetch = screen;
  document.head.appendChild(link);
}

/* ─── Navigation ────────────────────────────────────────────────── */
function Navigation({ screen, go, open, setOpen }: { screen:Screen; go:(s:Screen)=>void; open:boolean; setOpen:(v:boolean)=>void }) {
  const user = useUser();
  const { summary: learning } = useLearningSummary();
  const displayName = safeDisplayName(user.name, user.email);
  const initials = initialsFor(displayName);
  const level = levelFromXp(learning?.profile?.xp ?? user.xp ?? 0);
  const sideRef = useSidebarReveal(open);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = (next: Screen) => {
    setDrawerOpen(false);
    go(next);
  };
  return (
    <>
      <aside ref={sideRef as any} className={open ? "side open" : "side closed"}>
        <header>
          <Logo small={!open} />
          {open && <button onClick={() => setOpen(false)}><Menu /></button>}
        </header>
        <nav>
          {nav.map((x) => (
            <button
              key={x.id}
              className={screen === x.id ? "active" : ""}
              onPointerEnter={() => warmEmbedded(x.id)}
              onPointerDown={() => warmEmbedded(x.id)}
              onFocus={() => warmEmbedded(x.id)}
              onClick={() => go(x.id)}
            >
              <x.icon /><span>{x.name}</span>
            </button>
          ))}
        </nav>
        <div className="side-extra">
          <button className={screen === "progress" ? "active" : ""} onClick={() => go("progress")}><BarChart3 /><span>Progresso</span></button>
          <button className={screen === "ranking"  ? "active" : ""} onClick={() => go("ranking")}><Trophy /><span>Ranking</span></button>
        </div>
        <button className="side-user" onClick={() => go("profile")}>
          <i>{initials}</i>
          <span><b>{displayName}</b><small>Estudante · Nível {level}</small></span>
        </button>
        {!open && <button className="reopen" onClick={() => setOpen(true)}><Menu /></button>}
      </aside>
      <button
        className="mobile-drawer-trigger"
        aria-label="Abrir menu completo"
        aria-expanded={drawerOpen}
        onClick={() => setDrawerOpen(true)}
      ><Menu /></button>
      <div className={`mobile-drawer-layer ${drawerOpen ? "open" : ""}`} aria-hidden={!drawerOpen}>
        <button className="mobile-drawer-backdrop" aria-label="Fechar menu" onClick={() => setDrawerOpen(false)} />
        <aside className="mobile-drawer" aria-label="Todas as funcionalidades">
          <header className="mobile-drawer-head">
            <button aria-label="Fechar menu" onClick={() => setDrawerOpen(false)}><X /></button>
          </header>
          <small className="mobile-drawer-kicker">NAVEGAÇÃO</small>
          <nav>
            {drawerNav.map((item) => (
              <button
                key={item.id}
                className={screen === item.id ? "active" : ""}
                onPointerDown={() => warmEmbedded(item.id)}
                onClick={() => navigate(item.id)}
              >
                <item.icon /><span>{item.name}</span><ChevronRight />
              </button>
            ))}
          </nav>
          <button className="mobile-drawer-account" onClick={() => navigate("profile")}>
            <i>{initials}</i><span><b>{displayName}</b><small>Estudante · Nível {level}</small></span><ChevronRight />
          </button>
        </aside>
      </div>
      <nav className="bottom-nav">
        {mobileNav.map((x) => (
          <button
            key={x.id}
            className={screen === x.id ? "active" : ""}
            aria-label={x.name}
            title={x.name}
            onPointerDown={() => warmEmbedded(x.id)}
            onFocus={() => warmEmbedded(x.id)}
            onClick={() => go(x.id)}
          >
            <x.icon />
          </button>
        ))}
      </nav>
    </>
  );
}

function useTodayLabel() {
  const [label, setLabel] = useState("Hoje");
  useEffect(() => {
    const update = () => {
      const value = new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        day: "2-digit",
        month: "long",
      }).format(new Date());
      setLabel(value.charAt(0).toUpperCase() + value.slice(1));
    };
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return label;
}

const weekDays = ["SEG", "TER", "QUA", "QUI", "SEX", "SÁB", "DOM"];
function useLocalWeek(loginDays: string[] = []) {
  const [todayIndex, setTodayIndex] = useState(0);
  useEffect(() => {
    const update = () => setTodayIndex((new Date().getDay() + 6) % 7);
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const doneSet = new Set(loginDays);
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(startOfWeek.getDate() - todayIndex);
  return weekDays.map((day, index) => {
    const cellDate = new Date(startOfWeek);
    cellDate.setDate(startOfWeek.getDate() + index);
    const key = localDateKey(cellDate);
    const state = index === todayIndex ? "today" : index < todayIndex ? (doneSet.has(key) ? "done" : "future") : "future";
    return { day, state };
  });
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function activityCalendar(days: string[], weekCount = 18) {
  const active = new Set(days);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const mondayIndex = (today.getDay() + 6) % 7;
  const first = new Date(today);
  first.setDate(today.getDate() - mondayIndex - (weekCount - 1) * 7);
  const cells = Array.from({ length: weekCount * 7 }, (_, index) => {
    const date = new Date(first);
    date.setDate(first.getDate() + index);
    const key = localDateKey(date);
    return {
      key,
      week: Math.floor(index / 7),
      weekday: index % 7,
      active: active.has(key),
      today: key === localDateKey(today),
      future: date > today,
      label: date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" }),
    };
  });
  const months = Array.from({ length: weekCount }, (_, week) => {
    const date = new Date(first);
    date.setDate(first.getDate() + week * 7);
    const previous = new Date(date);
    previous.setDate(date.getDate() - 7);
    return week === 0 || date.getMonth() !== previous.getMonth()
      ? date.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")
      : "";
  });
  let currentStreak = 0;
  const cursor = new Date(today);
  while (active.has(localDateKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  let longestStreak = 0;
  let running = 0;
  [...active].sort().forEach((key, index, sorted) => {
    const previous = index ? new Date(`${sorted[index - 1]}T12:00:00`) : null;
    const current = new Date(`${key}T12:00:00`);
    running = previous && Math.round((current.getTime() - previous.getTime()) / 86400000) === 1 ? running + 1 : 1;
    longestStreak = Math.max(longestStreak, running);
  });
  return { active, cells, months, currentStreak, longestStreak };
}

function greetingFor(name: string) {
  const hour = new Date().getHours();
  const period = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  return `${period}, ${name.split(" ")[0]}`;
}
function initialsFor(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U";
}
function Top({ title, go }: { title?: string; go:(s:Screen)=>void }) {
  const today = useTodayLabel();
  const user = useUser();
  return (
    <header className="top">
      <div>
        <small>{today}</small>
        <h2>{title || greetingFor(user.name)}</h2>
      </div>
      <div>
        <button><Bell /><i /></button>
        <button className="avatar" onClick={() => go("profile")}>{initialsFor(user.name)}</button>
      </div>
    </header>
  );
}

/* ─── HomePage ──────────────────────────────────────────────────── */
function HomePage({ go, checkin }: { go:(s:Screen)=>void; checkin:()=>void }) {
  const pageRef = useScreenTransition("home");
  const dashRef = useRef<HTMLDivElement>(null);
  const streakRef = useRef<HTMLDivElement>(null);

  useStreakPop(streakRef);
  useChartBars(dashRef);
  useMasteryBars(dashRef);

  const { summary: learning, loading: learningLoading } = useLearningSummary();
  // Contadores animados com dados reais — nunca valores de exemplo.
  const realXp = learning?.profile?.xp ?? 0;
  const realActivities = learning?.stats?.activities ?? 0;
  const xpRef  = useCountUp(realXp, " XP");
  const minRef = useCountUp(0); // minutos de estudo ainda não são rastreados pelo sistema
  const actRef = useCountUp(realActivities);
  const today = useTodayLabel();
  const streak = learning?.streak ?? 0;
  const localWeek = useLocalWeek(learning?.loginDays);
  const weeklyActivity = learning?.weeklyActivity ?? [0, 0, 0, 0, 0, 0, 0];
  const weeklyMax = Math.max(1, ...weeklyActivity);
  const nextMilestone = streak === 0 ? 3 : [3, 7, 15, 30, 60, 100].find((m) => m > streak) ?? streak + 30;
  const milestoneProgress = Math.min(100, Math.round((streak / nextMilestone) * 100));
  const homeAvailableScores = (learning?.mastery || []).flatMap((item) => item.score === null ? [] : [item.score]);
  const generalMastery = homeAvailableScores.length ? Math.round(homeAvailableScores.reduce((sum, value) => sum + value, 0) / homeAvailableScores.length) : null;
  const tier = learning?.pro?.tier;
  const patientSubtitle =
    tier === "pro" ? "Consulta sem pistas · 8–12 min" :
    tier === "trial" ? `Teste grátis · ${learning?.pro?.trialDaysLeft ?? 0}d restantes` :
    tier === "free" ? "Plano básico · 1 consulta/dia" :
    "Consulta sem pistas · 8–12 min";

  return (
    <div className="page home-page" ref={pageRef}>
      <Top go={go} />
      <div className="dash" ref={dashRef}>
        <HeartDashboardHero
          onContinue={() => go("study")}
          streakDays={streak}
          progressPercent={generalMastery ?? 0}
          activitiesToday={weeklyActivity[(new Date().getDay() + 6) % 7] ?? 0}
          activitiesGoal={5}
        />

        <section className="quick">
          <header>
            <small>ACESSO RÁPIDO</small>
            <h3>O que vamos treinar?</h3>
          </header>
          <button className="next-patient" onClick={() => go("patient")}>
            <i><Stethoscope /></i>
            <span><b>Próximo paciente</b><small>{patientSubtitle}</small></span>
            <ChevronRight />
          </button>
          <div>
            <button onClick={() => go("quiz")}>
              <ClipboardCheck /><span><b>Quiz rápido</b><small>5 questões</small></span>
            </button>
            <button onClick={() => go("study")}>
              <BookOpen /><span><b>Continuar aula</b><small>Ausculta cardíaca</small></span>
            </button>
          </div>
        </section>

        <section className="streak dashboard-streak" onClick={checkin} ref={streakRef}>
          <header>
            <div className="dashboard-streak-flame" aria-hidden="true">
              <span /><Flame /><i />
            </div>
            <span>
              <small>STREAK DE ESTUDOS</small>
              <b>{learningLoading ? <span className="skeleton-number" aria-hidden="true" /> : <>{streak} <em>{streak === 1 ? "dia em sequência" : "dias em sequência"}</em></>}</b>
              <p>{today}</p>
            </span>
            <button>Detalhes <ChevronRight /></button>
          </header>
          <div className="dashboard-streak-week">
            {localWeek.map(({ day, state }) => (
              <span key={day} className={state} aria-current={state === "today" ? "date" : undefined}>
                <small>{day}</small>
                <i>{state === "done" ? <Flame /> : state === "today" ? <Zap /> : <b />}</i>
              </span>
            ))}
          </div>
          <footer className="dashboard-streak-goal">
            <span><b>Próximo marco: {nextMilestone} dias</b><small>{Math.max(0, nextMilestone - streak)===0?"Marco alcançado":`Faltam ${Math.max(0, nextMilestone - streak)} dia${Math.max(0, nextMilestone - streak)===1?"":"s"}`}</small></span>
            <div><i style={{ width:`${milestoneProgress}%` }} /></div>
            <em>{milestoneProgress}%</em>
          </footer>
        </section>

        <section className="week">
          <header className="section-title">
            <span>
              <small>EVOLUÇÃO SEMANAL</small>
              <h3>{realActivities > 0 ? "Você está ganhando ritmo" : "Comece sua primeira atividade"}</h3>
            </span>
            <button onClick={() => go("progress")}>Detalhes</button>
          </header>
          <div className="metrics">
            <span><b ref={xpRef as any}>0 XP</b><small>XP ganhos</small></span>
            <span><b ref={minRef as any}>0</b><small>minutos</small></span>
            <span><b ref={actRef as any}>0</b><small>atividades</small></span>
          </div>
          <div className="chart">
            {weeklyActivity.map((v, i) => (
              <span key={i}>
                <i style={{ height:`${Math.round((v / weeklyMax) * 100)}%` }} className={v === weeklyMax && v > 0 ? "best" : ""} />
                <small>{["S","T","Q","Q","S","S","D"][i]}</small>
              </span>
            ))}
          </div>
        </section>

        <section className="priorities">
          <header className="section-title">
            <span>
              <small>DOMÍNIO POR TEMA</small>
              <h3>Prioridades de estudo</h3>
            </span>
            <button onClick={() => go("progress")}>Ver todos</button>
          </header>
          {systems.slice(0, 3).map((s) => {
            const real = learning?.mastery?.find((item) => item.topic === s.name);
            return <button key={s.name} onClick={() => go("progress")}>
              <i className={s.color}><s.icon /></i>
              <span>
                <b>{s.name}</b>
                <small>{real?.status || "Sem dados registrados"}</small>
              </span>
              <div><i style={{ width:`${real?.score || 0}%` }} /></div>
              <em>{real?.score === null || real?.score === undefined ? "—" : `${real.score}%`}</em>
            </button>;
          })}
        </section>

        <HomeRankCard open={() => go("ranking")} />
      </div>
    </div>
  );
}

/* ─── Checkin modal ─────────────────────────────────────────────── */
function Checkin({ close }: { close: () => void }) {
  const cardRef = useRef<HTMLElement>(null);
  useModalEntrance(cardRef);
  const { summary, loading } = useLearningSummary();
  const calendar = useMemo(() => activityCalendar(summary?.loginDays || []), [summary?.loginDays]);
  const claimed = calendar.active.has(localDateKey());
  // O streak exibido é SEMPRE o valor calculado pelo servidor (horário de
  // Brasília, única fonte de verdade) — nunca recalculado no cliente, para
  // nunca divergir do número mostrado na Home.
  const streak = summary?.streak ?? 0;
  const nextMilestone = Math.max(5, Math.ceil((streak + 1) / 5) * 5);
  const milestoneProgress = Math.min(100, Math.round((streak / nextMilestone) * 100));

  return (
    <div className="overlay" onMouseDown={close}>
      <section className={`checkin streak-modal ${claimed ? "is-claimed" : ""}`} ref={cardRef as any} onMouseDown={(e) => e.stopPropagation()}>
        <div className="streak-modal-top">
          <span><Flame /> STREAK DIÁRIO</span>
          <button className="close" onClick={close} aria-label="Fechar sequência"><X /></button>
        </div>

        <header className="streak-hero">
          <div className="streak-flame-scene" aria-hidden="true">
            <span className="streak-halo" />
            <span className="streak-flame flame-back" />
            <span className="streak-flame flame-mid" />
            <span className="streak-flame flame-core" />
            <i className="spark spark-one" /><i className="spark spark-two" /><i className="spark spark-three" />
            {claimed && <span className="claimed-check"><Check /></span>}
          </div>
          <small>{claimed ? "ACESSO DE HOJE REGISTRADO" : "SEQUÊNCIA ATUAL"}</small>
          <h2>{loading && !summary ? <span className="skeleton-number" aria-hidden="true" /> : <><strong>{streak}</strong> {streak === 1 ? "dia" : "dias"}</>}</h2>
          <p>{claimed ? "Sua chama continua acesa. O calendário foi atualizado automaticamente." : "Acesse diariamente para construir sua sequência clínica."}</p>
        </header>

        <div className="streak-activity-card">
          <header><b>Calendário de atividade</b><span>{loading && !summary ? "Atualizando…" : `${calendar.active.size} dias registrados`}</span></header>
          <div className="activity-months" aria-hidden="true">
            <i />{calendar.months.map((month, index) => <small key={`${month}-${index}`}>{month}</small>)}
          </div>
          <div className="activity-calendar" role="grid" aria-label="Dias em que você acessou o SemioLab">
            {['S','T','Q','Q','S','S','D'].map((day, index) => <small key={`${day}-${index}`} style={{ gridColumn:1, gridRow:index + 1 }}>{day}</small>)}
            {calendar.cells.map((cell) => (
              <i
                key={cell.key}
                role="gridcell"
                aria-label={`${cell.label}${cell.active ? ', acesso registrado' : ''}${cell.today ? ', hoje' : ''}`}
                className={`${cell.active ? 'active' : ''} ${cell.today ? 'today' : ''} ${cell.future ? 'future' : ''}`}
                style={{ gridColumn:cell.week + 2, gridRow:cell.weekday + 1 }}
                title={`${cell.label}${cell.active ? ' · acesso registrado' : ''}`}
              />
            ))}
          </div>
          <footer><span><i className="legend-empty" /> Sem acesso</span><span><i className="legend-active" /> Acessou</span><span><i className="legend-today" /> Hoje</span></footer>
        </div>

        <div className="streak-milestone">
          <span className="milestone-badge"><Flame /><b>{streak}</b></span>
          <div>
            <small>PRÓXIMO MARCO</small>
            <b>Faltam {Math.max(0, nextMilestone - streak)} dias para {nextMilestone} dias</b>
            <span><i style={{ width:`${milestoneProgress}%` }} /></span>
            <em>{milestoneProgress}% concluído</em>
          </div>
          <span className="milestone-next"><LockKeyhole /><b>{nextMilestone}</b></span>
        </div>

        <div className="check-stats">
          <span><b>{streak} dias</b><small>sequência atual</small></span>
          <span><b>{calendar.longestStreak} dias</b><small>melhor sequência</small></span>
          <span><b>{calendar.active.size} dias</b><small>acessos registrados</small></span>
        </div>

        <button className="primary streak-claim" onClick={close}>
          {claimed ? <><Check /> Continuar missão de hoje</> : <><Sparkles /> Registrando acesso de hoje…</>}<ChevronRight />
        </button>
        <p className="streak-caption"><ShieldCheck /> Seu streak aumenta ao concluir uma atividade por dia.</p>
      </section>
    </div>
  );
}

/* ─── Study atlas ───────────────────────────────────────────────── */
function EmbeddedFrame({ src, title, className, theme }: { src:string; title:string; className:string; theme:AppTheme }) {
  const [ready, setReady] = useState(false);
  const frameRef = useRef<HTMLIFrameElement>(null);
  const syncTheme = () => {
    try {
      const root = frameRef.current?.contentDocument?.documentElement;
      if (root) root.dataset.semiolabTheme = theme;
    } catch { /* módulos são locais; mantém fallback visual caso o navegador bloqueie */ }
  };
  useEffect(() => { syncTheme(); }, [theme]);
  return (
    <div className={`embedded-shell ${ready ? "ready" : "loading"} ${theme}`}>
      {!ready && (
        <div className="embedded-loader" role="status" aria-live="polite">
          <i><span /></i>
          <b>Preparando experiência clínica</b>
          <small>Carregando somente os recursos necessários…</small>
        </div>
      )}
      <iframe
        ref={frameRef}
        className={className}
        src={src}
        title={title}
        loading="eager"
        allow="autoplay"
        onLoad={() => { syncTheme(); setReady(true); }}
      />
    </div>
  );
}

function Study({ go: _go, theme }: { go:(s:Screen)=>void; theme:AppTheme }) {
  const pageRef = useScreenTransition("study");
  return (
    <div className="page study-atlas-page" ref={pageRef}>
      <EmbeddedFrame
        className="study-atlas-frame"
        src="/atlas-tc-3d-portugues-v2.html"
        title="Atlas de TC 3D — Português"
        theme={theme}
      />
    </div>
  );
}

/* ─── Auscultation laboratory ─────────────────────────────────── */
function AuscultationLab({ theme }: { theme:AppTheme }) {
  const pageRef = useScreenTransition("auscultation");
  const { summary: learning } = useLearningSummary();
  const tier = learning?.pro?.tier;
  const allowed = tier === undefined || tier === "trial" || tier === "pro" || learning?.pro?.active;
  if (learning && !allowed) {
    return (
      <div className="page auscultation-lab-page patient-wait" ref={pageRef}>
        <div className="patient-wait-shade" />
        <main className="patient-wait-content">
          <section className="patient-wait-intro">
            <small><i /> RECURSO PRO</small>
            <h1>Ausculta clínica é um recurso Pro.</h1>
            <p>Seu período de teste acabou. Assine para continuar praticando ausculta cardíaca e pulmonar sem limites.</p>
          </section>
          <section className="patient-call-panel">
            {learning?.pro?.checkoutUrls && <a className="primary" href={learning.pro.checkoutUrls.monthly} target="_blank" rel="noopener noreferrer"><span>Assinar mensal</span></a>}
            {learning?.pro?.checkoutUrls && <a className="primary" href={learning.pro.checkoutUrls.annual} target="_blank" rel="noopener noreferrer"><span>Assinar anual</span></a>}
          </section>
        </main>
      </div>
    );
  }
  return (
    <div className="page auscultation-lab-page" ref={pageRef}>
      <EmbeddedFrame
        className="auscultation-lab-frame"
        src="/semiolab-laboratorio-ausculta.html"
        title="SemioLab — Laboratório de Ausculta"
        theme={theme}
      />
    </div>
  );
}

/* ─── Progress ──────────────────────────────────────────────────── */
function Progress({ go }: { go:(s:Screen)=>void }) {
  const pageRef = useScreenTransition("progress");
  const { summary, loading } = useLearningSummary();
  const today = useTodayLabel();
  const xp = Number(summary?.profile?.xp || 0);
  const level = Math.floor(xp / 500) + 1;
  const levelProgress = Math.round(((xp % 500) / 500) * 100);
  const toNextLevel = 500 - (xp % 500 || 0);
  const availableScores = (summary?.mastery || []).flatMap((item) => item.score === null ? [] : [item.score]);
  const generalMastery = availableScores.length ? Math.round(availableScores.reduce((sum, value) => sum + value, 0) / availableScores.length) : null;
  const questions = Number(summary?.stats?.questions || 0);
  const correct = Number(summary?.stats?.correct || 0);
  const accuracy = questions ? Math.round(correct / questions * 100) : null;
  const consultations = Number(summary?.stats?.consultations || 0);
  const simuladoAverage = summary?.stats?.simuladoAverage ?? null;
  const patientAverage = summary?.stats?.patientAverage ?? null;
  const realFor = (name: string) => summary?.mastery?.find((item) => item.topic === name);
  const spotlight = ["Cardiovascular", "Neurológico", "Respiratório", "Abdome e digestório"];
  const topicWheel = ["Cardiovascular", "Respiratório", "Anamnese", "Neurológico", "Abdome e digestório", "Exame físico"];
  const hasEvidence = questions > 0 || consultations > 0 || simuladoAverage !== null;
  const masteredTopics = (summary?.mastery || []).filter((m) => m.status === "Domínio");
  const improvingTopics = (summary?.mastery || []).filter((m) => m.status === "Em evolução");
  const weakTopics = (summary?.mastery || []).filter((m) => m.status === "Precisa melhorar");
  const errorCounts = Object.values(
    (summary?.errors || []).reduce<Record<string, { topic: string; count: number }>>((acc, e) => {
      acc[e.topic] = acc[e.topic] || { topic: e.topic, count: 0 };
      acc[e.topic].count += 1;
      return acc;
    }, {}),
  ).sort((a, b) => b.count - a.count).slice(0, 3);

  return (
    <div className="page progress-page-v2" ref={pageRef}>
      <header className="progress-v2-heading">
        <span><small>{today}</small><h1>Seu progresso</h1></span>
      </header>

      <section className="progress-v2-hero">
        <div className="progress-v2-copy">
          <small>NÍVEL {level}</small>
          <h2>Raciocínio clínico</h2>
          <strong>{loading ? "…" : `${xp.toLocaleString("pt-BR")} XP`}</strong>
          <p>
            {loading
              ? "Carregando seu histórico real…"
              : !hasEvidence
                ? "Comece a praticar para gerar sua análise"
                : `Faltam ${toNextLevel} XP para o próximo nível`}
          </p>
          <div className="progress-level-track"><i style={{ width:`${levelProgress}%` }} /><b>{levelProgress}%</b></div>
        </div>
        <div className="progress-heart-stage">
          <span className="progress-heart-halo" />
          <img src="/semiolab-heart-3d.png" alt="Modelo anatômico tridimensional de um coração" />
          <aside><i><Award /></i><b>{generalMastery === null ? "—" : `${generalMastery}%`}</b><small>{generalMastery === null ? "sem dados avaliados" : "domínio geral"}</small></aside>
        </div>
      </section>

      <div className="progress-metric-grid">
        <article><i><Target /></i><span><b>{accuracy === null ? "—" : `${accuracy}%`}</b><small>Acertos nos quizzes</small></span></article>
        <article><i><ClipboardCheck /></i><span><b>{questions}</b><small>Questões concluídas</small></span></article>
        <article><i><FileText /></i><span><b>{simuladoAverage === null ? "—" : `${simuladoAverage}%`}</b><small>Média nos simulados</small></span></article>
        <article><i><Stethoscope /></i><span><b>{patientAverage === null ? "—" : `${patientAverage}%`}</b><small>Média nas consultas</small></span></article>
      </div>

      {!loading && !hasEvidence && (
        <section className="clinical-domain-card">
          <p style={{ padding: "16px 4px" }}>Comece a praticar para gerar sua análise — os dados desta página aparecem assim que você concluir um quiz, simulado ou atendimento.</p>
        </section>
      )}

      <section className="clinical-domain-card">
        <header><span><h2>Domínio clínico</h2><p>Evolução por sistema</p></span><i title="Somente resultados avaliados"><ShieldCheck /></i></header>
        <div className="clinical-domain-visual">
          <div className="clinical-human-wrap"><span className="clinical-human-halo" /><img className="clinical-human" src="/semiolab-anatomy-human.png" alt="Representação anatômica frontal do corpo humano com órgãos internos" /></div>
          {spotlight.map((name, index) => {
            const system = systems.find((item) => item.name === name)!;
            const real = realFor(name);
            return <article key={name} className={`domain-callout domain-${index + 1} ${real?.score == null ? "no-data" : ""}`}>
              <i><system.icon /></i><span><small>{name === "Abdome e digestório" ? "Digestório" : name}</small><b>{real?.score == null ? "—" : `${real.score}%`}</b></span>
            </article>;
          })}
        </div>
        <footer><ShieldCheck /> Dados calculados a partir dos seus resultados reais (quiz 30% + simulado 30% + Paciente IA 40%)</footer>
      </section>

      <section className="topic-advance-card">
        <header><span><h2>Avanço por tema</h2><p>Distribuição do seu aprendizado</p></span></header>
        <div className="topic-wheel" aria-label="Avanço real distribuído por tema">
          {topicWheel.map((name, index) => {
            const system = systems.find((item) => item.name === name)!;
            const real = realFor(name);
            const angle = index * 60;
            return <article key={name} className={`wheel-segment wheel-${index + 1} ${real?.score == null ? "no-data" : ""}`} style={{ "--angle":`${angle}deg`, "--counter-angle":`${-angle}deg`, "--score":`${real?.score || 0}%` } as any}>
              <i className="wheel-fill" /><span><system.icon /><small>{name === "Abdome e digestório" ? "Digestório" : name}</small><b>{real?.score == null ? "—" : `${real.score}%`}</b></span>
            </article>;
          })}
          <i className="topic-wheel-core"><Activity /><small>DOMÍNIO</small><b>{generalMastery == null ? "—" : `${generalMastery}%`}</b></i>
        </div>
        <p className="topic-wheel-note"><ShieldCheck /> O preenchimento de cada segmento usa somente resultados avaliados. Temas com menos de 5 evidências aparecem como &quot;—&quot; (dados insuficientes).</p>
      </section>

      {hasEvidence && (
        <section className="clinical-domain-card">
          <header><span><h2>Temas por status</h2><p>Dominados, em evolução e a melhorar</p></span></header>
          <div style={{ padding: "8px 4px", fontSize: 13, lineHeight: 1.8 }}>
            <p><b>Dominados:</b> {masteredTopics.length ? masteredTopics.map((m) => m.topic).join(", ") : "nenhum ainda"}</p>
            <p><b>Em evolução:</b> {improvingTopics.length ? improvingTopics.map((m) => m.topic).join(", ") : "nenhum ainda"}</p>
            <p><b>A melhorar:</b> {weakTopics.length ? weakTopics.map((m) => m.topic).join(", ") : "nenhum ainda"}</p>
          </div>
        </section>
      )}

      {errorCounts.length > 0 && (
        <section className="clinical-domain-card">
          <header><span><h2>Erros mais recorrentes</h2><p>Temas com mais revisões pendentes</p></span></header>
          <div style={{ padding: "8px 4px", fontSize: 13, lineHeight: 1.8 }}>
            {errorCounts.map((e) => <p key={e.topic}><b>{e.topic}</b> — {e.count} erro{e.count > 1 ? "s" : ""}</p>)}
          </div>
        </section>
      )}
    </div>
  );
}

/* ─── Achievements ──────────────────────────────────────────────── */
function Achievements({ go }: { go:(s:Screen)=>void }) {
  const pageRef = useScreenTransition("achievements");
  const gridRef = useStaggerReveal("article", ["achievements"]);
  const { summary } = useLearningSummary();
  const streak = summary?.streak ?? 0;
  const questions = summary?.stats?.questions ?? 0;
  const consultations = summary?.stats?.consultations ?? 0;
  const averageScore = summary?.stats?.averageScore ?? null;
  const cardioScore = summary?.mastery?.find((m) => m.topic === "Cardiovascular")?.score ?? null;

  const a = [
    { name: "Primeira consulta", icon: Stethoscope, on: consultations >= 1, progress: Math.min(100, consultations * 100) },
    { name: "7 dias",            icon: Flame,        on: streak >= 7, progress: Math.min(100, Math.round((streak / 7) * 100)) },
    { name: "Olhar clínico",     icon: Target,       on: (averageScore ?? 0) >= 70 && questions > 0, progress: Math.min(100, Math.round((((averageScore ?? 0)) / 70) * 100)) },
    { name: "100 questões",      icon: ClipboardCheck, on: questions >= 100, progress: Math.min(100, Math.round((questions / 100) * 100)) },
    { name: "Cardio em foco",    icon: HeartPulse,   on: (cardioScore ?? 0) >= 80, progress: Math.min(100, Math.round((((cardioScore ?? 0)) / 80) * 100)) },
    { name: "Imparável",         icon: Trophy,       on: streak >= 30, progress: Math.min(100, Math.round((streak / 30) * 100)) },
  ] as const;
  const unlockedCount = a.filter((item) => item.on).length;
  return (
    <div className="page" ref={pageRef}>
      <Top title="Conquistas" go={go} />
      <div className="intro">
        <span>
          <small>MARCOS DA SUA JORNADA</small>
          <h1>Progresso que merece ser lembrado.</h1>
          <p>Você desbloqueou {unlockedCount} de {a.length} conquistas.</p>
        </span>
      </div>
      <div className="achievements" ref={gridRef}>
        {a.map(({ name, icon: Icon, on, progress }) => (
          <article key={name} className={on?"on":"off"}>
            <i><Icon /></i>
            <small>{on?"DESBLOQUEADA":"EM PROGRESSO"}</small>
            <h3>{name}</h3>
            <p>{on?"Uma etapa importante da sua evolução clínica.":"Continue estudando para alcançar este marco."}</p>
            {!on && <div><i style={{ width:`${progress}%` }} /></div>}
          </article>
        ))}
      </div>
    </div>
  );
}

/* ─── Profile ───────────────────────────────────────────────────── */
type ProfilePanel = "account"|"preferences"|"support"|"notifications"|null;
type AppTheme = "light"|"dark";

const defaultRole = "Estudante de Medicina · Ciclo clínico";
const defaultPreferences = { dailyGoal:"20", reminders:true, reminderTime:"19:00", sound:true };

function Profile({ go, logout, theme, setTheme }: { go:(s:Screen)=>void; logout:()=>void; theme:AppTheme; setTheme:(theme:AppTheme)=>void }) {
  const user = useUser();
  const defaultProfile = { name:user.name, role:defaultRole, email:user.email };
  const [premium, setPremium] = useState(false);
  const [proPlan, setProPlan] = useState<"monthly"|"annual">("annual");
  const [panel, setPanel] = useState<ProfilePanel>(null);
  useEffect(() => {
    if (!panel) return;
    document.body.classList.add("pwa-modal-open");
    return () => document.body.classList.remove("pwa-modal-open");
  }, [panel]);
  const [profile, setProfile] = useState(defaultProfile);
  const [draft, setDraft] = useState(defaultProfile);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [preferenceDraft, setPreferenceDraft] = useState(defaultPreferences);
  const [avatar, setAvatar] = useState("/semiolab-fox.png");
  const [cover, setCover] = useState("");
  const [notice, setNotice] = useState("");
  const { summary: learning } = useLearningSummary();
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const pageRef = useScreenTransition("profile");
  const modalRef = useRef<HTMLElement>(null);
  const profileScores = (learning?.mastery || []).flatMap((item) => item.score === null ? [] : [item.score]);
  const profileMastery = profileScores.length ? Math.round(profileScores.reduce((sum, value) => sum + value, 0) / profileScores.length) : null;
  useModalEntrance(premium ? modalRef : { current: null }, {
    fromY: 180,
    fromScale: .985,
    duration: .62,
    ease: "power3.out",
  });

  useEffect(() => {
    try {
      const savedRole = localStorage.getItem(`semiolab:${user.id}:role`);
      const savedPreferences = localStorage.getItem(`semiolab:${user.id}:preferences`);
      if (savedRole) { setProfile((p) => ({ ...p, role: savedRole })); setDraft((p) => ({ ...p, role: savedRole })); }
      if (savedPreferences) { const value = JSON.parse(savedPreferences); setPreferences(value); setPreferenceDraft(value); }
    } catch { /* dados locais inválidos voltam aos padrões seguros */ }
    // Avatar/capa agora vêm do Supabase (bucket privado, URL assinada),
    // não mais do localStorage — mesma rota usada pelo perfil público do
    // Ranking, aqui pedida para o próprio usuário.
    fetch(`/api/ranking/profile?userId=${user.id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.avatarUrl) setAvatar(data.avatarUrl);
        if (data?.coverUrl) setCover(data.coverUrl);
      })
      .catch(() => {});
  }, [user.id]);

  const inform = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const uploadImage = async (file: File | undefined, kind: "avatar"|"cover") => {
    if (!file) return;
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("kind", kind);
      const response = await fetch("/api/profile/avatar", { method: "POST", body: form });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { inform(data.error || "Não foi possível usar essa imagem."); return; }
      if (kind === "avatar") setAvatar(data.url);
      else setCover(data.url);
      inform(kind === "avatar" ? "Foto de perfil atualizada." : "Capa atualizada.");
    } catch { inform("Não foi possível usar essa imagem."); }
  };
  const saveAccount = () => {
    if (!draft.name.trim()) {
      inform("Preencha o nome para continuar."); return;
    }
    const value = { name:draft.name.trim(), role:draft.role.trim() || defaultRole, email:profile.email };
    setProfile(value);
    localStorage.setItem(`semiolab:${user.id}:role`, value.role);
    setPanel(null);
    createClient().from("profiles").update({ name: value.name }).eq("id", user.id)
      .then(({ error }) => inform(error ? "Nome salvo localmente, mas houve um erro ao sincronizar." : "Dados salvos com sucesso."));
  };
  const savePreferences = () => {
    setPreferences(preferenceDraft);
    localStorage.setItem(`semiolab:${user.id}:preferences`, JSON.stringify(preferenceDraft));
    setPanel(null); inform("Preferências atualizadas.");
  };
  const openPanel = (next: ProfilePanel) => {
    if (next === "account") setDraft(profile);
    if (next === "preferences") setPreferenceDraft(preferences);
    setPanel(next);
  };

  return (
    <div className="page profile-page" ref={pageRef}>
      <Top title="Perfil" go={go} />
      <section className="profile-identity-card">
        <div className="profile-cover" style={cover ? { backgroundImage:`linear-gradient(115deg, #052a3199, #12697855), url(${cover})` } : undefined}>
          <span className="profile-cover-orbit one" />
          <span className="profile-cover-orbit two" />
          <button aria-label="Alterar capa" onClick={() => coverInput.current?.click()}><Camera /></button>
          <input ref={coverInput} className="profile-file-input" type="file" accept="image/*" onChange={(event) => uploadImage(event.target.files?.[0], "cover")} />
        </div>
        <div className="profile-avatar-wrap">
          <div className="profile-avatar-ring">
            <img src={avatar} alt={`Avatar de ${profile.name}`} className={avatar !== "/semiolab-fox.png" ? "user-photo" : ""} />
          </div>
          <button aria-label="Alterar foto de perfil" onClick={() => avatarInput.current?.click()}><Camera /></button>
          <input ref={avatarInput} className="profile-file-input" type="file" accept="image/*" onChange={(event) => uploadImage(event.target.files?.[0], "avatar")} />
        </div>
        <div className="profile-person">
          <small><BadgeCheck /> PERFIL VERIFICADO</small>
          <h1>{profile.name}</h1>
          <p>{profile.role}</p>
          <span><Mail /> {profile.email}</span>
        </div>
        <div className="profile-numbers">
          <button onClick={() => go("progress")}><b>{Number(learning?.profile?.xp || 0).toLocaleString("pt-BR")}</b><small>XP total</small></button>
          <button onClick={() => go("achievements")}><b>—</b><small>Streak não validado</small></button>
          <button onClick={() => go("progress")}><b>{profileMastery === null ? "—" : `${profileMastery}%`}</b><small>Domínio real</small></button>
        </div>
      </section>
      {learning?.pro?.active ? (
        <section className="profile-pro-card profile-pro-card-active">
          <div className="profile-pro-icon"><BadgeCheck /></div>
          <span>
            <small>SEMIO<span>LAB</span> PRO</small>
            <h2>Assinatura {learning.pro.plan === "annual" ? "anual" : learning.pro.plan === "monthly" ? "mensal" : ""} ativa</h2>
            <p>{learning.pro.nextPaymentDate ? `Válida até ${new Date(learning.pro.nextPaymentDate).toLocaleDateString("pt-BR")}` : "Acesso completo liberado."}</p>
          </span>
        </section>
      ) : (
        <section className="profile-pro-card">
          <div className="profile-pro-icon"><Sparkles /></div>
          <span>
            <small>SEMIO<span>LAB</span> PRO</small>
            <h2>Evolua sem limites.</h2>
            <p>Pacientes virtuais, atlas clínico e simulados ilimitados.</p>
          </span>
          <button onClick={() => setPremium(true)}>Conhecer Pro <ChevronRight /></button>
        </section>
      )}
      <section className="profile-settings-block">
        <h3>Conta</h3>
        <div className="profile-settings-list">
          <button onClick={() => openPanel("account")}><Settings /><span><b>Dados da conta</b><small>Nome e formação</small></span><ChevronRight /></button>
          <button onClick={() => setPremium(true)}>
            <CreditCard />
            <span>
              <b>Plano e assinatura</b>
              <small>
                {learning?.pro?.active
                  ? `Pro ${learning.pro.plan === "annual" ? "anual" : "mensal"} · ativo${learning.pro.nextPaymentDate ? ` até ${new Date(learning.pro.nextPaymentDate).toLocaleDateString("pt-BR")}` : ""}`
                  : learning?.pro?.status === "canceled"
                    ? "Assinatura cancelada"
                    : learning?.pro?.status === "past_due"
                      ? "Pagamento pendente"
                      : "Plano gratuito"}
              </small>
            </span>
            <ChevronRight />
          </button>
          <button onClick={() => go("achievements")}><Award /><span><b>Conquistas</b><small>3 de 18 desbloqueadas</small></span><ChevronRight /></button>
          <div className="profile-setting-row"><Palette /><span><b>Tema</b><small>Aparência do SemioLab</small></span><div className="theme-choice"><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>Claro</button><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>Escuro</button></div></div>
        </div>
      </section>
      <section className="profile-settings-block">
        <h3>Preferências e suporte</h3>
        <div className="profile-settings-list">
          <button onClick={() => openPanel("preferences")}><SlidersHorizontal /><span><b>Preferências de estudo</b><small>{preferences.dailyGoal} min por dia · lembretes {preferences.reminders ? "ativos" : "desativados"}</small></span><ChevronRight /></button>
          <button onClick={() => openPanel("notifications")}><Bell /><span><b>Notificações e instalação</b><small>Ative avisos e instale o app</small></span><ChevronRight /></button>
          <button onClick={() => openPanel("support")}><HelpCircle /><span><b>Ajuda e suporte</b><small>Dúvidas, problemas e contato</small></span><ChevronRight /></button>
          <button onClick={() => window.open("/termos-de-uso", "_blank", "noopener,noreferrer")}><ShieldCheck /><span><b>Termos, privacidade e LGPD</b><small>Termos de uso, reembolso e aviso educacional</small></span><ChevronRight /></button>
          <button onClick={() => { window.location.href="mailto:suporte.semiolab@gmail.com?subject=Feedback%20SemioLab"; }}><MessageCircle /><span><b>Enviar feedback</b><small>Conte o que podemos melhorar</small></span><ChevronRight /></button>
          <button className="profile-logout" onClick={logout}><LogOut /><span><b>Sair da conta</b><small>Encerrar sessão neste dispositivo</small></span><ChevronRight /></button>
        </div>
      </section>
      {notice && <div className="profile-toast" role="status"><Check />{notice}</div>}
      {panel && typeof document !== "undefined" && createPortal(
        <div className="overlay profile-overlay pwa-modal-overlay" onMouseDown={() => setPanel(null)}>
          <section className="profile-dialog" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close" aria-label="Fechar" onClick={() => setPanel(null)}><X /></button>
            {panel === "account" && <>
              <small>CONTA</small><h2>Seus dados</h2><p>Essas informações identificam seu perfil dentro do SemioLab.</p>
              <label>Nome completo<input value={draft.name} onChange={(event) => setDraft({...draft, name:event.target.value})} /></label>
              <label>Formação ou etapa<input value={draft.role} onChange={(event) => setDraft({...draft, role:event.target.value})} /></label>
              <div className="profile-email-locked"><Mail /><span><small>E-MAIL DA CONTA</small><b>{profile.email}</b><em>Este e-mail não pode ser alterado.</em></span><LockKeyhole /></div>
              <button className="profile-dialog-primary" onClick={saveAccount}>Salvar alterações</button>
            </>}
            {panel === "preferences" && <>
              <small>ESTUDO</small><h2>Suas preferências</h2><p>Ajuste uma rotina possível de manter todos os dias.</p>
              <label>Meta diária<select value={preferenceDraft.dailyGoal} onChange={(event) => setPreferenceDraft({...preferenceDraft, dailyGoal:event.target.value})}><option value="10">10 minutos</option><option value="20">20 minutos</option><option value="30">30 minutos</option><option value="45">45 minutos</option></select></label>
              <div className="profile-dialog-toggle"><span><b>Lembrete diário</b><small>Receber aviso no horário escolhido</small></span><button className={preferenceDraft.reminders ? "active" : ""} onClick={() => setPreferenceDraft({...preferenceDraft, reminders:!preferenceDraft.reminders})}><i /></button></div>
              {preferenceDraft.reminders && <label>Horário do lembrete<input type="time" value={preferenceDraft.reminderTime} onChange={(event) => setPreferenceDraft({...preferenceDraft, reminderTime:event.target.value})} /></label>}
              <div className="profile-dialog-toggle"><span><b>Sons de recompensa</b><small>Feedback sonoro ao concluir atividades</small></span><button className={preferenceDraft.sound ? "active" : ""} onClick={() => setPreferenceDraft({...preferenceDraft, sound:!preferenceDraft.sound})}><i /></button></div>
              <button className="profile-dialog-primary" onClick={savePreferences}>Salvar preferências</button>
            </>}
            {panel === "notifications" && <NotificationSettingsPanel />}
            {panel === "support" && <>
              <small>SUPORTE</small><h2>Como podemos ajudar?</h2><p>Consulte as respostas rápidas ou fale diretamente com a equipe.</p>
              <details><summary>Meu progresso não atualizou</summary><p>Conclua a atividade até a tela final. O XP é registrado somente após a conclusão.</p></details>
              <details><summary>Minha foto não aparece</summary><p>Escolha JPG, PNG ou WebP, com até 2 MB. A imagem fica salva na sua conta, não no dispositivo.</p></details>
              <a className="profile-dialog-primary" href="https://mail.google.com/mail/?view=cm&fs=1&to=suporte.semiolab@gmail.com&su=Suporte%20SemioLab" target="_blank" rel="noopener noreferrer"><Mail /> Falar com o suporte</a>
            </>}
          </section>
        </div>,
        document.body,
      )}
      {premium && (
        <div className="overlay pro-offer-overlay" onMouseDown={() => setPremium(false)}>
          <section className="premium-modal pro-offer" ref={modalRef as any} onMouseDown={(e) => e.stopPropagation()}>
            <header className="pro-offer-topbar">
              <button aria-label="Voltar" onClick={() => setPremium(false)}><ArrowLeft /></button>
              <button aria-label="Fechar oferta" onClick={() => setPremium(false)}><X /></button>
            </header>
            <div className="pro-offer-hero">
              <span className="pro-medical-cross" aria-hidden="true" />
              <span className="pro-organ-line" aria-hidden="true"><HeartPulse /></span>
              <img src="/semiolab-pro-fox.webp" alt="Raposa médica do SemioLab" width="560" height="560" decoding="sync" />
            </div>
            <div className="pro-offer-sheet">
              <div className="pro-offer-title">
                <h2>Desbloqueie o SemioLab Pro</h2>
                <p>Aprenda, pratique e evolua todos os dias.</p>
              </div>
              <div className="pro-benefits">
                <span><i><Check /></i>Pacientes virtuais ilimitados</span>
                <span><i><Check /></i>Casos clínicos exclusivos</span>
                <span><i><Check /></i>Quiz e desafios completos</span>
                <span><i><Check /></i>Evolução de estudos</span>
                <span><i><Check /></i>Laboratório de ausculta</span>
                <span><i><Check /></i>Atlas de tomografia completo</span>
                <strong><Sparkles /> Acesso a todas as futuras funcionalidades</strong>
              </div>
              <div className="pro-plans" role="radiogroup" aria-label="Escolha o plano">
                <button className={proPlan === "monthly" ? "selected" : ""} onClick={() => setProPlan("monthly")} role="radio" aria-checked={proPlan === "monthly"}>
                  <span className="pro-plan-head">
                    <i>{proPlan === "monthly" && <Check />}</i>
                    <small>MENSAL</small>
                  </span>
                  <span className="pro-plan-copy">Flexibilidade para começar</span>
                  <b className="pro-plan-price"><em>R$</em> 29,90 <span>/mês</span></b>
                  <span className="pro-plan-billing">Cobrança mensal</span>
                </button>
                <button className={`recommended ${proPlan === "annual" ? "selected" : ""}`} onClick={() => setProPlan("annual")} role="radio" aria-checked={proPlan === "annual"}>
                  <strong className="pro-best-badge"><Sparkles /> MELHOR ESCOLHA</strong>
                  <span className="pro-plan-head">
                    <i>{proPlan === "annual" && <Check />}</i>
                    <small>ANUAL</small>
                  </span>
                  <span className="pro-plan-copy">Acesso completo por 12 meses</span>
                  <b className="pro-plan-price"><em>R$</em> 199,90 <span>/ano</span></b>
                  <span className="pro-plan-equivalent">equivale a <b>R$ 16,66/mês</b></span>
                  <span className="pro-plan-saving">Economize R$ 159,90</span>
                </button>
              </div>
              <a className="pro-unlock" href={proPlan === "annual" ? "https://pay.cakto.com.br/pdgqt5d" : "https://pay.cakto.com.br/hf4wgnz_1041214"} target="_blank" rel="noopener noreferrer">QUERO DESBLOQUEAR O PRO</a>
              <p className="pro-cancel"><ShieldCheck /> Cancele quando quiser</p>
              <button className="pro-continue" onClick={() => setPremium(false)}>Continuar no plano gratuito</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

/* ─── QuizLegacy (preserved) ────────────────────────────────────── */
export function QuizLegacy({ go }: { go:(s:Screen)=>void }) {
  const [phase, setPhase] = useState<"home"|"play"|"result">("home");
  const [cur, setCur] = useState(0);
  const [selected, setSelected] = useState<number|null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const score = useMemo(() => answers.filter((a,i) => a===questions[i].correct).length, [answers]);
  if (phase==="play") {
    const q = questions[cur];
    return (
      <div className="quiz-play">
        <header>
          <button onClick={() => setPhase("home")}><X /></button>
          <span>Questão {cur+1} de {questions.length}<i><b style={{ width:`${((cur+1)/questions.length)*100}%` }} /></i></span>
          <Clock3 /><b>08:24</b>
        </header>
        <main>
          <small>SEMIOLOGIA GERAL · INTERMEDIÁRIO</small>
          <h1>{q.text}</h1>
          <div>
            {q.options.map((o, i) => (
              <button key={o} className={selected===i?"selected":""} onClick={() => setSelected(i)}>
                <i>{String.fromCharCode(65+i)}</i>{o}
              </button>
            ))}
          </div>
          <footer>
            <button>Marcar para revisar</button>
            <button className="primary" disabled={selected===null} onClick={() => { setAnswers([...answers, selected!]); setSelected(null); if (cur===questions.length-1) setPhase("result"); else setCur(cur+1); }}>
              {cur===questions.length-1?"Finalizar simulado":"Próxima questão"}<ChevronRight />
            </button>
          </footer>
        </main>
      </div>
    );
  }
  if (phase==="result") return (
    <div className="page">
      <Top title="Resultado" go={go} />
      <div className="quiz-result">
        <div className="score"><b>{Math.round((score/questions.length)*100)}</b><small>pontos</small></div>
        <h1>Bom treino. Agora revise os detalhes.</h1>
        <p>Você acertou {score} de {questions.length} questões e ganhou +{score*8+15} XP.</p>
        <div className="answer-list">
          {questions.map((q, i) => (
            <article key={q.text} className={answers[i]===q.correct?"correct":"wrong"}>
              <b>{i+1}</b>
              <span><small>{answers[i]===q.correct?"RESPOSTA CORRETA":"PRECISA REVISAR"}</small><p>{q.text}</p><em>{q.why}</em></span>
            </article>
          ))}
        </div>
        <button className="primary" onClick={() => { setPhase("home"); setCur(0); setAnswers([]); }}>Fazer novo simulado</button>
      </div>
    </div>
  );
  return (
    <div className="page">
      <Top title="Simulados" go={go} />
      <div className="intro">
        <span><small>TREINO ORIENTADO</small><h1>Questões que mostram onde você precisa evoluir.</h1><p>Treine sem receber pistas e revise cada resposta no final.</p></span>
        <i><b>76%</b><small>média geral</small></i>
      </div>
      <section className="quiz-hero">
        <span>
          <small>SIMULADO RECOMENDADO</small>
          <h2>Revisão clínica adaptativa</h2>
          <p>Questões selecionadas a partir dos seus pontos de atenção.</p>
          <div>
            <em><Clock3 /> 8 min</em>
            <em><Target /> Intermediário</em>
            <em><Zap /> +55 XP</em>
          </div>
          <button onClick={() => setPhase("play")}>Começar agora <ChevronRight /></button>
        </span>
        <ClipboardCheck />
      </section>
      <div className="quiz-actions">
        <button onClick={() => setPhase("play")}><Zap /><span><b>Treino rápido</b><small>3 questões · 5 minutos</small></span><ChevronRight /></button>
        <button><CircleAlert /><span><b>Caderno de erros</b><small>12 questões para revisar</small></span><ChevronRight /></button>
        <button><Target /><span><b>Criar simulado</b><small>Escolha tema e quantidade</small></span><ChevronRight /></button>
      </div>
    </div>
  );
}

/* ─── Root ──────────────────────────────────────────────────────── */
export default function SemioLab() {
  const [screen, setScreen]   = useState<Screen>(() => {
    // Deep link de notificação (?screen=patient etc.) — preservado através
    // do login, já que é a mesma URL antes e depois de autenticar.
    if (typeof window === "undefined") return "home";
    const requested = new URLSearchParams(window.location.search).get("screen");
    const valid: Screen[] = ["home","study","auscultation","patient","quiz","profile","progress","ranking","achievements"];
    return (valid as string[]).includes(requested || "") ? (requested as Screen) : "home";
  });
  const [navOpen, setNavOpen] = useState(true);
  const [checkin, setCheckin] = useState(true);
  const [theme, setThemeState] = useState<AppTheme>("light");
  const user = useUser();

  // A sidebar reserva 248px (aberta) de largura fixa no conteúdo. Em telas
  // médias (mesmo breakpoint já usado pelo grid do dashboard, <=1100px),
  // isso espreme demais o conteúdo e pode causar rolagem horizontal (ex.:
  // botões que não encolhem). Recolhe automaticamente nessas larguras — o
  // usuário ainda pode reabrir manualmente, e isso é reavaliado a cada
  // redimensionamento real da janela.
  useEffect(() => {
    const applyResponsiveNav = () => setNavOpen(window.innerWidth > 1100);
    applyResponsiveNav();
    window.addEventListener("resize", applyResponsiveNav);
    return () => window.removeEventListener("resize", applyResponsiveNav);
  }, []);

  // Isolamento entre contas é feito por CHAVE namespaced (semiolab:{userId}:...)
  // e por dados definitivos vindos do Supabase (RLS) — nunca apagando o
  // localStorage de outros usuários. Um cache de outra conta que sobrar no
  // navegador simplesmente nunca é lido nem exibido (chave errada), e segue
  // intacto para quando aquela conta logar de novo.

  useEffect(() => {
    const saved = localStorage.getItem("semiolab.theme");
    if (saved === "dark" || saved === "light") setThemeState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.semiolabTheme = theme;
    localStorage.setItem("semiolab.theme", theme);
  }, [theme]);
  useEffect(() => {
    fetch("/api/learning", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action:"login_day" }),
    }).then((response) => {
      if (response.ok) window.dispatchEvent(new Event("semiolab:learning-updated"));
    }).catch(() => {});
    const timer = window.setTimeout(() => {
      warmEmbedded("study");
      warmEmbedded("auscultation");
    }, 900);
    return () => window.clearTimeout(timer);
  }, []);

  async function logout() {
    // Não apaga nada do localStorage nem do Supabase: é só o cache/estado
    // local da própria conta (sempre namespaced por userId) e continua
    // intacto para quando este usuário logar de novo.
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  const go = (s: Screen) => setScreen(s);
  const view =
    screen==="home"         ? <HomePage go={go} checkin={() => setCheckin(true)} /> :
    screen==="study"        ? <Study go={go} theme={theme} /> :
    screen==="auscultation" ? <AuscultationLab theme={theme} /> :
    screen==="patient"      ? <PatientExperience go={go} /> :
    screen==="quiz"         ? <QuizExperience go={go} /> :
    screen==="progress"     ? <Progress go={go} /> :
    screen==="ranking"      ? <RankingExperience go={go} /> :
    screen==="achievements" ? <Achievements go={go} /> :
                              <Profile go={go} logout={logout} theme={theme} setTheme={setThemeState} />;

  return (
    <main className={`app screen-${screen}`}>
      <Navigation screen={screen} go={go} open={navOpen} setOpen={setNavOpen} />
      <div className={navOpen?"content wide":"content slim"}>
        {view}
      </div>
      {checkin && <Checkin close={() => setCheckin(false)} />}
      <PwaOnboarding userId={user.id} />
    </main>
  );
}
