import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Geist } from "next/font/google";
import { ShieldCheck } from "lucide-react";
import { TIER_LIMITS, TRIAL_DAYS } from "@/lib/access-tier";
import { CAKTO_CHECKOUT_URLS } from "@/lib/pro";
import HeroStage from "./hero-stage";
import Patients from "./patients";
import Bedside from "./bedside";
import AuscultationDemo from "./auscultation-demo";
import Pricing from "./pricing";
import Faq from "./faq";
import MobileCta from "./mobile-cta";
import neon from "../../public/brand/semiolab-neon-logo.png";
import room from "../../public/patient-room.png";
import xray from "../../public/clinical/radiografia-ic-congestiva.png";
import anatomy from "../../public/semiolab-anatomy-human.png";
import "./screens.css";
import "./sales.css";

const geist = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist", display: "swap" });

const TITLE = "SemioLab — Pacientes virtuais para treinar raciocínio clínico";
const DESCRIPTION =
  "Atenda pacientes que não entregam o diagnóstico: pergunte, ausculte sons reais, peça exames e veja onde seu raciocínio falhou. Comece grátis.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "pt_BR" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

/* Contagens do conteúdo real: data/patient-cases/pilot-50.json,
   public/media/auscultation e lib/exam-catalog.ts. */
const STATS = [
  { n: "50 pacientes", l: "com história própria" },
  { n: "46 sons reais", l: "de ausculta cardíaca e pulmonar" },
  { n: "56 exames", l: "para pedir durante a consulta" },
];

const FAQ = [
  {
    q: "Preciso de cartão para começar?",
    a: `Não. Você cria a conta e recebe ${TRIAL_DAYS} dias de Pro. Quando o período acaba, a conta continua no plano gratuito. Nada é cobrado automaticamente e nada é apagado.`,
  },
  {
    q: "E se eu assinar e não gostar?",
    a: "Você tem 7 dias a partir da compra para desistir e receber o valor de volta, pelo direito de arrependimento. O pedido é feito pela página de reembolso ou pelo contato.",
  },
  {
    q: "O SemioLab substitui a prática com pacientes reais?",
    a: "Não, e não foi feito para isso. É um lugar para errar a pergunta e refazer o raciocínio sem consequência, e chegar ao paciente real com o roteiro na cabeça.",
  },
  {
    q: "O que fica no plano gratuito?",
    a: `Um atendimento por semana com o Paciente IA, com até ${TIER_LIMITS.free.examsPerConsultation} exames, ${TIER_LIMITS.free.flashcardsPerDay} flashcards por dia, o Atlas de TC 3D, a Semiologia, o caderno de erros e a pesquisa por tema. Simulados, ausculta e conversa por voz são do Pro.`,
  },
  {
    q: "Posso cancelar a qualquer momento?",
    a: "Sim, pela própria assinatura. O Pro vale até o fim do período pago e depois a conta volta ao gratuito, com todo o histórico.",
  },
  {
    q: "Funciona no celular?",
    a: "Foi desenhado para o celular primeiro e pode ser instalado na tela de início como aplicativo. No computador funciona igual, pelo navegador.",
  },
];

