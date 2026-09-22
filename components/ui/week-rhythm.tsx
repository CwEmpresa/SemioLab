"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { loadGSAP } from "@/components/animations";
import type { RhythmDay, WeekStats } from "@/app/use-learning-summary";

type WeekRhythmProps = {
  rhythm: RhythmDay[] | undefined;
  week: WeekStats | undefined;
  loading: boolean;
  onDetails: () => void;
  onStart: () => void;
};

const TRACE_HEIGHT = 96;
/** Linha de base do traçado (fração da altura, de cima para baixo). */
const BASELINE = 0.66;

const round = (n: number) => Math.round(n * 10) / 10;

/** Monta o traçado de ECG: cada dia ocupa uma faixa; dia com atividade vira
 * um complexo P-QRS-T com amplitude proporcional às atividades, dia só com
 * acesso vira um batimento pequeno, dia sem nada é linha reta. */
function buildTrace(days: RhythmDay[], width: number) {
  const h = TRACE_HEIGHT;
  const base = h * BASELINE;
  const seg = width / days.length;
  let d = `M0 ${round(base)}`;
  let marker = { x: width - seg / 2, y: base };

  days.forEach((day, i) => {
    const x0 = i * seg;
    const cx = x0 + seg / 2;
    const end = round(x0 + seg);
    if (!day.active) {
      d += ` L${end} ${round(base)}`;
      if (i === days.length - 1) marker = { x: cx, y: base };
      return;
    }
    const amp = day.activities > 0 ? h * (0.3 + (0.3 * Math.min(day.activities, 5)) / 5) : h * 0.16;
    const w = Math.min(seg, 70);
    d += ` L${round(cx - w * 0.4)} ${round(base)} Q${round(cx - w * 0.32)} ${round(base - 5)} ${round(cx - w * 0.24)} ${round(base)}`;
    d += ` L${round(cx - w * 0.1)} ${round(base)} L${round(cx - w * 0.05)} ${round(base + 5)} L${round(cx)} ${round(base - amp)} L${round(cx + w * 0.06)} ${round(base + 9)} L${round(cx + w * 0.12)} ${round(base)}`;
    d += ` L${round(cx + w * 0.22)} ${round(base)} Q${round(cx + w * 0.32)} ${round(base - 8)} ${round(cx + w * 0.42)} ${round(base)} L${end} ${round(base)}`;
    if (i === days.length - 1) marker = { x: cx, y: base - amp };
  });
  return { d, marker };
}

function dayLabel(date: string, isToday: boolean) {
  if (isToday) return "Hoje";
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Largura real do contêiner, para desenhar o traçado sem distorção. */
function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  // Medição inicial síncrona (antes da pintura) + observador para resizes.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.round(el.getBoundingClientRect().width));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function WeekRhythm({ rhythm, week, loading, onDetails, onStart }: WeekRhythmProps) {
  const [traceRef, width] = useElementWidth<HTMLDivElement>();
  const pathRef = useRef<SVGPathElement>(null);
  const markerRef = useRef<SVGGElement>(null);
  const days = useMemo(() => rhythm ?? [], [rhythm]);
  const trace = useMemo(() => (width > 0 && days.length ? buildTrace(days, width) : null), [days, width]);
  const activeDays = days.filter((day) => day.active).length;
  const today = days[days.length - 1];
  const hasRhythm = activeDays > 0;
  const dataKey = days.map((day) => `${day.date}:${day.activities}:${day.active ? 1 : 0}`).join("|");
  const traceReady = trace !== null;

  // Um único momento orquestrado: o traçado se desenha e o batimento de hoje
  // aparece no fim. Redesenha só quando os dados mudam (não a cada resize).
  useEffect(() => {
    const path = pathRef.current;
    const marker = markerRef.current;
    if (!path || !dataKey) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cancelled = false;
    if (reduce) {
      path.style.strokeDashoffset = "0";
      if (marker) marker.style.opacity = "1";
      return;
    }
    loadGSAP().then(() => {
      if (cancelled) return;
      if (!window.gsap) {
        // Sem GSAP (CDN bloqueado): mostra o traçado completo, sem animação.
        path.style.strokeDashoffset = "0";
        if (marker) marker.style.opacity = "1";
        return;
      }
      window.gsap.fromTo(path, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 2.2, ease: "power2.inOut" });
      if (marker) window.gsap.fromTo(marker, { opacity: 0 }, { opacity: 1, duration: 0.35, delay: 2 });
    });
    return () => {
      cancelled = true;
      window.gsap?.killTweensOf([path, marker]);
    };
  }, [dataKey, traceReady]);

  const summary = !days.length
    ? "Carregando seu ritmo…"
    : hasRhythm
      ? `${activeDays} ${activeDays === 1 ? "dia ativo" : "dias ativos"} nos últimos 7, ${today?.activities ?? 0} ${today?.activities === 1 ? "atividade" : "atividades"} hoje.`
      : "Nenhum batimento nos últimos 7 dias. Cada quiz, simulado ou consulta vira um pico aqui.";

  return (
    <section className="rhythm-card">
      <header className="rhythm-head">
        <span>
          <h3>Ritmo da semana</h3>
          <p>{summary}</p>
        </span>
        <button onClick={onDetails}>Detalhes</button>
      </header>

      <div
        className="rhythm-trace"
        ref={traceRef}
        role="img"
        aria-label={days.map((day, i) => `${dayLabel(day.date, i === days.length - 1)}: ${day.activities} ${day.activities === 1 ? "atividade" : "atividades"}${!day.activities && day.active ? ", com acesso" : ""}`).join("; ")}
      >
        {trace && (
          <svg width={width} height={TRACE_HEIGHT} viewBox={`0 0 ${width} ${TRACE_HEIGHT}`} aria-hidden="true">
            <line className="rhythm-baseline" x1="0" x2={width} y1={TRACE_HEIGHT * BASELINE} y2={TRACE_HEIGHT * BASELINE} />
            <path ref={pathRef} className="rhythm-line" d={trace.d} pathLength={1} />
            <g ref={markerRef} className="rhythm-marker">
              <circle className="rhythm-halo" cx={trace.marker.x} cy={trace.marker.y} r="4" />
              <circle className="rhythm-dot" cx={trace.marker.x} cy={trace.marker.y} r="4" />
            </g>
          </svg>
        )}
      </div>
      <div className="rhythm-days" aria-hidden="true">
        {days.map((day, i) => (
          <span key={day.date} className={`${day.active ? "active" : ""} ${i === days.length - 1 ? "today" : ""}`}>
            {dayLabel(day.date, i === days.length - 1)}
          </span>
        ))}
      </div>

      <div className="rhythm-metrics">
        <span><b>{week?.questions ?? 0}</b><small>questões na semana</small></span>
        <span><b>{week?.accuracy == null ? "—" : `${week.accuracy}%`}</b><small>de acertos</small></span>
        <span><b>{activeDays}<em>/7</em></b><small>dias ativos</small></span>
      </div>

      {!loading && days.length > 0 && !today?.activities && (
        <button className="rhythm-cta" onClick={onStart}>
          {hasRhythm ? "Adicione o batimento de hoje" : "Comece o primeiro batimento"} <ArrowRight />
        </button>
      )}
    </section>
  );
}
