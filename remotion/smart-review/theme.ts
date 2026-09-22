import { loadFont } from "@remotion/google-fonts/Manrope";

/** Mesma família tipográfica do app (Manrope). Carregada pelo Remotion para
 * que o Player e uma futura renderização em MP4 esperem a fonte. */
export const { fontFamily } = loadFont("normal", { weights: ["500", "700", "800"], subsets: ["latin", "latin-ext"] });

/** Paleta do SemioLab (tema escuro do app). */
export const colors = {
  bg: "#061419",
  bgDeep: "#040d11",
  surface: "#0c2026",
  surfaceRaised: "#10282f",
  line: "#203c43",
  text: "#edf8f6",
  sub: "#a3b9bc",
  muted: "#6f8a8f",
  mint: "#5fe0cb",
  mintDeep: "#1f9a86",
  wrong: "#f08a8a",
  wrongBg: "#3a1a1f",
  warn: "#f2b56b",
  gold: "#e2c173",
  goldBg: "#2f2612",
} as const;

/** Faixas de desempenho usadas nas barras e destaques. */
export function accuracyColor(accuracy: number) {
  if (accuracy < 60) return colors.wrong;
  if (accuracy < 75) return colors.warn;
  return colors.mint;
}

/** Curva padrão de entrada (suave, sem exagero). */
export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

/** Tamanhos base para uma composição com menor lado = 1080px. */
export const type = {
  eyebrow: 26,
  headline: 84,
  title: 60,
  body: 42,
  small: 32,
} as const;
