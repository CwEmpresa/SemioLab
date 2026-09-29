"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import IPhone from "./iphone";
import { SCREENS, type ScreenId } from "./app-screens";

export type Feature = {
  screen: ScreenId;
  name: string;
  line: string;
  /** O que o plano gratuito dá; `null` quando é só do Pro. */
  free: string | null;
};

/**
 * Índice de recursos com o aparelho ao lado: passar o mouse, focar ou
 * tocar numa linha troca a tela dentro do iPhone. Cada linha diz o que
 * fica no gratuito, que é a pergunta que decide a assinatura.
 */
export default function Features({ items }: { items: Feature[] }) {
  const [active, setActive] = useState(0);
  const reduced = useReducedMotion();
  const Screen = SCREENS[items[active].screen];

  return (
    <div className="sx-feat">
      <div className="sx-feat-device" aria-hidden="true">
        <IPhone className="sx-iphone-feat">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={items[active].screen}
              className="sx-feat-screen"
              initial={reduced ? false : { opacity: 0, scale: 1.03 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            >
              <Screen />
            </motion.div>
          </AnimatePresence>
        </IPhone>
      </div>

      <ul className="sx-feat-list">
        {items.map((item, i) => (
          <li key={item.screen}>
            <button
              type="button"
              className={i === active ? "on" : ""}
              aria-pressed={i === active}
              onMouseEnter={() => setActive(i)}
              onFocus={() => setActive(i)}
              onClick={() => setActive(i)}
            >
              <span className="sx-feat-name">{item.name}</span>
              <span className="sx-feat-line">{item.line}</span>
              <span className={`sx-feat-tier ${item.free ? "" : "pro"}`}>{item.free ?? "Só no Pro"}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
