"use client";

import { useEffect, useRef, useState } from "react";
import { Eye, Headphones, HeartPulse, LockKeyhole, Pause, Play, Wind, X } from "lucide-react";
import "./consult-auscultation.css";

export type ConsultAuscultationSound = {
  area: "pulmonar" | "cardiaca";
  label: string;
  src: string;
  gain: number;
  finding: string;
};

/** Um foco de ausculta: toca o som real do caso, em loop, e só mostra o
 * achado descrito quando o aluno pede — para ele ouvir e concluir sozinho. */
function SoundRow({ sound, playing, onToggle }: { sound: ConsultAuscultationSound; playing: boolean; onToggle: () => void }) {
  const [revealed, setRevealed] = useState(false);
  const Icon = sound.area === "pulmonar" ? Wind : HeartPulse;
  return (
    <article className={`ca-sound ${playing ? "is-playing" : ""}`}>
      <header>
        <i><Icon /></i>
        <span>
          <b>{sound.label}</b>
          <small>{sound.area === "pulmonar" ? "Campos pulmonares · respire fundo pela boca" : "Focos cardíacos · paciente em repouso"}</small>
        </span>
        <button type="button" className="ca-play" onClick={onToggle} aria-label={playing ? `Pausar ${sound.label}` : `Ouvir ${sound.label}`}>
          {playing ? <Pause /> : <Play />}
        </button>
      </header>
      <div className="ca-wave" aria-hidden="true">
        {Array.from({ length: 28 }, (_, i) => <i key={i} style={{ animationDelay: `${(i % 7) * 0.09}s` }} />)}
      </div>
      {revealed ? (
        <p className="ca-finding"><b>Achado do caso:</b> {sound.finding}</p>
      ) : (
        <button type="button" className="ca-reveal" onClick={() => setRevealed(true)}>
          <Eye /> Já ouvi — revelar o achado
        </button>
      )}
    </article>
  );
}

export default function ConsultAuscultation({
  sounds,
  locked,
  loading,
  onClose,
  onUpgrade,
}: {
  sounds: ConsultAuscultationSound[];
  locked: boolean;
  loading: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingArea, setPlayingArea] = useState<string | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  function toggle(sound: ConsultAuscultationSound) {
    if (playingArea === sound.area) {
      audioRef.current?.pause();
      setPlayingArea(null);
      return;
    }
    audioRef.current?.pause();
    const audio = new Audio(sound.src);
    audio.loop = true;
    audio.volume = Math.max(0.05, Math.min(1, sound.gain));
    audio.onerror = () => setPlayingArea(null);
    audioRef.current = audio;
    setPlayingArea(sound.area);
    audio.play().catch(() => setPlayingArea(null));
  }

  function close() {
    audioRef.current?.pause();
    onClose();
  }

  return (
    <div className="overlay" onClick={close}>
      <section className="clinical-modal ca-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close" onClick={close} aria-label="Fechar ausculta"><X /></button>
        <small>AUSCULTA</small>
        <h2>Ouça e tire sua conclusão</h2>
        {locked ? (
          <div className="ca-locked">
            <LockKeyhole />
            <p>A ausculta com som real é um recurso do plano Pro e do período de teste.</p>
            <button type="button" className="primary" onClick={onUpgrade}>Conhecer o Pro</button>
          </div>
        ) : loading ? (
          <p className="ca-loading">Posicionando o estetoscópio...</p>
        ) : (
          <>
            <p className="ca-tip"><Headphones /> Use fones de ouvido. O laudo só aparece se você pedir.</p>
            {sounds.map((sound) => (
              <SoundRow key={sound.area} sound={sound} playing={playingArea === sound.area} onToggle={() => toggle(sound)} />
            ))}
            <p className="ca-source">Gravações reais de ausculta, uso educacional.</p>
          </>
        )}
      </section>
    </div>
  );
}
