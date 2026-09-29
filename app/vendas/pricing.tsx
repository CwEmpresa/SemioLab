"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, Minus } from "lucide-react";

type Billing = "annual" | "monthly";

const PRICE = {
  annual: { month: "15,90", day: "0,52", bill: "R$ 190,80 cobrados uma vez por ano." },
  monthly: { month: "19,90", day: "0,66", bill: "Cobrança mensal. Cancele quando quiser." },
} as const;

/**
 * Dois planos lado a lado e a escolha de cobrança acima deles. O anual
 * vem marcado: é o que a maioria deve assinar, e o preço por dia deixa
 * a comparação concreta.
 */
export default function Pricing({
  free,
  pro,
  checkout,
}: {
  checkout: Record<Billing, string>;
  free: { exams: number; flashcards: number };
  pro: { consultations: number; simulados: number };
}) {
  const [billing, setBilling] = useState<Billing>("annual");
  const p = PRICE[billing];

  return (
    <div className="sx-pricing">
      <div className="sx-billing" role="radiogroup" aria-label="Forma de cobrança">
        <button type="button" role="radio" aria-checked={billing === "annual"} onClick={() => setBilling("annual")}>
          Anual <em>economize 20%</em>
        </button>
        <button type="button" role="radio" aria-checked={billing === "monthly"} onClick={() => setBilling("monthly")}>
          Mensal
        </button>
      </div>

      <div className="sx-plans">
        <article className="sx-plan">
          <h3>Gratuito</h3>
          <p className="sx-plan-price">
            <b>R$ 0</b>
          </p>
          <p className="sx-plan-bill">Para sempre, sem cartão.</p>
          <ul>
            <li>
              <Check aria-hidden="true" />1 atendimento por semana
            </li>
            <li>
              <Check aria-hidden="true" />
              {free.exams} exames por atendimento
            </li>
            <li>
              <Check aria-hidden="true" />
              {free.flashcards} flashcards por dia
            </li>
            <li>
              <Check aria-hidden="true" />
              Atlas de TC 3D e Semiologia
            </li>
            <li className="off">
              <Minus aria-hidden="true" />
              Simulados, ausculta e voz
            </li>
          </ul>
          <Link className="sx-btn sx-btn-line" href="/">
            Criar conta grátis
          </Link>
        </article>

        <article className="sx-plan sx-plan-pro">
          <h3>
            Pro <span>{billing === "annual" ? "anual" : "mensal"}</span>
          </h3>
          <p className="sx-plan-price">
            {billing === "monthly" ? <s>R$ 29,90</s> : null}
            <small>R$</small>
            <b>{p.month}</b>
            <small>/mês</small>
          </p>
          <p className="sx-plan-bill">
            {p.bill} <strong>R$ {p.day} por dia.</strong>
          </p>
          <ul>
            <li>
              <Check aria-hidden="true" />
              {pro.consultations} atendimentos por dia
            </li>
            <li>
              <Check aria-hidden="true" />
              Exames ilimitados
            </li>
            <li>
              <Check aria-hidden="true" />
              Pergunte e ouça por voz
            </li>
            <li>
              <Check aria-hidden="true" />
              Laboratório de ausculta
            </li>
            <li>
              <Check aria-hidden="true" />
              {pro.simulados} simulados por dia
            </li>
            <li>
              <Check aria-hidden="true" />
              Flashcards sem limite
            </li>
          </ul>
          <a className="sx-btn" href={checkout[billing]} target="_blank" rel="noopener noreferrer">
            Assinar o Pro {billing === "annual" ? "anual" : "mensal"}
          </a>
        </article>
      </div>
    </div>
  );
}
