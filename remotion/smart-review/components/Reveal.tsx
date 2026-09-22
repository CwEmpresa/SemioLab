import type { CSSProperties, ReactNode } from "react";
import { Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { EASE_OUT } from "../theme";

type RevealProps = {
  name: string;
  /** Início da entrada, em frames relativos à cena. */
  delay?: number;
  /** Deslocamento vertical inicial, em px da composição. */
  rise?: number;
  style?: CSSProperties;
  children: ReactNode;
};

/** Entrada padrão (opacidade + leve subida), dirigida pelo frame atual. */
export function Reveal({ name, delay = 0, rise = 28, style, children }: RevealProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Interactive.Div
      name={name}
      style={{
        ...style,
        opacity: interpolate(frame, [delay, delay + 0.6 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(...EASE_OUT),
        }),
        translate: interpolate(frame, [delay, delay + 0.7 * fps], [`0px ${rise}px`, "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(...EASE_OUT),
        }),
      }}
    >
      {children}
    </Interactive.Div>
  );
}
