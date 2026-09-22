import { Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../theme";
import { useLayout } from "./use-layout";

type AnimatedProgressProps = {
  name: string;
  /** 0–100 */
  value: number;
  color: string;
  delay?: number;
  height?: number;
};

/** Barra de progresso que preenche com uma mola amortecida (sem rebote). */
export function AnimatedProgress({ name, value, color, delay = 0, height = 14 }: AnimatedProgressProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u } = useLayout();
  return (
    <div style={{ height: height * u, borderRadius: 999, background: colors.line, overflow: "hidden" }}>
      <Interactive.Div
        name={name}
        style={{
          height: "100%",
          borderRadius: 999,
          background: color,
          width: `${interpolate(frame, [delay, delay + 1.1 * fps], [0, Math.max(value, 1.5)], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.spring({ damping: 200 }),
          })}%`,
        }}
      />
    </div>
  );
}