export default function SalesPage() {
  return (
    <div className={`sx ${geist.variable}`}>
      <a className="sx-skip" href="#conteudo">
        Pular para o conteúdo
      </a>

      <header className="sx-nav">
        <Link href="/vendas" className="sx-brand" aria-label="SemioLab, início">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/semiolab-fox.png" alt="" width="26" height="26" />
          SemioLab
        </Link>
        <nav aria-label="Seções">
          <a href="#pacientes">Pacientes</a>
          <a href="#atender">Experimente</a>
          <a href="#recursos">Recursos</a>
          <a href="#planos">Preços</a>
        </nav>
        <Link className="sx-btn" href="/">
          Entrar
        </Link>
      </header>

      <main id="conteudo">
        {/* ─── Hero ─────────────────────────────────────────────── */}
        <section className="sx-hero">
          <div className="sx-hero-copy">
            <h1>Um paciente virtual que treina seu raciocínio antes do plantão</h1>
            <p className="sx-lead">
              Você pergunta, ausculta, pede exames e decide. No fim, o SemioLab mostra a pista que
              você deixou passar.
            </p>
            <div className="sx-hero-cta">
              <Link className="sx-btn sx-btn-lg" href="/">
                Começar grátis
              </Link>
              <small>{TRIAL_DAYS} dias de Pro incluídos. Sem cartão.</small>
            </div>
          </div>
          <HeroStage />
        </section>

        {/* ─── Números ──────────────────────────────────────────── */}
        <section className="sx-stats" aria-label="O SemioLab em números">
          <ul>
            {STATS.map((s) => (
              <li key={s.n}>
                <b>{s.n}</b>
                <span>{s.l}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── Pacientes ────────────────────────────────────────── */}
        <section className="sx-sec" id="pacientes">
          <div className="sx-wrap sx-head-row">
            <div>
              <h2>Seus pacientes estão na sala de espera</h2>
              <p className="sx-lead">
                Cada um chega com a queixa, as palavras e a história dele. Nenhum entrega o
                diagnóstico: você descobre perguntando.
              </p>
            </div>
            <Link className="sx-btn" href="/">
              Começar grátis
            </Link>
          </div>
          <Patients />
        </section>

        {/* ─── Neon ─────────────────────────────────────────────── */}
        <section className="sx-neon">
          <div className="sx-neon-art" aria-hidden="true">
            <Image src={neon} alt="" sizes="(max-width: 760px) 120vw, 880px" />
          </div>
          <div className="sx-wrap">
            <div className="sx-neon-copy">
              <h2>Plantão de treino aberto 24 horas</h2>
              <p className="sx-lead">
                Às três da manhã ou no intervalo da aula. Ninguém vê você errar. Só você vê onde
                errou.
              </p>
              <Link className="sx-btn" href="/">
                Começar agora
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Experimente: painel branco com a consulta ────────── */}
        <section className="sx-panel" aria-labelledby="experimente">
          <div className="sx-panel-grid">
            <div>
              <h2 id="experimente">Atenda a Marta agora.</h2>
              <p className="sx-panel-sub">Sem criar conta.</p>
            </div>
            <Bedside />
            <div className="sx-panel-side">
              <p>
                Três perguntas, dois exames e uma hipótese. No fim, você vê as pistas que deixou
                passar, do mesmo jeito que o app corrige cada atendimento.
              </p>
              <Link className="sx-btn sx-btn-outline-dark" href="/">
                Criar conta grátis
              </Link>
            </div>
          </div>
        </section>

        {/* ─── Imagem de ponta a ponta ──────────────────────────── */}
        <section className="sx-bleed">
          <Image src={room} alt="" fill sizes="100vw" className="sx-bleed-img" placeholder="blur" />
          <div className="sx-wrap sx-bleed-copy">
            <h2>A porta abre. O próximo caso entra.</h2>
            <p className="sx-lead">
              Você começa sem o diagnóstico, como no plantão. O paciente responde do jeito dele. Se
              você não pergunta, ele não conta.
            </p>
            <Link className="sx-btn" href="/">
              Começar grátis
            </Link>
          </div>
        </section>

        {/* ─── Recursos em blocos alternados ────────────────────── */}
        <section className="sx-sec" id="recursos">
          <div className="sx-wrap sx-rows">
            <div className="sx-row">
              <div
                className="sx-row-art sx-row-art-center"
                style={{
                  ["--art" as string]:
                    "radial-gradient(circle at 30% 20%, #0d9488 0%, transparent 55%), radial-gradient(circle at 80% 90%, #6d28d9 0%, transparent 55%), #0b0b10",
                }}
              >
                <AuscultationDemo />
              </div>
              <div className="sx-row-copy">
                <h2>Ouça o sopro antes de ouvir no paciente</h2>
                <p className="sx-lead">
                  46 gravações reais, cardíacas e pulmonares, com a onda na tela e quiz de
                  reconhecimento. Aperte o play e compare. O laboratório é do Pro, e você testa grátis
                  por {TRIAL_DAYS} dias.
                </p>
                <Link className="sx-btn" href="/">
                  Começar grátis
                </Link>
              </div>
            </div>

            <div className="sx-row flip">
              <div className="sx-row-art" style={{ ["--art" as string]: "#000" }}>
                <Image
                  src={xray}
                  alt="Radiografia de tórax com área cardíaca aumentada e congestão pulmonar"
                  fill
                  sizes="(max-width: 860px) 100vw, 640px"
                />
                <span className="sx-img-credit">James Heilman, MD, CC BY-SA 4.0</span>
                <div className="sx-report" aria-hidden="true">
                  <small>Radiografia de tórax</small>
                  <p>Cardiomegalia, congestão hilar bilateral e linhas B de Kerley.</p>
                </div>
              </div>
              <div className="sx-row-copy">
                <h2>Você pede o exame. O laudo chega na conversa.</h2>
                <p className="sx-lead">
                  São 56 exames, do hemograma à tomografia. O laudo aparece dentro do atendimento,
                  com a imagem quando existe. A hipótese continua sendo sua.
                </p>
                <Link className="sx-btn" href="/">
                  Começar grátis
                </Link>
              </div>
            </div>

            <div className="sx-row">
              <div
                className="sx-row-art sx-anatomy"
                style={{ ["--art" as string]: "radial-gradient(circle at 50% 40%, #134e4a, #0b0b10 70%)" }}
              >
                <Image src={anatomy} alt="" fill sizes="(max-width: 860px) 100vw, 640px" />
                <span className="sx-callout c1" style={{ ["--c" as string]: "#3de0c4" }} aria-hidden="true">
                  <i />
                  Cardiovascular <b>74%</b>
                </span>
                <span className="sx-callout c2" style={{ ["--c" as string]: "#3de0c4" }} aria-hidden="true">
                  <i />
                  Respiratório <b>61%</b>
                </span>
                <span className="sx-callout c3" style={{ ["--c" as string]: "#fbbf77" }} aria-hidden="true">
                  <i />
                  Renal <b>34%</b>
                </span>
                <span className="sx-callout c4" style={{ ["--c" as string]: "#3de0c4" }} aria-hidden="true">
                  <i />
                  Abdome <b>66%</b>
                </span>
              </div>
              <div className="sx-row-copy">
                <h2>Veja onde seu raciocínio está fraco</h2>
                <p className="sx-lead">
                  Quiz, simulado e atendimento somam na mesma nota por sistema. Você sabe o que
                  revisar antes da prova, não depois.
                </p>
                <Link className="sx-btn" href="/">
                  Começar grátis
                </Link>
              </div>
            </div>

            <div className="sx-row flip">
              <div
                className="sx-row-art sx-row-art-center"
                style={{
                  ["--art" as string]:
                    "radial-gradient(circle at 70% 25%, #c2410c 0%, transparent 50%), radial-gradient(circle at 20% 85%, #1d4ed8 0%, transparent 55%), #0b0b10",
                }}
                aria-hidden="true"
              >
                <div className="sx-cards">
                  <span />
                  <span />
                  <span>
                    <small>Semiologia respiratória</small>
                    <b>Frêmito toracovocal aumentado: o que sugere?</b>
                  </span>
                  <em className="sx-cards-due">12 para revisar hoje</em>
                </div>
              </div>
              <div className="sx-row-copy">
                <h2>Seus erros viram flashcards</h2>
                <p className="sx-lead">
                  Cada pista perdida vai para o caderno de erros e volta em revisão espaçada, no dia
                  certo. Você estuda o que errou, não o que já sabe.
                </p>
                <Link className="sx-btn" href="/">
                  Começar grátis
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Planos ───────────────────────────────────────────── */}
        <section className="sx-sec" id="planos">
          <div className="sx-wrap">
            <div className="sx-head-row">
              <div>
                <h2>Escolha seu plano</h2>
                <p className="sx-lead">
                  Comece grátis. Assine quando o limite começar a incomodar. No anual você economiza
                  20%.
                </p>
              </div>
            </div>
            <Pricing
              checkout={CAKTO_CHECKOUT_URLS}
              free={{
                exams: TIER_LIMITS.free.examsPerConsultation,
                flashcards: TIER_LIMITS.free.flashcardsPerDay,
              }}
              pro={{
                consultations: TIER_LIMITS.pro.consultations,
                simulados: TIER_LIMITS.pro.simuladosPerDay,
              }}
            />
            <p className="sx-plans-foot">
              <ShieldCheck aria-hidden="true" />
              <span>
                <b>7 dias para desistir.</b> Assinou e não era o que esperava? Reembolso integral em
                até 7 dias da compra. <Link href="/reembolso">Política de reembolso</Link>
              </span>
            </p>
          </div>
        </section>

        {/* ─── Dúvidas ──────────────────────────────────────────── */}
        <section className="sx-sec sx-faq-sec" id="duvidas">
          <div className="sx-wrap">
            <div className="sx-head-row">
              <div>
                <h2>Dúvidas? A gente responde.</h2>
                <p className="sx-lead">
                  As perguntas mais comuns sobre o SemioLab. Outra dúvida?{" "}
                  <Link href="/contato">Fale com a gente</Link>.
                </p>
              </div>
            </div>
            <Faq items={FAQ} />
          </div>
        </section>

        {/* ─── Fechamento ───────────────────────────────────────── */}
        <section className="sx-close">
          <Image src={xray} alt="" fill sizes="100vw" className="sx-close-img" />
          <div className="sx-close-inner">
            <h2>Pronto pro próximo paciente?</h2>
            <p className="sx-lead">Comece agora. A conta é grátis e vem com {TRIAL_DAYS} dias de Pro.</p>
            <Link className="sx-btn sx-btn-lg" href="/">
              Começar grátis
            </Link>
            <p className="sx-close-trust">
              <span>
                <i />
                Sem cartão de crédito
              </span>
              <span>
                <i />
                Cancele quando quiser
              </span>
              <span>
                <i />7 dias de garantia no Pro
              </span>
            </p>
          </div>
        </section>
      </main>

      <footer className="sx-foot">
        <div className="sx-wrap">
          <div className="sx-foot-top">
            <div>
              <Link href="/vendas" className="sx-brand">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/semiolab-fox.png" alt="" width="28" height="28" />
                SemioLab
              </Link>
              <p>
                O SemioLab é uma ferramenta de estudo para estudantes e profissionais de saúde. Os
                casos são simulações e não constituem orientação diagnóstica ou terapêutica. Imagens
                clínicas e gravações de ausculta têm origem e licença listadas no app.
              </p>
            </div>
            <nav aria-label="Legal">
              <Link href="/termos-de-uso">Termos de uso</Link>
              <Link href="/privacidade">Privacidade</Link>
              <Link href="/reembolso">Reembolso</Link>
              <Link href="/aviso-medico">Aviso médico</Link>
              <Link href="/contato">Contato</Link>
            </nav>
          </div>
          <p className="sx-foot-bottom">© {new Date().getFullYear()} SemioLab</p>
        </div>
      </footer>

      <MobileCta trialDays={TRIAL_DAYS} />
    </div>
  );
}
