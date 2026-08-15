"use client";
import { useMemo, useState, useRef, useEffect } from "react";
import {
  Activity, ArrowLeft, Award, BarChart3, Bell, BookOpen, Brain, Check,
  BadgeCheck, Camera, ChevronRight, CircleAlert, ClipboardCheck, Clock3, CreditCard, Flame, HeartPulse,
  AudioLines, HelpCircle, Mail, MessageCircle, Palette,
  Home, LibraryBig, LockKeyhole, LogOut, Menu, MessageSquareText,
  Search, Send, Settings, ShieldCheck, SlidersHorizontal, Sparkles, Stethoscope, Target,
  Trophy, UserRound, X, Zap,
} from "lucide-react";
import PatientExperience from "./patient-experience";
import QuizExperience from "./quiz-experience";
import RankingExperience, { HomeRankCard } from "./ranking-experience";
import { SignIn1 } from "@/components/ui/modern-stunning-sign-in";
import { HeartDashboardHero } from "@/components/ui/heart-dashboard-hero";
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
type MasteryRecord = {
  topic: string;
  score: number | null;
  status: string;
  questions: number;
  consultations: number;
  reviews: number;
  sources: string[];
  lastActivity: number | null;
};
type LearningSummary = {
  profile?: { xp?: number };
  mastery?: MasteryRecord[];
  stats?: { attempts?: number; questions?: number; correct?: number; consultations?: number; averageScore?: number };
  loginDays?: string[];
};
function useLearningSummary() {
  const [summary, setSummary] = useState<LearningSummary | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    const load = () => {
      fetch("/api/learning")
        .then((response) => response.ok ? response.json() : null)
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
const questions = [
  { text:"Na estenose mitral, qual achado é mais característico à ausculta?", options:["Sopro sistólico ejetivo","Ruflar diastólico em foco mitral","Sopro contínuo","Atrito pericárdico"], correct:1, why:"O ruflar diastólico ocorre pela passagem turbulenta do sangue através da valva mitral estreitada." },
  { text:"Qual sinal sugere comprometimento do trato corticoespinhal?", options:["Romberg","Babinski","Lasègue","Murphy"], correct:1, why:"O sinal de Babinski indica disfunção do neurônio motor superior e do trato corticoespinhal." },
  { text:"Macicez à percussão e redução do murmúrio vesicular sugerem:", options:["Pneumotórax","Asma","Derrame pleural","Bronquite"], correct:2, why:"O líquido pleural produz macicez e reduz a transmissão do murmúrio vesicular." },
];
const ranks = [
  { p:1, n:"Ana Rodrigues", xp:4820, i:"AR" },
  { p:2, n:"Carlos Mendes", xp:4310, i:"CM" },
  { p:3, n:"Beatriz Lima",  xp:3950, i:"BL" },
  { p:4, n:"Diego Costa",   xp:3680, i:"DC" },
  { p:5, n:"Mariana Alves", xp:3210, i:"MA" },
  { p:6, n:"Você",          xp:2840, i:"CW", me:true },
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

function Login({ enter }: { enter: () => void }) {
  return <SignIn1 onSignIn={enter} />;
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
          <i>CW</i>
          <span><b>Carlos Wendel</b><small>Clínico · Nível 7</small></span>
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
            <i>CW</i><span><b>Carlos Wendel</b><small>Clínico · Nível 7</small></span><ChevronRight />
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
function useLocalWeek() {
  const [todayIndex, setTodayIndex] = useState(0);
  useEffect(() => {
    const update = () => setTodayIndex((new Date().getDay() + 6) % 7);
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return weekDays.map((day, index) => ({
    day,
    state: index < todayIndex ? "done" : index === todayIndex ? "today" : "future",
  }));
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

function Top({ title = "Bom dia, Carlos", go }: { title?: string; go:(s:Screen)=>void }) {
  const today = useTodayLabel();
  return (
    <header className="top">
      <div>
        <small>{today}</small>
        <h2>{title}</h2>
      </div>
      <div>
        <button><Bell /><i /></button>
        <button className="avatar" onClick={() => go("profile")}>CW</button>
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

  // Animate XP counters
  const xpRef  = useCountUp(284, " XP");
  const minRef = useCountUp(68);
  const actRef = useCountUp(9);
  const today = useTodayLabel();
  const localWeek = useLocalWeek();
  const { summary: learning } = useLearningSummary();

  return (
    <div className="page home-page" ref={pageRef}>
      <Top go={go} />
      <div className="dash" ref={dashRef}>
        <HeartDashboardHero onContinue={() => go("study")} />

        <section className="quick">
          <header>
            <small>ACESSO RÁPIDO</small>
            <h3>O que vamos treinar?</h3>
          </header>
          <button className="next-patient" onClick={() => go("patient")}>
            <i><Stethoscope /></i>
            <span><b>Próximo paciente</b><small>Consulta sem pistas · 8–12 min</small></span>
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
              <b>12 <em>dias em sequência</em></b>
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
            <span><b>Próximo marco: 15 dias</b><small>Faltam apenas 3 dias</small></span>
            <div><i style={{ width:"80%" }} /></div>
            <em>80%</em>
          </footer>
        </section>

        <section className="week">
          <header className="section-title">
            <span>
              <small>EVOLUÇÃO SEMANAL</small>
              <h3>Você está ganhando ritmo</h3>
            </span>
            <button onClick={() => go("progress")}>Detalhes</button>
          </header>
          <div className="metrics">
            <span><b ref={xpRef as any}>0 XP</b><small>XP ganhos</small></span>
            <span><b ref={minRef as any}>0</b><small>minutos</small></span>
            <span><b ref={actRef as any}>0</b><small>atividades</small></span>
          </div>
          <div className="chart">
            {[35,52,42,78,68,24,12].map((v, i) => (
              <span key={i}>
                <i style={{ height:`${v}%` }} className={i === 3 ? "best" : ""} />
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
  const nextMilestone = Math.max(5, Math.ceil((calendar.currentStreak + 1) / 5) * 5);
  const milestoneProgress = Math.min(100, Math.round((calendar.currentStreak / nextMilestone) * 100));

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
          <h2><strong>{calendar.currentStreak}</strong> {calendar.currentStreak === 1 ? "dia" : "dias"}</h2>
          <p>{claimed ? "Sua chama continua acesa. O calendário foi atualizado automaticamente." : "Acesse diariamente para construir sua sequência clínica."}</p>
        </header>

        <div className="streak-activity-card">
          <header><b>Calendário de atividade</b><span>{loading ? "Atualizando…" : `${calendar.active.size} dias registrados`}</span></header>
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
          <span className="milestone-badge"><Flame /><b>{calendar.currentStreak}</b></span>
          <div>
            <small>PRÓXIMO MARCO</small>
            <b>Faltam {Math.max(0, nextMilestone - calendar.currentStreak)} dias para {nextMilestone} dias</b>
            <span><i style={{ width:`${milestoneProgress}%` }} /></span>
            <em>{milestoneProgress}% concluído</em>
          </div>
          <span className="milestone-next"><LockKeyhole /><b>{nextMilestone}</b></span>
        </div>

        <div className="check-stats">
          <span><b>{calendar.currentStreak} dias</b><small>sequência atual</small></span>
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
  const realFor = (name: string) => summary?.mastery?.find((item) => item.topic === name);
  const spotlight = ["Cardiovascular", "Neurológico", "Respiratório", "Abdome e digestório"];
  const topicWheel = ["Cardiovascular", "Respiratório", "Anamnese", "Neurológico", "Abdome e digestório", "Exame físico"];

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
          <p>{loading ? "Carregando seu histórico real…" : `Faltam ${toNextLevel} XP para o próximo nível`}</p>
          <div className="progress-level-track"><i style={{ width:`${levelProgress}%` }} /><b>{levelProgress}%</b></div>
        </div>
        <div className="progress-heart-stage">
          <span className="progress-heart-halo" />
          <img src="/semiolab-heart-3d.png" alt="Modelo anatômico tridimensional de um coração" />
          <aside><i><Award /></i><b>{generalMastery === null ? "—" : `${generalMastery}%`}</b><small>{generalMastery === null ? "sem dados avaliados" : "domínio geral"}</small></aside>
        </div>
      </section>

      <div className="progress-metric-grid">
        <article><i><Target /></i><span><b>{accuracy === null ? "—" : `${accuracy}%`}</b><small>Acertos reais</small></span></article>
        <article><i><ClipboardCheck /></i><span><b>{questions}</b><small>Questões concluídas</small></span></article>
        <article><i><Stethoscope /></i><span><b>{consultations}</b><small>Consultas finalizadas</small></span></article>
      </div>

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
        <footer><ShieldCheck /> Dados calculados a partir dos seus resultados reais</footer>
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
        <p className="topic-wheel-note"><ShieldCheck /> O preenchimento de cada segmento usa somente resultados avaliados.</p>
      </section>
    </div>
  );
}

/* ─── Ranking ───────────────────────────────────────────────────── */
export function RankingLegacy({ go }: { go:(s:Screen)=>void }) {
  const pageRef = useScreenTransition("ranking");
  const listRef = useStaggerReveal(".rank-list span, .podium span", ["ranking"]);
  return (
    <div className="page" ref={pageRef}>
      <Top title="Ranking semanal" go={go} />
      <div className="ranking" ref={listRef}>
        <header>
          <small>ENCERRA EM 2D 14H</small>
          <h1>A constância coloca você no pódio.</h1>
          <p>Somente XP válido conquistado nesta semana.</p>
        </header>
        <div className="podium">
          {[ranks[1],ranks[0],ranks[2]].map((r) => (
            <span key={r.p} className={`p${r.p}`}>
              <i>{r.i}</i><b>{r.n.split(" ")[0]}</b>
              <small>{r.xp.toLocaleString()} XP</small><em>{r.p}</em>
            </span>
          ))}
        </div>
        <div className="rank-list">
          {ranks.slice(3).map((r) => (
            <span key={r.p} className={r.me?"me":""}>
              <b>{r.p}</b><i>{r.i}</i>
              <em>{r.n}<small>Nível {r.me?7:9}</small></em>
              <strong>{r.xp.toLocaleString()} XP</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Achievements ──────────────────────────────────────────────── */
function Achievements({ go }: { go:(s:Screen)=>void }) {
  const pageRef = useScreenTransition("achievements");
  const gridRef = useStaggerReveal("article", ["achievements"]);
  const a = [
    ["Primeira consulta", Stethoscope, true],
    ["7 dias",            Flame,        true],
    ["Olhar clínico",     Target,       true],
    ["100 questões",      ClipboardCheck, false],
    ["Cardio em foco",    HeartPulse,   false],
    ["Imparável",         Trophy,       false],
  ] as const;
  return (
    <div className="page" ref={pageRef}>
      <Top title="Conquistas" go={go} />
      <div className="intro">
        <span>
          <small>MARCOS DA SUA JORNADA</small>
          <h1>Progresso que merece ser lembrado.</h1>
          <p>Você desbloqueou 3 de 18 conquistas.</p>
        </span>
      </div>
      <div className="achievements" ref={gridRef}>
        {a.map(([name, Icon, on]) => (
          <article key={name} className={on?"on":"off"}>
            <i><Icon /></i>
            <small>{on?"DESBLOQUEADA":"EM PROGRESSO"}</small>
            <h3>{name}</h3>
            <p>{on?"Uma etapa importante da sua evolução clínica.":"Continue estudando para alcançar este marco."}</p>
            {!on && <div><i style={{ width:"48%" }} /></div>}
          </article>
        ))}
      </div>
    </div>
  );
}

/* ─── Profile ───────────────────────────────────────────────────── */
type ProfilePanel = "account"|"preferences"|"support"|null;
type AppTheme = "light"|"dark";

const defaultProfile = { name:"Carlos Wendel", role:"Estudante de Medicina · Ciclo clínico", email:"aluno@medicina.com" };
const defaultPreferences = { dailyGoal:"20", reminders:true, reminderTime:"19:00", sound:true };

async function prepareProfileImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Escolha uma imagem válida.");
  const original = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Não foi possível processar a imagem."));
    img.src = original;
  });
  const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", .82);
}

function Profile({ go, logout, theme, setTheme }: { go:(s:Screen)=>void; logout:()=>void; theme:AppTheme; setTheme:(theme:AppTheme)=>void }) {
  const [premium, setPremium] = useState(false);
  const [proPlan, setProPlan] = useState<"monthly"|"annual">("annual");
  const [panel, setPanel] = useState<ProfilePanel>(null);
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
      const savedProfile = localStorage.getItem("semiolab.profile");
      const savedPreferences = localStorage.getItem("semiolab.preferences");
      const savedAvatar = localStorage.getItem("semiolab.avatar");
      const savedCover = localStorage.getItem("semiolab.cover");
      if (savedProfile) { const value = JSON.parse(savedProfile); setProfile(value); setDraft(value); }
      if (savedPreferences) { const value = JSON.parse(savedPreferences); setPreferences(value); setPreferenceDraft(value); }
      if (savedAvatar) setAvatar(savedAvatar);
      if (savedCover) setCover(savedCover);
    } catch { /* dados locais inválidos voltam aos padrões seguros */ }
  }, []);

  const inform = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  };
  const uploadImage = async (file: File | undefined, kind: "avatar"|"cover") => {
    if (!file) return;
    try {
      const image = await prepareProfileImage(file);
      if (kind === "avatar") { setAvatar(image); localStorage.setItem("semiolab.avatar", image); }
      else { setCover(image); localStorage.setItem("semiolab.cover", image); }
      inform(kind === "avatar" ? "Foto de perfil atualizada." : "Capa atualizada.");
    } catch (error) { inform(error instanceof Error ? error.message : "Não foi possível usar essa imagem."); }
  };
  const saveAccount = () => {
    if (!draft.name.trim()) {
      inform("Preencha o nome para continuar."); return;
    }
    const value = { name:draft.name.trim(), role:draft.role.trim() || defaultProfile.role, email:profile.email };
    setProfile(value); localStorage.setItem("semiolab.profile", JSON.stringify(value)); setPanel(null); inform("Dados salvos com sucesso.");
  };
  const savePreferences = () => {
    setPreferences(preferenceDraft);
    localStorage.setItem("semiolab.preferences", JSON.stringify(preferenceDraft));
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
      <section className="profile-pro-card">
        <div className="profile-pro-icon"><Sparkles /></div>
        <span>
          <small>SEMIO<span>LAB</span> PRO</small>
          <h2>Evolua sem limites.</h2>
          <p>Pacientes virtuais, atlas clínico e simulados ilimitados.</p>
        </span>
        <button onClick={() => setPremium(true)}>Conhecer Pro <ChevronRight /></button>
      </section>
      <section className="profile-settings-block">
        <h3>Conta</h3>
        <div className="profile-settings-list">
          <button onClick={() => openPanel("account")}><Settings /><span><b>Dados da conta</b><small>Nome e formação</small></span><ChevronRight /></button>
          <button onClick={() => setPremium(true)}><CreditCard /><span><b>Plano e assinatura</b><small>Plano gratuito</small></span><ChevronRight /></button>
          <button onClick={() => go("achievements")}><Award /><span><b>Conquistas</b><small>3 de 18 desbloqueadas</small></span><ChevronRight /></button>
          <div className="profile-setting-row"><Palette /><span><b>Tema</b><small>Aparência do SemioLab</small></span><div className="theme-choice"><button className={theme === "light" ? "active" : ""} onClick={() => setTheme("light")}>Claro</button><button className={theme === "dark" ? "active" : ""} onClick={() => setTheme("dark")}>Escuro</button></div></div>
        </div>
      </section>
      <section className="profile-settings-block">
        <h3>Preferências e suporte</h3>
        <div className="profile-settings-list">
          <button onClick={() => openPanel("preferences")}><SlidersHorizontal /><span><b>Preferências de estudo</b><small>{preferences.dailyGoal} min por dia · lembretes {preferences.reminders ? "ativos" : "desativados"}</small></span><ChevronRight /></button>
          <button onClick={() => openPanel("support")}><HelpCircle /><span><b>Ajuda e suporte</b><small>Dúvidas, problemas e contato</small></span><ChevronRight /></button>
          <button onClick={() => { window.location.href="mailto:suporte.mapasmentaistcc@gmail.com?subject=Feedback%20SemioLab"; }}><MessageCircle /><span><b>Enviar feedback</b><small>Conte o que podemos melhorar</small></span><ChevronRight /></button>
          <button className="profile-logout" onClick={logout}><LogOut /><span><b>Sair da conta</b><small>Encerrar sessão neste dispositivo</small></span><ChevronRight /></button>
        </div>
      </section>
      {notice && <div className="profile-toast" role="status"><Check />{notice}</div>}
      {panel && (
        <div className="overlay profile-overlay" onMouseDown={() => setPanel(null)}>
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
            {panel === "support" && <>
              <small>SUPORTE</small><h2>Como podemos ajudar?</h2><p>Consulte as respostas rápidas ou fale diretamente com a equipe.</p>
              <details><summary>Meu progresso não atualizou</summary><p>Conclua a atividade até a tela final. O XP é registrado somente após a conclusão.</p></details>
              <details><summary>Minha foto não aparece</summary><p>Escolha JPG, PNG ou HEIC. A imagem é otimizada e salva neste dispositivo.</p></details>
              <a className="profile-dialog-primary" href="https://mail.google.com/mail/?view=cm&fs=1&to=suporte.mapasmentaistcc@gmail.com&su=Suporte%20SemioLab" target="_blank" rel="noopener noreferrer"><Mail /> Falar com o suporte</a>
            </>}
          </section>
        </div>
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

/* ─── Patient intent logic (preserved) ─────────────────────────── */
type PatientIntent = "greeting"|"identity"|"main"|"onset"|"previous"|"pain"|"dyspnea"|"effort"|"orthopnea"|"pnd"|"edema"|"cough"|"fever"|"palpitations"|"syncope"|"fatigue"|"weight"|"urine"|"medication"|"adherence"|"hypertension"|"diabetes"|"cardiac"|"smoking"|"alcohol"|"allergy"|"family"|"occupation"|"food"|"sleep"|"other";
const cleanText = (v: string) => v.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9\s]/g," ").replace(/\s+/g," ").trim();
function patientIntent(raw: string): PatientIntent {
  const q = cleanText(raw);
  if (/^(oi|ola|bom dia|boa tarde|boa noite)\b/.test(q)) return "greeting";
  if (/(seu nome|como se chama|qual.*idade|quantos anos)/.test(q)) return "identity";
  if (/(motivo|o que.*sentindo|o que.*trouxe|queixa principal)/.test(q)) return "main";
  if (/(primeira vez|ja teve|teve isso antes|problema parecido|aconteceu antes|episodio anterior)/.test(q)) return "previous";
  if (/(quando comecou|desde quando|ha quanto tempo|inicio.*sintoma)/.test(q)) return "onset";
  if (/(acorda.*falta|falta.*durante a noite|dispneia.*noturna)/.test(q)) return "pnd";
  if (/(quantos travesseiros|deitad|ortopneia|melhora.*sentad)/.test(q)) return "orthopnea";
  if (/(esforco|escada|andar|caminhar|atividade)/.test(q)) return "effort";
  if (/(falta de ar|respirar|dispneia|folego)/.test(q)) return "dyspnea";
  if (/(dor|aperto|pressao.*peito|peito.*aperta)/.test(q)) return "pain";
  if (/(inchaco|inchado|edema|tornozelo|perna)/.test(q)) return "edema";
  if (/(tosse|catarro|expectora)/.test(q)) return "cough";
  if (/(febre|calafrio|temperatura)/.test(q)) return "fever";
  if (/(palpitacao|coracao.*aceler|coracao.*dispar)/.test(q)) return "palpitations";
  if (/(desmai|tontura|sincope)/.test(q)) return "syncope";
  if (/(cansaco|fadiga|fraqueza)/.test(q)) return "fatigue";
  if (/(ganhou.*peso|perdeu.*peso|peso.*mudou|aumento.*peso)/.test(q)) return "weight";
  if (/(urina|diurese|urinando)/.test(q)) return "urine";
  if (/(esquece|toma.*direit|aderencia|regularmente)/.test(q)) return "adherence";
  if (/(remedio|medicamento|medicacao|comprimido)/.test(q)) return "medication";
  if (/(pressao alta|hipertens)/.test(q)) return "hypertension";
  if (/(diabetes|glicose|acucar no sangue)/.test(q)) return "diabetes";
  if (/(coracao|cardiac|infarto|insuficiencia cardiaca)/.test(q)) return "cardiac";
  if (/(fuma|cigarro|tabag)/.test(q)) return "smoking";
  if (/(alcool|bebida|bebe)/.test(q)) return "alcohol";
  if (/(alerg)/.test(q)) return "allergy";
  if (/(familia|pai|mae|irmao|familiar)/.test(q)) return "family";
  if (/(trabalha|profissao|ocupacao)/.test(q)) return "occupation";
  if (/(aliment|comida|sal)/.test(q)) return "food";
  if (/(dorme|sono)/.test(q)) return "sleep";
  return "other";
}
const patientFacts: Record<Exclude<PatientIntent,"other">, string[]> = {
  greeting:["Bom dia, doutor.","Olá. Estou um pouco preocupada com essa falta de ar."],
  identity:["Meu nome é Marina Rocha e tenho 54 anos."],
  main:["Vim porque estou muito cansada e com falta de ar desde ontem. Hoje piorou quando subi as escadas."],
  onset:["Começou ontem à tarde, primeiro como um cansaço leve. Hoje de manhã a falta de ar ficou mais forte."],
  previous:["Já senti cansaço leve outras vezes, mas falta de ar desse jeito é a primeira vez."],
  pain:["Dor forte não. Às vezes sinto um aperto leve no peito quando fico mais ofegante, sem irradiar."],
  dyspnea:["Parece que o ar não entra o suficiente. Em repouso melhora, mas ainda fico um pouco ofegante."],
  effort:["Piora bastante quando caminho rápido ou subo escadas. Hoje precisei parar no meio do lance para respirar."],
  orthopnea:["Nas últimas duas noites fiquei mais confortável com dois travesseiros. Deitada totalmente parece piorar."],
  pnd:["Ontem acordei de madrugada com falta de ar e precisei sentar na cama por alguns minutos."],
  edema:["Meus dois tornozelos ficam inchados no fim do dia. Percebi que nesta semana o inchaço aumentou."],
  cough:["Tenho uma tosse seca de vez em quando, principalmente quando me deito. Não sai catarro."],
  fever:["Não tive febre nem calafrios."],
  palpitations:["Às vezes sinto o coração acelerar quando fico ofegante, mas passa quando descanso."],
  syncope:["Não desmaiei. Tive uma tontura leve hoje ao levantar rápido, mas passou."],
  fatigue:["Estou mais cansada há cerca de uma semana, mesmo para tarefas simples de casa."],
  weight:["A balança marcou quase dois quilos a mais nesta semana, embora eu não tenha comido mais."],
  urine:["Acho que estou urinando um pouco menos desde ontem. Não sinto dor nem ardência."],
  medication:["Uso losartana de 50 mg para pressão, uma vez ao dia. Não uso outros remédios contínuos."],
  adherence:["Confesso que esqueço a losartana umas duas ou três vezes por semana, principalmente quando saio cedo."],
  hypertension:["Tenho pressão alta há uns oito anos. Nem sempre acompanho, mas na última consulta estava alta."],
  diabetes:["Nunca fui diagnosticada com diabetes."],
  cardiac:["Nunca tive infarto nem diagnóstico de insuficiência cardíaca. Um médico já disse que meu coração estava um pouco aumentado numa radiografia antiga."],
  smoking:["Fumei por cerca de quinze anos, mas parei há seis anos. Era mais ou menos meio maço por dia."],
  alcohol:["Bebo apenas socialmente, uma ou duas taças no fim de semana."],
  allergy:["Não conheço nenhuma alergia a medicamentos ou alimentos."],
  family:["Meu pai morreu de infarto aos 62 anos e minha mãe tem pressão alta. Não sei de outros problemas cardíacos na família."],
  occupation:["Sou cozinheira em uma escola e fico bastante tempo em pé. Nesta semana o trabalho ficou bem mais cansativo."],
  food:["Como comida normal, mas reconheço que uso bastante sal e como embutidos algumas vezes por semana."],
  sleep:["Tenho dormido mal porque deitada sinto mais falta de ar. Com dois travesseiros consigo descansar melhor."],
};
function virtualPatientReply(raw: string, asked: Record<string, number>) {
  const intent = patientIntent(raw);
  if (intent === "other") return "Não entendi bem o que o senhor quis investigar. Pode perguntar de outra forma, por favor?";
  const options = patientFacts[intent];
  const count = asked[intent] || 0;
  const answer = options[Math.min(count, options.length - 1)];
  if (count > 0 && !/^(greeting|main)$/.test(intent))
    return `Como eu comentei, ${answer.charAt(0).toLowerCase()}${answer.slice(1)}`;
  return answer;
}

/* ─── PatientLegacy (preserved) ─────────────────────────────────── */
export function PatientLegacy({ go }: { go:(s:Screen)=>void }) {
  const [phase, setPhase] = useState<"wait"|"chat"|"finish"|"result">("wait");
  const [msgs, setMsgs] = useState<{ who:string; text:string }[]>([]);
  const [input, setInput] = useState("");
  const [asked, setAsked] = useState<Record<string, number>>({});
  function start() { setAsked({}); setMsgs([{ who:"patient", text:"Bom dia, doutor. Desde ontem estou muito cansada e hoje tive uma falta de ar estranha." }]); setPhase("chat"); }
  function send() {
    const question = input.trim();
    if (!question) return;
    const intent = patientIntent(question);
    const answer = virtualPatientReply(question, asked);
    setAsked((a) => ({ ...a, [intent]:(a[intent]||0)+1 }));
    setMsgs((m) => [...m, { who:"student", text:question }]);
    setInput("");
    setTimeout(() => setMsgs((m) => [...m, { who:"patient", text:answer }]), 380);
  }
  if (phase==="wait") return (
    <div className="patient-wait">
      <button onClick={() => go("home")}><ArrowLeft /> Voltar</button>
      <Logo />
      <div className="patient-shape"><Stethoscope /></div>
      <section>
        <small>CONSULTÓRIO 01</small>
        <h1>Um novo paciente está aguardando atendimento.</h1>
        <p>Conduza a consulta sem pistas. Investigue, examine e tome sua decisão clínica.</p>
        <button className="primary" onClick={start}>Chamar próximo paciente <ChevronRight /></button>
        <em><ShieldCheck /> Simulação educacional · Paciente fictício</em>
      </section>
    </div>
  );
  if (phase==="result") return (
    <div className="result">
      <header><Logo /><button onClick={() => go("home")}><X /></button></header>
      <main>
        <div className="score"><b>86</b><small>Excelente evolução</small></div>
        <small>AVALIAÇÃO DA CONSULTA</small>
        <h1>Você conduziu uma boa investigação.</h1>
        <p>Hipótese esperada: <b>Insuficiência cardíaca descompensada</b></p>
        <div className="feedback">
          <article><h3><Check /> Você fez bem</h3><p>Investigou progressão da dispneia, esforço e edema. Manteve perguntas claras e objetivas.</p></article>
          <article><h3><CircleAlert /> Poderia melhorar</h3><p>Pergunte sobre ortopneia, ganho de peso, diurese e registre sinais vitais antes da hipótese.</p></article>
        </div>
        <footer>
          <button onClick={() => go("study")}>Revisar aula recomendada</button>
          <button className="primary" onClick={() => setPhase("wait")}>Próximo paciente <ChevronRight /></button>
        </footer>
      </main>
    </div>
  );
  return (
    <div className="consult">
      <header>
        <button onClick={() => setPhase("wait")}><ArrowLeft /></button>
        <i>MR</i>
        <span><b>Marina Rocha, 54 anos</b><small>● Atendimento em andamento</small></span>
        <em><Clock3 /> 06:42</em>
        <button onClick={() => setPhase("finish")}>Finalizar</button>
      </header>
      <main>
        <div className="reason"><small>MOTIVO INFORMADO NA RECEPÇÃO</small><p>"Cansaço e falta de ar desde ontem."</p></div>
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.who}`}>
            <i>{m.who==="patient"?"MR":"Você"}</i><p>{m.text}</p>
          </div>
        ))}
      </main>
      <footer>
        <div>
          <button><Stethoscope /> Exame físico</button>
          <button><ClipboardCheck /> Solicitar exame</button>
          <button><BookOpen /> Anotações</button>
        </div>
        <label>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key==="Enter"&&send()} placeholder="Faça uma pergunta ao paciente..." />
          <button aria-label="Enviar pergunta" onClick={send}><Send /></button>
        </label>
      </footer>
      {phase==="finish" && (
        <div className="overlay">
          <section className="finish">
            <button className="close" onClick={() => setPhase("chat")}><X /></button>
            <small>CONCLUIR ATENDIMENTO</small>
            <h2>Registre seu raciocínio clínico.</h2>
            <label>Hipótese principal<input placeholder="Sua principal hipótese" /></label>
            <label>Diagnósticos diferenciais<input placeholder="Separe por vírgulas" /></label>
            <label>Conduta inicial<textarea placeholder="O que você faria a seguir?" /></label>
            <button className="primary" onClick={() => setPhase("result")}>Finalizar e receber avaliação <ChevronRight /></button>
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
  const [logged, setLogged]   = useState(false);
  const [screen, setScreen]   = useState<Screen>("home");
  const [navOpen, setNavOpen] = useState(true);
  const [checkin, setCheckin] = useState(false);
  const [theme, setThemeState] = useState<AppTheme>("light");

  useEffect(() => {
    const saved = localStorage.getItem("semiolab.theme");
    if (saved === "dark" || saved === "light") setThemeState(saved);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.semiolabTheme = theme;
    localStorage.setItem("semiolab.theme", theme);
  }, [theme]);
  useEffect(() => {
    if (!logged) return;
    fetch("/api/learning", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action:"login_day", activityDate:localDateKey() }),
    }).then((response) => {
      if (response.ok) window.dispatchEvent(new Event("semiolab:learning-updated"));
    }).catch(() => {});
    const timer = window.setTimeout(() => {
      warmEmbedded("study");
      warmEmbedded("auscultation");
    }, 900);
    return () => window.clearTimeout(timer);
  }, [logged]);

  if (!logged) return <Login enter={() => { setLogged(true); setCheckin(true); }} />;

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
                              <Profile go={go} logout={() => setLogged(false)} theme={theme} setTheme={setThemeState} />;

  return (
    <main className={`app screen-${screen}`}>
      <Navigation screen={screen} go={go} open={navOpen} setOpen={setNavOpen} />
      <div className={navOpen?"content wide":"content slim"}>
        {view}
      </div>
      {checkin && <Checkin close={() => setCheckin(false)} />}
    </main>
  );
}
