import type { Metadata } from "next";
import Link from "next/link";
import { Check, Minus, Sparkles } from "lucide-react";
import { CAKTO_CHECKOUT_URLS } from "@/lib/pro";
import { TIER_LIMITS, TRIAL_DAYS } from "@/lib/access-tier";
import Hero from "./hero";
import Statement from "./statement";
import ConsultStory from "./consult-story";
import Bento from "./bento";
import AuscultationDemo from "./auscultation-demo";
import CloserLook from "./closer-look";
import Testimonials from "./testimonials";
import Faq from "./faq";
import Reveal from "./reveal";
import IPhone from "./iphone";
import { SCREENS } from "./app-screens";
import "./screens.css";
import "./landing.css";

const TITLE = "SemioLab — Raciocínio clínico, treinado todo dia";
const DESCRIPTION =
  "Pacientes virtuais que não entregam o diagnóstico, ausculta com sons reais, simulados e flashcards dos seus erros. Comece grátis.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", locale: "pt_BR" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const STATEMENT =
  "Ler sobre um sopro não ensina a reconhecer um. Caso pronto já entrega a pergunta. Nota de prova não mostra se você conduz uma consulta. No SemioLab você pergunta, ausculta, pede o exame e erra antes de errar com alguém na frente.";
// Índice da palavra onde começa a frase de resposta (destacada).
const STATEMENT_ACCENT = STATEMENT.split(" ").indexOf("No");

