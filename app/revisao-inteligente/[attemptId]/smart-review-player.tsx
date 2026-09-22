"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore, type RefObject } from "react";
import { Play } from "lucide-react";
import { Player, type PlayerRef } from "@remotion/player";
import { SmartReview } from "@/remotion/smart-review/SmartReview";
import { formatReviewDuration, FORMATS, FPS, getSmartReviewDuration, type ReviewFormat } from "@/remotion/smart-review/timeline";
import type { SmartReviewProps } from "@/remotion/smart-review/types";

const PORTRAIT_QUERY = "(max-width: 760px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(PORTRAIT_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/** Retrato no celular, paisagem no desktop — a composition se adapta às
 * duas proporções. */
function useReviewFormat(): ReviewFormat {
  return useSyncExternalStore(
    subscribe,
    () => (window.matchMedia(PORTRAIT_QUERY).matches ? "portrait" : "landscape"),
    () => "landscape",
  );
}

type SmartReviewPlayerProps = {
  review: SmartReviewProps;
  playerRef: RefObject<PlayerRef | null>;
  onEnded: () => void;
};

/** Carregado sob demanda (next/dynamic) só nesta página: o Remotion nunca
 * entra no bundle do dashboard nem do resultado do simulado. */
export default function SmartReviewPlayer({ review, playerRef, onEnded }: SmartReviewPlayerProps) {
  const format = useReviewFormat();
  const { width, height } = FORMATS[format];
  const durationInFrames = useMemo(() => getSmartReviewDuration(review, FPS), [review]);

  // O frame 0 é vazio (todos os elementos entram com fade); antes do play
  // mostra uma capa com o resumo da revisão.
  const renderPoster = useCallback(
    () => (
      <div className="sr-poster">
        <span className="sr-poster-play" aria-hidden="true"><Play /></span>
        <b>{review.wrongAnswers === 0 ? "Revisão de desempenho" : "Sua revisão de hoje"}</b>
        <small>
          {review.wrongAnswers === 0
            ? `${review.correctAnswers} de ${review.totalQuestions} corretas`
            : `${review.wrongAnswers} ${review.wrongAnswers === 1 ? "erro" : "erros"} para revisar`}
          {" · "}
          {formatReviewDuration(durationInFrames)}
        </small>
      </div>
    ),
    [review, durationInFrames],
  );

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.addEventListener("ended", onEnded);
    return () => player.removeEventListener("ended", onEnded);
  }, [playerRef, onEnded, format]);

  return (
    <Player
      key={format}
      ref={playerRef}
      component={SmartReview}
      inputProps={review}
      durationInFrames={durationInFrames}
      fps={FPS}
      compositionWidth={width}
      compositionHeight={height}
      style={{ width: "100%", borderRadius: "inherit" }}
      controls
      clickToPlay
      allowFullscreen
      doubleClickToFullscreen
      spaceKeyToPlayOrPause
      showPlaybackRateControl={[0.75, 1, 1.25, 1.5]}
      initiallyShowControls
      renderPoster={renderPoster}
      showPosterWhenUnplayed
      // Uso sob a licença gratuita do Remotion (pessoas físicas e empresas
      // com até 3 pessoas). Acima disso, é preciso a Company License:
      // https://remotion.dev/license
      acknowledgeRemotionLicense
    />
  );
}
