import { useVideoConfig } from "remotion";

/** No retrato o vídeo é exibido bem menor (≈ 255–400px de largura no
 * celular), então tudo cresce 1,4× para continuar legível. */
const PORTRAIT_SCALE = 1.4;

/** Unidade de escala e orientação da composição. Na paisagem `u` = 1
 * quando o menor lado tem 1080px, então os tamanhos em theme.ts valem para
 * os dois formatos. */
export function useLayout() {
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  const u = (Math.min(width, height) / 1080) * (portrait ? PORTRAIT_SCALE : 1);
  return {
    u,
    portrait,
    padX: (portrait ? 64 : 128) * u,
    padY: (portrait ? 110 : 96) * u,
  };
}
