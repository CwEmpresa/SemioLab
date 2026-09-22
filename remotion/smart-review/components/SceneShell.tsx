import type { ReactNode } from "react";
import { AbsoluteFill } from "remotion";
import { colors, type } from "../theme";
import { useLayout } from "./use-layout";

type SceneShellProps = {
  name: string;
  /** Rótulo curto no topo da cena (ex.: "QUESTÃO 4"). */
  eyebrow: string;
  /** Texto à direita do topo (ex.: "Erro 2 de 5"). */
  meta?: string;
  children: ReactNode;
};

/** Moldura comum das cenas: fundo, área segura e cabeçalho discreto. */
export function SceneShell({ name, eyebrow, meta, children }: SceneShellProps) {
  const { u, padX, padY } = useLayout();
  return (
    <AbsoluteFill
      name={name}
      style={{
        background: `radial-gradient(circle at 88% 0%, #12403d 0%, transparent 42%), linear-gradient(160deg, ${colors.bg}, ${colors.bgDeep})`,
        color: colors.text,
        padding: `${padY}px ${padX}px`,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24 * u,
          fontSize: type.eyebrow * u,
          fontWeight: 800,
          letterSpacing: "0.16em",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 14 * u, color: colors.mint }}>
          <i style={{ width: 12 * u, height: 12 * u, borderRadius: 99, background: colors.mint }} />
          {eyebrow}
        </span>
        {meta ? <span style={{ color: colors.muted, letterSpacing: "0.08em" }}>{meta}</span> : null}
      </header>
      <div style={{ position: "relative", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", minHeight: 0 }}>
        {children}
      </div>
    </AbsoluteFill>
  );
}
