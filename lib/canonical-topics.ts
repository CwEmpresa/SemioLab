/** Os 6 temas canônicos já usados na UI (array `systems` em semiolab.tsx).
 * Quiz, Simulados e Paciente IA usam vocabulários de tema ligeiramente
 * diferentes (ex.: "Neurológico" no Quiz vs "Neurologia" nas especialidades
 * do Paciente IA) — este mapa normaliza tudo para o mesmo conjunto antes de
 * combinar as três fontes. */
export const CANONICAL_TOPICS = [
  "Cardiovascular",
  "Respiratório",
  "Anamnese",
  "Neurológico",
  "Abdome e digestório",
  "Exame físico",
] as const;
export type CanonicalTopic = (typeof CANONICAL_TOPICS)[number];

function normalize(s: string): string {
  return s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const TOPIC_ALIASES: Record<string, CanonicalTopic> = {
  [normalize("Cardiovascular")]: "Cardiovascular",
  [normalize("Respiratório")]: "Respiratório",
  [normalize("Anamnese")]: "Anamnese",
  [normalize("Neurológico")]: "Neurológico",
  [normalize("Neurologia")]: "Neurológico",
  [normalize("Abdome")]: "Abdome e digestório",
  [normalize("Abdome e digestório")]: "Abdome e digestório",
  [normalize("Gastroenterologia")]: "Abdome e digestório",
  [normalize("Exame físico")]: "Exame físico",
};

/** Retorna o tema canônico correspondente, ou null se não houver
 * correspondência conhecida (nunca inventa um tema novo). */
export function toCanonicalTopic(raw?: string | null): CanonicalTopic | null {
  if (!raw) return null;
  return TOPIC_ALIASES[normalize(raw)] ?? null;
}
