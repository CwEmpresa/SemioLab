"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

/* Gravações reais do laboratório de ausculta do app (mesmos arquivos de
   public/semiolab-laboratorio-ausculta.html). Duas crianças/adolescentes
   da mesma base, para a comparação ser justa. */
const SOUNDS = [
  {
    id: "normal",
    label: "Sem sopro",
    detail: "Foco aórtico, adolescente",
    src: "/media/auscultation/ed53a3c6623eab71.mp3",
  },
  {
    id: "murmur",
    label: "Sopro holossistólico",
    detail: "Foco pulmonar, III/VI, adolescente",
    src: "/media/auscultation/0ead3d9a116bed98.mp3",
  },
] as const;

type SoundId = (typeof SOUNDS)[number]["id"];

const BARS = 64;

/**
 * Tocador com onda ao vivo: o áudio real passa por um AnalyserNode e o
 * canvas desenha a amplitude a cada quadro. Parado, a onda fica numa
 * forma estática para não gastar CPU. O áudio só carrega quando a pessoa
 * aperta play.
 */
export default function AuscultationDemo() {
  const [current, setCurrent] = useState<SoundId>("murmur");
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number>(0);

  const draw = useCallback((live: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const { clientWidth: w, clientHeight: h } = canvas;
    if (canvas.width !== w * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const g = canvas.getContext("2d");
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);

    const values = new Array<number>(BARS);
    if (live && analyserRef.current) {
      const data = new Uint8Array(analyserRef.current.fftSize);
      analyserRef.current.getByteTimeDomainData(data);
      const step = Math.floor(data.length / BARS);
      for (let i = 0; i < BARS; i++) {
        let peak = 0;
        for (let j = 0; j < step; j++) peak = Math.max(peak, Math.abs(data[i * step + j] - 128));
        values[i] = Math.min(1, (peak / 128) * 3.2);
      }
    } else {
      for (let i = 0; i < BARS; i++) {
        const beat = Math.exp(-Math.pow(((i % 16) - 3) / 1.6, 2)) + 0.55 * Math.exp(-Math.pow(((i % 16) - 9) / 1.4, 2));
        values[i] = 0.06 + beat * 0.5;
      }
    }

    // Em telas estreitas o espaço entre barras encolhe junto, para a
    // largura nunca ficar negativa.
    const gap = Math.min(4, (w / BARS) * 0.4);
    const bw = Math.max(1, (w - gap * (BARS - 1)) / BARS);
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, "#3de0c4");
    grad.addColorStop(1, "#9ff5e4");
    g.fillStyle = grad;
    values.forEach((v, i) => {
      const bh = Math.max(3, v * h * 0.92);
      const x = i * (bw + gap);
      const y = (h - bh) / 2;
      g.beginPath();
      g.roundRect(x, y, bw, bh, bw / 2);
      g.fill();
    });
  }, []);

  const startLoop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    const tick = () => {
      draw(true);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [draw]);

  useEffect(() => {
    draw(false);
    const onResize = () => draw(!!audioRef.current && !audioRef.current.paused);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(rafRef.current);
      audioRef.current?.pause();
      ctxRef.current?.close().catch(() => {});
    };
  }, [draw]);

  const ensureGraph = () => {
    if (audioRef.current && ctxRef.current) return audioRef.current;
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.loop = true;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    audioRef.current = audio;
    ctxRef.current = ctx;
    analyserRef.current = analyser;
    return audio;
  };

  const play = async (id: SoundId) => {
    const audio = ensureGraph();
    const sound = SOUNDS.find((s) => s.id === id)!;
    if (!audio.src.endsWith(sound.src)) {
      audio.src = sound.src;
      audio.currentTime = 0;
    }
    await ctxRef.current?.resume();
    try {
      await audio.play();
      setPlaying(true);
      startLoop();
    } catch {
      setPlaying(false);
    }
  };

  const stop = () => {
    audioRef.current?.pause();
    cancelAnimationFrame(rafRef.current);
    setPlaying(false);
    draw(false);
  };

  const choose = (id: SoundId) => {
    setCurrent(id);
    if (playing) play(id);
  };

  const sound = SOUNDS.find((s) => s.id === current)!;

  return (
    <div className="sx-scope">
      <div className="sx-scope-toggle" role="radiogroup" aria-label="Escolha a gravação">
        {SOUNDS.map((s) => (
          <button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={current === s.id}
            className={current === s.id ? "on" : ""}
            onClick={() => choose(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className={`sx-scope-screen ${playing ? "is-live" : ""}`}>
        <canvas ref={canvasRef} aria-hidden="true" />
        <span className="sx-scope-grid" aria-hidden="true" />
      </div>

      <div className="sx-scope-controls">
        <button
          type="button"
          className="sx-scope-play"
          onClick={() => (playing ? stop() : play(current))}
          aria-label={playing ? "Pausar gravação" : `Ouvir: ${sound.label}`}
        >
          {playing ? <Pause /> : <Play />}
        </button>
        <span>
          <b>{sound.label}</b>
          <em>{sound.detail}</em>
        </span>
      </div>

      <p className="sx-scope-credit">
        Gravações reais da base CirCor DigiScope (PhysioNet), licença ODC-By 1.0. Use fone de ouvido.
      </p>
    </div>
  );
}
