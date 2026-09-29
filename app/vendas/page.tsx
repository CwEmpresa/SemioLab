import type { Metadata } from "next";
import Link from "next/link";
import { Archivo } from "next/font/google";
import { Check, Minus, ShieldCheck } from "lucide-react";
import { TIER_LIMITS, TRIAL_DAYS } from "@/lib/access-tier";
import { CAKTO_CHECKOUT_URLS } from "@/lib/pro";
import Bedside from "./bedside";
import Statement from "./statement";
import AuscultationDemo from "./auscultation-demo";
import Features, { type Feature } from "./features";
import Pricing from "./pricing";
import Faq from "./faq";
import MobileCta from "./mobile-cta";
import "./screens.css";
import "./sales.css";

/* Archivo com eixo de largura: os títulos usam a versão condensada e
   pesada, o corpo continua em Manrope como no app. */
const display = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-display",
  display: "swap",
});

const TITLE = "SemioLab — Erre aqui. Não no paciente.";
const DESCRIPTION =
  "Atenda pacientes virtuais que não entregam o diagnóstico: pergunte, ausculte sons reais, peça exames e veja onde seu raciocínio falhou. Comece grátis.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "pt_BR" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const STATEMENT =
  "Ler sobre um sopro não ensina a reconhecer um. Caso pronto já entrega a pergunta. Nota de prova não mostra se você conduz uma consulta. No SemioLab você pergunta, ausculta, pede o exame e erra antes de errar com alguém na frente.";
const STATEMENT_ACCENT = STATEMENT.split(" ").indexOf("No");

/* Uma sequência real: é a ordem de um atendimento no app. */
const STEPS = [
  {
    tone: "hr",
    title: "Anamnese",
    body: "A paciente conta do jeito dela, com as palavras dela. Você decide o que perguntar, e o que não perguntar fica no escuro.",
  },
  {
    tone: "spo2",
    title: "Exame físico",
    body: "Peça os sinais, examine e ausculte. Os sons são gravações reais, não descrições.",
  },
  {
    tone: "fr",
    title: "Exames",
    body: "Radiografia, ECG, laboratório. O laudo chega dentro da conversa, com a imagem.",
  },
  {
    tone: "err",
    title: "Hipótese e correção",
    body: "Você crava o diagnóstico e vê as pistas que deixou passar. Cada erro vira flashcard.",
  },
] as const;

const FEATURES: Feature[] = [
  {
    screen: "patient",
    name: "Paciente IA",
    line: "Atendimento completo, por texto ou por voz.",
    free: "1 por semana no grátis",
  },
  {
    screen: "auscultation",
    name: "Laboratório de ausculta",
    line: "Sons cardíacos e pulmonares reais, com quiz.",
    free: null,
  },
  {
    screen: "quiz",
    name: "Quiz e simulados",
    line: "Com o porquê de cada alternativa.",
    free: "Quiz no grátis",
  },
  {
    screen: "flashcards",
    name: "Flashcards",
    line: "Revisão espaçada montada com os seus erros.",
    free: `${TIER_LIMITS.free.flashcardsPerDay} por dia no grátis`,
  },
  {
    screen: "atlas",
    name: "Atlas de TC 3D",
    line: "Cortes navegáveis, legendados em português.",
    free: "Incluído no grátis",
  },
  {
    screen: "progress",
    name: "Domínio por sistema",
    line: "Onde você está fraco, em números.",
    free: "Incluído no grátis",
  },
];

/* Comparação honesta: o que cada forma de estudo faz e não faz. */
const COMPARE: { row: string; book: 0 | 1 | 2; bank: 0 | 1 | 2 }[] = [
  { row: "Você formula a pergunta, sem alternativas na tela", book: 0, bank: 0 },
  { row: "O paciente responde do jeito dele, não do livro", book: 0, bank: 0 },
  { row: "Ouve o som real da ausculta", book: 0, bank: 0 },
  { row: "Mostra a pista que você deixou passar", book: 0, bank: 1 },
  { row: "Revisa sozinho o que você errou", book: 0, bank: 1 },
  { row: "Cabe no intervalo entre duas aulas", book: 1, bank: 2 },
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
    q: "Como funciona o cancelamento?",
    a: "Pela própria assinatura, quando quiser. O Pro vale até o fim do período pago e depois a conta volta ao gratuito, com todo o histórico.",
  },
  {
    q: "Funciona no celular?",
    a: "Foi desenhado para o celular primeiro e pode ser instalado na tela de início como aplicativo. No computador funciona igual, pelo navegador.",
  },
];

