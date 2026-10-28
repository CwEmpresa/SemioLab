"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import IPhone from "./iphone";
import { SCREENS, type ScreenId } from "./app-screens";

const ITEMS: { screen: ScreenId; name: string; line: string }[] = [
  { screen: "home", name: "Início", line: "A missão do dia e seus atalhos." },
  { screen: "patient", name: "Paciente IA", line: "Anamnese, exames e hipótese." },
  { screen: "auscultation", name: "Laboratório de ausculta", line: "Sons reais, com a onda na tela." },
  { screen: "quiz", name: "Quiz e simulados", line: "Com o porquê de cada resposta." },
  { screen: "atlas", name: "Atlas de TC 3D", line: "Cortes navegáveis em português." },
  { screen: "flashcards", name: "Flashcards", line: "Revisão espaçada do que você errou." },
  { screen: "progress", name: "Progresso", line: "Nível, domínio e ranking." },
];

/**
 * Faixa horizontal com rolagem nativa e snap. Nada de carrossel com
 * autoavanço: a pessoa arrasta no próprio ritmo, e as setas só existem
 * como atalho no desktop.
 */
export default function CloserLook() {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const update = () =>
      setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const move = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".ap-look-item");
    const step = card ? card.offsetWidth + 28 : el.clientWidth * 0.8;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  return (
    <div className="ap-look">
      <div className="ap-look-track" ref={track} tabIndex={0} aria-label="Telas do SemioLab">
        {ITEMS.map((item) => {
          const Screen = SCREENS[item.screen];
          return (
            <figure className="ap-look-item" key={item.screen}>
              <IPhone className="ap-iphone-look">
                <Screen />
              </IPhone>
              <figcaption>
                <b>{item.name}</b>
                <span>{item.line}</span>
              </figcaption>
            </figure>
          );
        })}
      </div>
      <div className="ap-look-nav">
        <button type="button" onClick={() => move(-1)} disabled={edge.start} aria-label="Telas anteriores">
          <ChevronLeft />
        </button>
        <button type="button" onClick={() => move(1)} disabled={edge.end} aria-label="Próximas telas">
          <ChevronRight />
        </button>
      </div>
    </div>
  );
}
