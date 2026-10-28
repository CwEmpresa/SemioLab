import type { ReactNode } from "react";

/**
 * Carcaça de iPhone 15/16 Pro em camadas, como o aparelho real: aro de
 * titânio fino (com brilho nas quinas arredondadas), moldura preta de
 * vidro, tela de 393×852pt, Dynamic Island de 125×36pt a 11pt do topo,
 * botões com volume próprio e um reflexo de vidro por cima de tudo.
 *
 * Tudo é derivado de --phone-w em screens.css, então o aparelho escala
 * sem perder proporção.
 */
export default function IPhone({
  children,
  className = "",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`lp-iphone ${className}`} style={style}>
      <span className="lp-iphone-btn lp-iphone-silent" aria-hidden="true" />
      <span className="lp-iphone-btn lp-iphone-volup" aria-hidden="true" />
      <span className="lp-iphone-btn lp-iphone-voldown" aria-hidden="true" />
      <span className="lp-iphone-btn lp-iphone-power" aria-hidden="true" />
      <span className="lp-iphone-antenna" aria-hidden="true" />
      <div className="lp-iphone-body">
        <div className="lp-iphone-screen">
          {children}
          <span className="lp-iphone-island" aria-hidden="true" />
          <span className="lp-iphone-indicator" aria-hidden="true" />
        </div>
      </div>
      <span className="lp-iphone-glare" aria-hidden="true" />
    </div>
  );
}
