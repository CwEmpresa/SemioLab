import Link from "next/link";
import { Check, X } from "lucide-react";

type Item = { text: string; on: boolean };

/**
 * Três cartões: gratuito, Pro anual em destaque e Pro mensal. O anual
 * leva a faixa porque é o menor preço por mês, e o mensal mostra o preço
 * cheio riscado para a comparação ficar evidente.
 */
export default function Pricing({
  checkout,
  free,
  pro,
}: {
  checkout: { annual: string; monthly: string };
  free: { exams: number; flashcards: number };
  pro: { consultations: number; simulados: number };
}) {
  const proItems: Item[] = [
    { text: `${pro.consultations} atendimentos por dia`, on: true },
    { text: "Exames ilimitados", on: true },
    { text: "Laboratório de ausculta", on: true },
    { text: `${pro.simulados} simulados por dia`, on: true },
    { text: "Flashcards sem limite", on: true },
    { text: "Pergunte e ouça por voz", on: true },
  ];
  const freeItems: Item[] = [
    { text: "1 atendimento por semana", on: true },
    { text: `${free.exams} exames por atendimento`, on: true },
    { text: `${free.flashcards} flashcards por dia`, on: true },
    { text: "Atlas de TC 3D e Semiologia", on: true },
    { text: "Laboratório de ausculta", on: false },
    { text: "Simulados", on: false },
    { text: "Conversa por voz", on: false },
  ];

  const list = (items: Item[]) => (
    <ul>
      {items.map((i) => (
        <li key={i.text} className={i.on ? "" : "off"}>
          {i.on ? <Check aria-hidden="true" /> : <X aria-hidden="true" />}
          <span>
            {i.on ? null : <span className="sx-visually-hidden">Não incluso: </span>}
            {i.text}
          </span>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="sx-plans">
      <article className="sx-plan">
        <h3>Gratuito</h3>
        <p className="sx-plan-price">
          <b>Grátis</b>
        </p>
        <p className="sx-plan-for">Para conhecer o SemioLab e criar o hábito de atender.</p>
        {list(freeItems)}
        <Link className="sx-btn sx-btn-ghost" href="/">
          Começar grátis
        </Link>
      </article>

      <article className="sx-plan sx-plan-pick">
        <p className="sx-plan-flag">Melhor preço</p>
        <h3>Pro anual</h3>
        <p className="sx-plan-price">
          <b>
            R$ 15,<small>90</small>
          </b>
          <span>
            por mês
            <br />
            cobrança anual
          </span>
        </p>
        <p className="sx-plan-for">R$ 190,80 por ano. Menos de R$ 0,53 por dia.</p>
        {list(proItems)}
        <a className="sx-btn" href={checkout.annual} target="_blank" rel="noopener noreferrer">
          Assinar Pro anual
        </a>
      </article>

      <article className="sx-plan">
        <h3>Pro mensal</h3>
        <p className="sx-plan-price">
          <b>
            R$ 19,<small>90</small>
          </b>
          <span>
            <s>R$ 29,90</s>
            por mês
          </span>
        </p>
        <p className="sx-plan-for">Todo o Pro, sem compromisso de um ano. Cancele quando quiser.</p>
        {list(proItems)}
        <a className="sx-btn sx-btn-ghost" href={checkout.monthly} target="_blank" rel="noopener noreferrer">
          Assinar Pro mensal
        </a>
      </article>
    </div>
  );
}
