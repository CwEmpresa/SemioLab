import { colors, type } from "../theme";
import { useLayout } from "./use-layout";

type AnswerCardProps = {
  label: string;
  letter: string | null;
  text: string | null;
  tone: "wrong" | "right";
};

/** Cartão de alternativa (a marcada pelo aluno ou a correta). */
export function AnswerCard({ label, letter, text, tone }: AnswerCardProps) {
  const { u } = useLayout();
  const accent = tone === "right" ? colors.mint : colors.wrong;
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        alignItems: "flex-start",
        gap: 24 * u,
        padding: `${24 * u}px ${28 * u}px`,
        borderRadius: 24 * u,
        background: colors.surface,
        border: `${2 * u}px solid ${accent}`,
      }}
    >
      <b
        style={{
          flex: "0 0 auto",
          display: "grid",
          placeItems: "center",
          width: 72 * u,
          height: 72 * u,
          borderRadius: 18 * u,
          background: accent,
          color: colors.bgDeep,
          fontSize: 40 * u,
          fontWeight: 800,
        }}
      >
        {letter ?? "—"}
      </b>
      <span style={{ minWidth: 0 }}>
        <small style={{ display: "block", color: accent, fontSize: type.eyebrow * u, fontWeight: 800, letterSpacing: "0.12em" }}>{label}</small>
        <span
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: 3,
            overflow: "hidden",
            marginTop: 6 * u,
            fontSize: type.small * u,
            lineHeight: 1.35,
            fontWeight: 600,
          }}
        >
          {text ?? "Não respondida — o tempo acabou ou a prova foi encerrada."}
        </span>
      </span>
    </div>
  );
}
