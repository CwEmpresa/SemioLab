import type { ReactNode } from "react";

/**
 * Carcaça de iPhone com as proporções reais do aparelho (iPhone 15/16
 * Pro): tela de 393×852pt com raio de 55pt, bezel uniforme de 2.4mm
 * sobre 70.6mm de largura, Dynamic Island de 125×36pt a 11pt do topo,
 * botões de volume e ação à esquerda e o lateral à direita.
 *
 * Tudo é derivado de --phone-w em landing.css, então o aparelho escala
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
      <div className="lp-iphone-band" aria-hidden="true" />
      <div className="lp-iphone-screen">
        {children}
        <span className="lp-iphone-island" aria-hidden="true" />
        <span className="lp-iphone-glare" aria-hidden="true" />
        <span className="lp-iphone-indicator" aria-hidden="true" />
      </div>
    </div>
  );
}
