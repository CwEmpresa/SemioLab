"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Barra fixa no rodapé do celular. Aparece depois que o hero sai da
 * tela e some quando o fechamento da página, que tem o próprio botão,
 * entra no viewport.
 */
export default function MobileCta({ trialDays }: { trialDays: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const hero = document.querySelector(".sx-hero");
    const close = document.querySelector(".sx-close");
    if (!hero || !close) return;
    const state = { pastHero: false, atClose: false };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.target === hero) state.pastHero = !e.isIntersecting && e.boundingClientRect.top < 0;
        if (e.target === close) state.atClose = e.isIntersecting;
      });
      setShow(state.pastHero && !state.atClose);
    });
    io.observe(hero);
    io.observe(close);
    return () => io.disconnect();
  }, []);

  return (
    <div className={`sx-mcta ${show ? "on" : ""}`} aria-hidden={!show}>
      <span>
        <b>Comece grátis</b>
        <small>{trialDays} dias de Pro, sem cartão</small>
      </span>
      <Link className="sx-btn" href="/" tabIndex={show ? 0 : -1}>
        Criar conta
      </Link>
    </div>
  );
}
