import type { HiddenCase } from "@/lib/patient-case-schema";

/** Gravações reais do Laboratório de Ausculta do app (mesmos arquivos de
 * public/semiolab-laboratorio-ausculta.html). */
const SOUNDS = {
  "lung-normal": "/media/auscultation/c4d3efc6500259ba.mp3",
  "lung-wheeze": "/media/auscultation/06cea0df40bf5525.mp3",
  "lung-rhonchi": "/media/auscultation/f37313db3a7cd9ae.mp3",
  "lung-fine": "/media/auscultation/efe7dee45e37ca1a.mp3",
  "lung-coarse": "/media/auscultation/f158a62caa3880d4.mp3",
  "lung-rub": "/media/auscultation/f55431c4f4fde100.mp3",
  "heart-normal": "/media/auscultation/13174bcc44f63e0b.mp3",
  "heart-s3": "/media/auscultation/d776cad34418763d.mp3",
  "heart-s4": "/media/auscultation/f6267dffb061da26.mp3",
  "heart-msm": "/media/auscultation/34948a13243cd910.mp3",
  "heart-ldm": "/media/auscultation/cfaaf1cdfaeed885.mp3",
  "heart-af": "/media/auscultation/d38b47b567317aa3.mp3",
} as const;

export type AuscultationArea = "pulmonar" | "cardiaca";

export type AuscultationSound = {
  area: AuscultationArea;
  label: string;
  src: string;
  /** Volume relativo (0–1): murmúrio diminuído/abolido toca mais baixo. */
  gain: number;
  /** Achado descrito no caso — o aluno só vê depois de ouvir e decidir. */
  finding: string;
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

function findFacts(facts: Record<string, string>, keys: string[]): string {
  for (const [key, value] of Object.entries(facts)) {
    if (keys.includes(norm(key))) return value;
  }
  return "";
}

/** Tira negações ("sem estertores", "sem sopros nítidos") antes de buscar o
 * achado — senão "sem estertores" seria lido como estertor. */
const stripNegations = (t: string) =>
  t.replace(/\b(sem|ausencia de|nao ha)\s+([a-z]+\s+)?(estertores?|sibilos?|roncos?|ruidos adventicios|atrito|sopros?|crepitac[a-z]*|b3|b4)(\s+[a-z]+)?/g, " ");

function pickLung(text: string): { id: keyof typeof SOUNDS; gain: number } {
  const t = stripNegations(norm(text));
  if (/\b(sibil|estridor|broncoespasm)/.test(t)) return { id: "lung-wheeze", gain: /\bmurmurio[a-z ]*diminu/.test(t) ? 0.7 : 1 };
  if (/\bronco/.test(t)) return { id: "lung-rhonchi", gain: 1 };
  if (/\batrito/.test(t)) return { id: "lung-rub", gain: 1 };
  if (/\bestertor(es)? (grosso|bolhos)|\bbolhos/.test(t)) return { id: "lung-coarse", gain: 1 };
  if (/\b(estertor|crepita)/.test(t)) return { id: "lung-fine", gain: 1 };
  if (/\bmurmurio[a-z ]*abolid/.test(t)) return { id: "lung-normal", gain: 0.18 };
  if (/\bmurmurio[a-z ]*(diminu|reduzid)/.test(t)) return { id: "lung-normal", gain: 0.45 };
  return { id: "lung-normal", gain: 1 };
}

function pickHeart(text: string): { id: keyof typeof SOUNDS; gain: number } {
  const t = stripNegations(norm(text));
  if (/irregular|fibrila|arritmi/.test(t)) return { id: "heart-af", gain: 1 };
  if (/terceira bulha|\bb3\b/.test(t)) return { id: "heart-s3", gain: 1 };
  if (/quarta bulha|\bb4\b/.test(t)) return { id: "heart-s4", gain: 1 };
  if (/sopro (diastol|em ruflar)|ruflar/.test(t)) return { id: "heart-ldm", gain: 1 };
  if (/sopro/.test(t)) return { id: "heart-msm", gain: 1 };
  if (/hipofon|abafad/.test(t)) return { id: "heart-normal", gain: 0.45 };
  return { id: "heart-normal", gain: 1 };
}

/** Escolhe, a partir do exame físico do caso, o som real que mais se
 * aproxima do achado. Sem descrição no caso, toca o som normal (é o que o
 * aluno ouviria num exame sem alteração). */
export function auscultationForCase(hidden: HiddenCase): AuscultationSound[] {
  const lungText = findFacts(hidden.physicalExam, ["pulmonar", "respiratorio", "torax", "aparelho respiratorio"]);
  const heartText = findFacts(hidden.physicalExam, ["cardiovascular", "cardiaco", "aparelho cardiovascular"]);
  const lung = pickLung(lungText);
  const heart = pickHeart(heartText);
  return [
    { area: "pulmonar", label: "Ausculta pulmonar", src: SOUNDS[lung.id], gain: lung.gain, finding: lungText || "Murmúrio vesicular presente, sem ruídos adventícios." },
    { area: "cardiaca", label: "Ausculta cardíaca", src: SOUNDS[heart.id], gain: heart.gain, finding: heartText || "Ritmo regular em dois tempos, bulhas normofonéticas, sem sopros." },
  ];
}

/** O pedido do aluno menciona ausculta? (ex.: "ausculta pulmonar"). */
export function requestedAuscultation(order: string): AuscultationArea[] | null {
  const t = norm(order);
  if (!/auscult|estetosc/.test(t)) return null;
  const areas: AuscultationArea[] = [];
  if (/pulm|respir|torax/.test(t)) areas.push("pulmonar");
  if (/cardi|coraca/.test(t)) areas.push("cardiaca");
  return areas.length ? areas : ["pulmonar", "cardiaca"];
}
