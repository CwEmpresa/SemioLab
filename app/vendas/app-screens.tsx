import type { ReactElement } from "react";
import {
  Activity,
  Award,
  AudioLines,
  BookOpenCheck,
  ClipboardCheck,
  ClipboardList,
  Flame,
  Home,
  Layers,
  LibraryBig,
  Mic,
  NotebookPen,
  Pause,
  Play,
  ScanLine,
  Search,
  Stethoscope,
  Target,
  Trophy,
  UserRound,
  Zap,
} from "lucide-react";

export type ScreenId =
  | "home"
  | "patient"
  | "quiz"
  | "flashcards"
  | "auscultation"
  | "atlas"
  | "progress";

/* Os mesmos oito atalhos, rótulos e tons do Acesso Rápido em
   app/semiolab.tsx — a tela dentro do aparelho é a UI real do produto,
   não um mock inventado, então ela nunca desatualiza. */
const APPS = [
  { label: "Paciente IA", icon: Stethoscope, a: "#4fe3c9", b: "#0f9e87" },
  { label: "Quiz rápido", icon: Zap, a: "#6aa8ff", b: "#2f6fe4" },
  { label: "Simulados", icon: ClipboardCheck, a: "#8b8cff", b: "#4f46e5" },
  { label: "Laboratório", icon: AudioLines, a: "#c08cff", b: "#8b3fe0" },
  { label: "Atlas TC 3D", icon: ScanLine, a: "#ffb45e", b: "#f07a1a" },
  { label: "Caderno de erros", icon: NotebookPen, a: "#ff8aa1", b: "#e5486a" },
  { label: "Semiologia", icon: BookOpenCheck, a: "#5fd6f2", b: "#138fb3" },
  { label: "Flashcards", icon: Layers, a: "#ffd45e", b: "#e09a12" },
] as const;

const WEEK = [
  { day: "S", state: "done" },
  { day: "T", state: "done" },
  { day: "Q", state: "done" },
  { day: "Q", state: "done" },
  { day: "S", state: "today" },
  { day: "S", state: "" },
  { day: "D", state: "" },
] as const;

/** Barra de status do iOS — o aparelho só parece real com ela. */
function StatusBar() {
  return (
    <div className="lp-status" aria-hidden="true">
      <span className="lp-status-time">9:41</span>
      <span className="lp-status-icons">
        <i className="lp-status-signal">
          <b />
          <b />
          <b />
          <b />
        </i>
        <i className="lp-status-wifi" />
        <i className="lp-status-battery" />
      </span>
    </div>
  );
}