function Mark({ v }: { v: 0 | 1 | 2 }) {
  if (v === 2) return <Check className="sx-yes" aria-label="Sim" />;
  if (v === 1) return <span className="sx-part">Em parte</span>;
  return <Minus className="sx-no" aria-label="Não" />;
}

export default function SalesPage() {
  return (
    <div className={`sx ${display.variable}`}>
      <a className="sx-skip" href="#conteudo">
        Pular para o conteúdo
      </a>
      <header className="sx-nav">
        <div className="sx-wrap">
          <Link href="/vendas" className="sx-brand" aria-label="SemioLab, início">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/semiolab-fox.png" alt="" width="26" height="26" />
            SemioLab
          </Link>
          <nav aria-label="Seções">
            <a href="#como-funciona">Como funciona</a>
            <a href="#ausculta">Ausculta</a>
            <a href="#recursos">Recursos</a>
            <a href="#planos">Planos</a>
          </nav>
          <Link className="sx-nav-login" href="/">
            Entrar
          </Link>
          <Link className="sx-btn sx-btn-sm" href="/">
            Começar grátis
          </Link>
        </div>
      </header>

      <main id="conteudo">
        {/* ─── Hero: a consulta jogável ─────────────────────────── */}
        <section className="sx-hero">
          <div className="sx-wrap sx-hero-grid">
            <div className="sx-hero-copy">
              <h1>
                <span>Erre aqui.</span>
                <span>Não no paciente.</span>
              </h1>
              <p className="sx-hero-sub">
                Pacientes virtuais que não entregam o diagnóstico. Você pergunta, ausculta, pede o
                exame e decide. No fim, vê a pista que deixou passar.
              </p>
              <div className="sx-hero-actions">
                <Link className="sx-btn sx-btn-lg" href="/">
                  Começar grátis
                </Link>
                <p>
                  {TRIAL_DAYS} dias de Pro incluídos.
                  <br />
                  Sem cartão de crédito.
                </p>
              </div>
              <p className="sx-hero-try">
                <span aria-hidden="true" className="sx-hero-try-dot" />
                A Helena já está na sala. Atenda agora, sem criar conta.
              </p>
            </div>
            <Bedside />
          </div>
        </section>

        {/* ─── O problema ───────────────────────────────────────── */}
        <section className="sx-sec sx-paper sx-statement-sec">
          <div className="sx-wrap">
            <Statement text={STATEMENT} accentFrom={STATEMENT_ACCENT} />
          </div>
        </section>

        {/* ─── Como funciona ────────────────────────────────────── */}
        <section className="sx-sec sx-paper sx-steps-sec" id="como-funciona">
          <div className="sx-wrap">
            <div className="sx-head">
              <h2>Uma consulta inteira, do primeiro sintoma à correção.</h2>
              <p>É a mesma ordem do atendimento de verdade. Nenhuma etapa vem pronta.</p>
            </div>
            <ol className="sx-steps">
              {STEPS.map((s, i) => (
                <li key={s.title} className={`sx-step sx-tone-${s.tone}`}>
                  <span className="sx-step-n">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ─── Ausculta ─────────────────────────────────────────── */}
        <section className="sx-sec sx-ink sx-listen" id="ausculta">
          <div className="sx-wrap sx-listen-grid">
            <div className="sx-listen-copy">
              <h2>Ouça a diferença.</h2>
              <p>
                Duas gravações reais de coração. Uma sem sopro, outra com sopro holossistólico. No
                app são dezenas de sons cardíacos e pulmonares, com quiz de reconhecimento.
              </p>
            </div>
            <AuscultationDemo />
          </div>
        </section>

        {/* ─── Recursos ─────────────────────────────────────────── */}
        <section className="sx-sec sx-paper" id="recursos">
          <div className="sx-wrap">
            <div className="sx-head">
              <h2>Tudo o que a semiologia pede, no bolso.</h2>
              <p>Quiz, atendimento e simulado somam na mesma nota por sistema. A consulta pesa mais.</p>
            </div>
            <Features items={FEATURES} />
          </div>
        </section>

        {/* ─── Comparação ───────────────────────────────────────── */}
        <section className="sx-sec sx-paper sx-compare-sec">
          <div className="sx-wrap">
            <div className="sx-head">
              <h2>Livro ensina o que é. Atender ensina a achar.</h2>
            </div>
            <div className="sx-compare-scroll">
              <table className="sx-compare">
                <thead>
                  <tr>
                    <th scope="col">
                      <span className="sx-visually-hidden">Critério</span>
                    </th>
                    <th scope="col">Livro e resumo</th>
                    <th scope="col">Banco de questões</th>
                    <th scope="col" className="sx-compare-us">
                      SemioLab
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE.map((c) => (
                    <tr key={c.row}>
                      <th scope="row">{c.row}</th>
                      <td>
                        <Mark v={c.book} />
                      </td>
                      <td>
                        <Mark v={c.bank} />
                      </td>
                      <td className="sx-compare-us">
                        <Mark v={2} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ─── Planos ───────────────────────────────────────────── */}
        <section className="sx-sec sx-ink sx-plans-sec" id="planos">
          <div className="sx-wrap">
            <div className="sx-head">
              <h2>Comece grátis. Assine quando o limite incomodar.</h2>
              <p>
                Toda conta nova ganha {TRIAL_DAYS} dias de Pro. Depois, fica no gratuito até você
                decidir.
              </p>
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
            <div className="sx-guarantee">
              <ShieldCheck aria-hidden="true" />
              <p>
                <b>7 dias para desistir.</b> Assinou e não era o que esperava? Peça o reembolso
                integral em até 7 dias da compra. <Link href="/reembolso">Ver política de reembolso</Link>
              </p>
            </div>
            <p className="sx-plans-note">Pagamento processado pela Cakto. Cancele quando quiser.</p>
          </div>
        </section>

        {/* ─── Dúvidas ──────────────────────────────────────────── */}
        <section className="sx-sec sx-paper sx-faq-sec" id="duvidas">
          <div className="sx-wrap sx-faq-grid">
            <div className="sx-head">
              <h2>Perguntas frequentes.</h2>
              <p>
                Outra dúvida? <Link href="/contato">Fale com a gente</Link>.
              </p>
            </div>
            <Faq items={FAQ} />
          </div>
        </section>

        {/* ─── Fechamento ───────────────────────────────────────── */}
        <section className="sx-close">
          <div className="sx-wrap">
            <h2>
              <span>Seu próximo paciente</span>
              <span>já está na sala.</span>
            </h2>
            <div className="sx-close-actions">
              <Link className="sx-btn sx-btn-lg" href="/">
                Começar grátis
              </Link>
              <p>{TRIAL_DAYS} dias de Pro incluídos. Sem cartão.</p>
            </div>
          </div>
          <svg className="sx-close-trace" viewBox="0 0 1200 120" preserveAspectRatio="none" aria-hidden="true">
            <path pathLength={1} d="M0 80 L520 80 L540 80 Q552 64 564 80 L580 80 L586 90 L596 16 L606 104 L612 80 L636 80 Q654 56 672 80 L1200 80" />
          </svg>
        </section>
      </main>

      <footer className="sx-foot">
        <div className="sx-wrap">
          <p className="sx-foot-note">
            O SemioLab é uma ferramenta de estudo para estudantes e profissionais de saúde. Os casos
            são simulações e não constituem orientação diagnóstica ou terapêutica. Imagens clínicas e
            gravações de ausculta têm origem e licença listadas no app.
          </p>
          <div className="sx-foot-row">
            <span>© {new Date().getFullYear()} SemioLab</span>
            <nav aria-label="Legal">
              <Link href="/termos-de-uso">Termos de uso</Link>
              <Link href="/privacidade">Privacidade</Link>
              <Link href="/reembolso">Reembolso</Link>
              <Link href="/aviso-medico">Aviso médico</Link>
              <Link href="/contato">Contato</Link>
            </nav>
          </div>
        </div>
      </footer>

      <MobileCta trialDays={TRIAL_DAYS} />
    </div>
  );
}