const FAQ = [
  {
    q: "Preciso de cartão para começar?",
    a: `Não. Você cria a conta e recebe ${TRIAL_DAYS} dias de Pro. Quando o período acaba, a conta continua no plano gratuito. Nada é cobrado automaticamente e nada é apagado.`,
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

const PRO_FEATURES = [
  `${TIER_LIMITS.pro.consultations} atendimentos por dia`,
  "Exames ilimitados",
  "Pergunte e ouça por voz",
  `${TIER_LIMITS.pro.simuladosPerDay} simulados por dia`,
  "Laboratório de ausculta",
  "Flashcards sem limite",
];

/* Contas criadas no app em 28/10/2026: 459. Arredondado para baixo. */
const STUDENTS = 450;

export default function SalesPage() {
  const Home = SCREENS.home;

  return (
    <div className="ap">
      <header className="ap-nav">
        <div className="ap-wrap">
          <Link href="/vendas" className="ap-brand" aria-label="SemioLab, início">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/semiolab-fox.png" alt="" width="28" height="28" />
            SemioLab
          </Link>
          <nav aria-label="Seções">
            <a href="#consulta">Consulta</a>
            <a href="#recursos">Recursos</a>
            <a href="#ausculta">Ausculta</a>
            <a href="#planos">Planos</a>
          </nav>
          <Link className="ap-btn ap-btn-sm" href="/">
            Começar grátis
          </Link>
        </div>
      </header>

      <main>
        <Hero trialDays={TRIAL_DAYS} students={STUDENTS} />

        {/* ─── O problema ─────────────────────────────────────── */}
        <section className="ap-sec ap-light ap-statement-sec">
          <div className="ap-wrap ap-narrow">
            <Statement text={STATEMENT} accentFrom={STATEMENT_ACCENT} />
          </div>
        </section>

        {/* ─── A consulta, contada pelo scroll ────────────────── */}
        <ConsultStory />

        {/* ─── Destaques ──────────────────────────────────────── */}
        <section className="ap-sec ap-light" id="recursos">
          <div className="ap-wrap">
            <Reveal className="ap-head">
              <h2>Tudo o que a semiologia pede.</h2>
              <p>Num só lugar, no seu bolso.</p>
            </Reveal>
            <Bento proConsultations={TIER_LIMITS.pro.consultations} />
          </div>
        </section>

        {/* ─── Ausculta interativa ────────────────────────────── */}
        <section className="ap-sec ap-dark ap-listen" id="ausculta">
          <div className="ap-wrap ap-listen-grid">
            <Reveal className="ap-listen-copy">
              <p className="ap-kicker">Laboratório de ausculta</p>
              <h2>Ouça a diferença.</h2>
              <p>
                Duas gravações reais de coração. Uma sem sopro, outra com sopro holossistólico. No
                app são dezenas, cardíacas e pulmonares, com quiz de reconhecimento.
              </p>
            </Reveal>
            <Reveal delay={0.1}>
              <AuscultationDemo />
            </Reveal>
          </div>
        </section>

        {/* ─── Por dentro ─────────────────────────────────────── */}
        <section className="ap-sec ap-light ap-look-sec">
          <div className="ap-wrap">
            <Reveal className="ap-head">
              <h2>Veja por dentro.</h2>
              <p>Sete telas. Um progresso só.</p>
            </Reveal>
          </div>
          <CloserLook />
        </section>

        {/* ─── Depoimentos ────────────────────────────────────── */}
        <section className="ap-sec ap-dark" id="depoimentos">
          <div className="ap-wrap">
            <Reveal className="ap-head">
              <h2>Quem treina, conta.</h2>
            </Reveal>
            <Testimonials />
          </div>
        </section>

        {/* ─── Planos — o único lugar com preço ───────────────── */}
        <section className="ap-sec ap-light" id="planos">
          <div className="ap-wrap">
            <Reveal className="ap-head">
              <h2>Comece grátis.</h2>
              <p>Assine quando o limite começar a incomodar.</p>
            </Reveal>

            <div className="ap-plans">
              <Reveal className="ap-plan ap-plan-free" delay={0}>
                <p className="ap-plan-name">Gratuito</p>
                <p className="ap-price">
                  <b>R$ 0</b>
                </p>
                <p className="ap-plan-bill">Para sempre. Sem cartão.</p>
                <Link className="ap-btn ap-btn-ghost" href="/">
                  Criar conta
                </Link>
                <ul>
                  <li>
                    <Check aria-hidden="true" />1 atendimento por semana
                  </li>
                  <li>
                    <Check aria-hidden="true" />
                    {TIER_LIMITS.free.examsPerConsultation} exames por atendimento
                  </li>
                  <li>
                    <Check aria-hidden="true" />
                    {TIER_LIMITS.free.flashcardsPerDay} flashcards por dia
                  </li>
                  <li className="off">
                    <Minus aria-hidden="true" />
                    Simulados, ausculta e voz
                  </li>
                </ul>
              </Reveal>

              <Reveal className="ap-plan ap-plan-monthly" delay={0.08}>
                <p className="ap-plan-name">Pro mensal</p>
                <p className="ap-price">
                  <small>R$</small>
                  <b>29,90</b>
                  <small>/mês</small>
                </p>
                <p className="ap-plan-bill">Cobrança mensal. Cancele quando quiser.</p>
                <a
                  className="ap-btn ap-btn-dark"
                  href={CAKTO_CHECKOUT_URLS.monthly}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Assinar mensal
                </a>
                <ul>
                  {PRO_FEATURES.map((f) => (
                    <li key={f}>
                      <Check aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
              </Reveal>

              <Reveal className="ap-plan ap-plan-pick" delay={0.16}>
                <p className="ap-plan-flag">
                  <Sparkles aria-hidden="true" />
                  Mais escolhido
                </p>
                <p className="ap-plan-name">Pro anual</p>
                <p className="ap-price">
                  <small>R$</small>
                  <b>16,66</b>
                  <small>/mês</small>
                </p>
                <p className="ap-plan-bill">R$ 199,90 cobrados uma vez por ano.</p>
                {/* 12 × R$ 29,90 = R$ 358,80 no mensal; o anual sai R$ 158,90 mais barato. */}
                <p className="ap-plan-save">Economize R$ 158,90 no ano</p>
                <a className="ap-btn" href={CAKTO_CHECKOUT_URLS.annual} target="_blank" rel="noopener noreferrer">
                  Assinar anual
                </a>
                <ul>
                  {PRO_FEATURES.map((f) => (
                    <li key={f}>
                      <Check aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
              </Reveal>
            </div>
            <p className="ap-plans-note">Pagamento processado pela Cakto. Cancele a qualquer momento.</p>
          </div>
        </section>

        {/* ─── Dúvidas ────────────────────────────────────────── */}
        <section className="ap-sec ap-light ap-faq-sec" id="duvidas">
          <div className="ap-wrap ap-narrow">
            <Reveal className="ap-head">
              <h2>Perguntas frequentes.</h2>
            </Reveal>
            <Faq items={FAQ} />
          </div>
        </section>

        {/* ─── Fechamento ─────────────────────────────────────── */}
        <section className="ap-close">
          <div className="ap-wrap">
            <Reveal className="ap-head">
              <h2>Seu próximo paciente está esperando.</h2>
              <p>
                Crie a conta e comece o primeiro atendimento agora. {TRIAL_DAYS} dias de Pro incluídos.
              </p>
              <div className="ap-close-actions">
                <Link className="ap-btn ap-btn-lg" href="/">
                  Começar grátis
                </Link>
              </div>
            </Reveal>
          </div>
          <Reveal className="ap-close-phone" y={120}>
            <IPhone className="ap-iphone-close">
              <Home />
            </IPhone>
          </Reveal>
        </section>
      </main>

      <footer className="ap-foot">
        <div className="ap-wrap">
          <p className="ap-foot-note">
            O SemioLab é uma ferramenta de estudo para estudantes e profissionais de saúde. Os casos
            são simulações e não constituem orientação diagnóstica ou terapêutica. Imagens clínicas e
            gravações de ausculta têm origem e licença listadas no app.
          </p>
          <div className="ap-foot-row">
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
    </div>
  );
}