function MiniNav({ active }: { active: ScreenId }) {
  const items = [
    { id: "home", label: "Início", icon: Home },
    { id: "study", label: "Ensino", icon: LibraryBig },
    { id: "patient", label: "Paciente", icon: Stethoscope },
    { id: "quiz", label: "Quiz", icon: ClipboardCheck },
    { id: "profile", label: "Perfil", icon: UserRound },
  ] as const;
  const on =
    active === "patient"
      ? "patient"
      : active === "quiz"
        ? "quiz"
        : active === "flashcards" || active === "atlas" || active === "auscultation"
          ? "study"
          : active === "progress"
            ? "profile"
            : "home";
  return (
    <div className="lp-mini-nav" aria-hidden="true">
      {items.map((item) => (
        <span key={item.id} className={item.id === on ? "on" : ""}>
          <item.icon />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function Screen({
  id,
  children,
  nav = true,
}: {
  id: ScreenId;
  children: React.ReactNode;
  nav?: boolean;
}) {
  return (
    <div className="lp-screen">
      <StatusBar />
      <div className="lp-screen-scroll">{children}</div>
      {nav ? <MiniNav active={id} /> : null}
    </div>
  );
}

function HomeScreen() {
  return (
    <Screen id="home">
      <header className="lp-mini-greet">
        <b>Oi, Carlos</b>
        <span>4 dias seguidos de estudo. Continue assim.</span>
      </header>
      <div className="lp-mini-search">
        <Search />
        Pesquise um tema: sopro sistólico, ascite…
      </div>
      <div className="lp-mini-mission">
        <small>MISSÃO DE HOJE</small>
        <b>Ausculta cardíaca: 5 questões</b>
        <div className="lp-mini-bar">
          <i style={{ width: "62%" }} />
        </div>
      </div>
      <div className="lp-mini-grid">
        {APPS.map((app) => (
          <span className="lp-mini-app" key={app.label}>
            <i
              className="lp-mini-tile"
              style={{ ["--tone-a" as string]: app.a, ["--tone-b" as string]: app.b }}
            >
              <app.icon />
            </i>
            <em>{app.label}</em>
          </span>
        ))}
      </div>
      <section className="lp-mini-streak">
        <header>
          <i className="lp-mini-flame">
            <Flame />
          </i>
          <span>
            <small>STREAK DE ESTUDOS</small>
            <b>
              4 <em>dias em sequência</em>
            </b>
          </span>
        </header>
        <div className="lp-mini-week">
          {WEEK.map((d, i) => (
            <span key={i} className={d.state}>
              <small>{d.day}</small>
              {d.state === "done" ? <Flame /> : d.state === "today" ? <Zap /> : <b />}
            </span>
          ))}
        </div>
      </section>
      <section className="lp-mini-topics">
        <small>ONDE FOCAR AGORA</small>
        <span>
          <b>Ausculta cardíaca</b>
          <i><u style={{ width: "38%" }} /></i>
          <em>38%</em>
        </span>
        <span>
          <b>Exame do abdome</b>
          <i><u style={{ width: "61%" }} /></i>
          <em>61%</em>
        </span>
      </section>
    </Screen>
  );
}

function PatientScreen() {
  return (
    <div className="lp-screen">
      <StatusBar />
      <div className="lp-screen-scroll lp-chat">
        <header className="lp-chat-head">
          <span className="lp-chat-avatar" aria-hidden="true" />
          <span>
            <b>Marta, 68 anos</b>
            <small>Atendimento em andamento</small>
          </span>
        </header>
        <p className="lp-bubble them">
          Doutor, tô com falta de ar até pra tomar banho. E as pernas não param de inchar.
        </p>
        <p className="lp-bubble me">A senhora acorda à noite sem ar?</p>
        <p className="lp-bubble them">
          Acordo sim. Tenho que sentar na cama e usar dois travesseiros pra dormir.
        </p>
        <p className="lp-bubble exam">
          <b>RADIOGRAFIA DE TÓRAX</b>
          Índice cardiotorácico aumentado, congestão hilar e linhas B de Kerley.
        </p>
        <p className="lp-bubble me">Os tornozelos incham no fim do dia?</p>
        <p className="lp-bubble them">Incham, doutor. Fico com a meia marcando a perna.</p>
      </div>
      <div className="lp-chat-bar" aria-hidden="true">
        <Mic />
        Pergunte ou peça um exame
        <ClipboardList />
      </div>
      <MiniNav active="patient" />
    </div>
  );
}

function QuizScreen() {
  return (
    <Screen id="quiz">
      <div className="lp-quiz-top">
        <span>QUESTÃO 3 DE 5</span>
        <span>Ausculta cardíaca</span>
      </div>
      <div className="lp-quiz-progress">
        <i style={{ width: "60%" }} />
      </div>
      <p className="lp-quiz-q">
        Sopro holossistólico em foco mitral com irradiação para axila sugere qual lesão?
      </p>
      <div className="lp-quiz-opts">
        <span>Estenose aórtica</span>
        <span className="right">Insuficiência mitral</span>
        <span className="wrong">Estenose mitral</span>
        <span>Comunicação interatrial</span>
      </div>
      <div className="lp-quiz-why">
        <small>POR QUÊ</small>
        <p>O refluxo do ventrículo para o átrio esquerdo gera sopro durante toda a sístole, com irradiação para a axila.</p>
      </div>
      <span className="lp-quiz-next">Próxima questão</span>
    </Screen>
  );
}

function FlashcardsScreen() {
  return (
    <Screen id="flashcards">
      <div className="lp-quiz-top">
        <span>REVISÃO DE HOJE</span>
        <span>7 cartas</span>
      </div>
      <div className="lp-quiz-progress">
        <i style={{ width: "28%" }} />
      </div>
      <div className="lp-card-deck">
        <div className="lp-flash">
          <small>SEMIOLOGIA RESPIRATÓRIA</small>
          <b>Frêmito toracovocal aumentado</b>
          <p>
            Indica consolidação pulmonar: o parênquima condensado transmite melhor a vibração da voz
            até a parede do tórax.
          </p>
          <div className="lp-flash-actions">
            <span>Errei</span>
            <span>Difícil</span>
            <span>Acertei</span>
          </div>
        </div>
      </div>
      <p className="lp-flash-hint">Toque na carta para virar</p>
    </Screen>
  );
}

function AuscultationScreen() {
  const bars = [
    18, 42, 26, 68, 90, 54, 30, 72, 96, 60, 34, 22, 48, 82, 100, 58, 28, 40, 74, 52, 24, 36, 64, 44,
    20, 56, 88, 46, 30, 62,
  ];
  return (
    <Screen id="auscultation">
      <div className="lp-lab-tabs">
        <span className="on">Cardíaca</span>
        <span>Pulmonar</span>
        <span>Pediátrica</span>
      </div>
      <div className="lp-lab-player">
        <small>SOPRO SISTÓLICO</small>
        <b>Estenose aórtica</b>
        <div className="lp-wave" aria-hidden="true">
          {bars.map((h, i) => (
            <i key={i} style={{ height: `${h}%` }} className={i < 15 ? "played" : ""} />
          ))}
        </div>
        <div className="lp-lab-controls" aria-hidden="true">
          <span className="lp-lab-play">
            <Pause />
          </span>
          <em>0:04 / 0:09</em>
          <span className="lp-lab-loop">1x</span>
        </div>
      </div>
      <div className="lp-lab-list">
        <span>
          <i>
            <Play />
          </i>
          Desdobramento de B2
        </span>
        <span>
          <i>
            <Play />
          </i>
          Atrito pericárdico
        </span>
        <span>
          <i>
            <Play />
          </i>
          Estertores crepitantes
        </span>
      </div>
    </Screen>
  );
}

function AtlasScreen() {
  return (
    <Screen id="atlas">
      <div className="lp-quiz-top">
        <span>ATLAS DE TC 3D</span>
        <span>Tórax</span>
      </div>
      <div className="lp-atlas-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/semiolab-heart-3d.png" alt="" />
        <span className="lp-atlas-halo" aria-hidden="true" />
        <span className="lp-atlas-pin lp-atlas-pin-1" aria-hidden="true">
          Pericárdio
        </span>
        <span className="lp-atlas-pin lp-atlas-pin-2" aria-hidden="true">
          Ventrículo esquerdo
        </span>
      </div>
      <div className="lp-atlas-slider" aria-hidden="true">
        <small>CORTE AXIAL</small>
        <div>
          <i style={{ width: "46%" }} />
        </div>
      </div>
    </Screen>
  );
}

function ProgressScreen() {
  return (
    <Screen id="progress">
      <div className="lp-prog-hero">
        <div>
          <small>NÍVEL 7</small>
          <b>Raciocínio clínico</b>
          <strong>3.240 XP</strong>
          <div className="lp-mini-bar">
            <i style={{ width: "68%" }} />
          </div>
        </div>
        <span className="lp-prog-badge" aria-hidden="true">
          <Award />
          <b>74%</b>
          <em>domínio</em>
        </span>
      </div>
      <div className="lp-prog-grid">
        <span>
          <i>
            <Target />
          </i>
          <b>82%</b>
          <em>Acertos</em>
        </span>
        <span>
          <i>
            <ClipboardCheck />
          </i>
          <b>146</b>
          <em>Questões</em>
        </span>
        <span>
          <i>
            <Activity />
          </i>
          <b>71%</b>
          <em>Simulados</em>
        </span>
        <span>
          <i>
            <Stethoscope />
          </i>
          <b>76%</b>
          <em>Consultas</em>
        </span>
      </div>
      <div className="lp-rank-list">
        <header>
          <Trophy />
          <b>Ranking</b>
          <em>Sua posição: 12º</em>
        </header>
        <span>
          <b>10º</b>
          <i>MR</i>
          <em>2.980 XP</em>
        </span>
        <span className="me">
          <b>12º</b>
          <i>CW</i>
          <em>3.240 XP</em>
        </span>
        <span>
          <b>13º</b>
          <i>JP</i>
          <em>2.740 XP</em>
        </span>
      </div>
    </Screen>
  );
}

export const SCREENS: Record<ScreenId, () => ReactElement> = {
  home: HomeScreen,
  patient: PatientScreen,
  quiz: QuizScreen,
  flashcards: FlashcardsScreen,
  auscultation: AuscultationScreen,
  atlas: AtlasScreen,
  progress: ProgressScreen,
};
