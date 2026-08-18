/** Nível calculado a partir do XP real. Nível 1 começa em 0 XP; cada nível
 * seguinte exige 500 XP a mais que o anterior (mesma curva usada na tela de
 * Progresso). Nunca usar valores fixos de nível na interface — sempre
 * derivar deste XP real do usuário. */
export function levelFromXp(xp: number): number {
  const safeXp = Number.isFinite(xp) && xp > 0 ? xp : 0;
  return Math.floor(safeXp / 500) + 1;
}

/** Iniciais a partir do nome real do usuário; nunca hardcoded. */
export function initialsFromName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean).slice(0, 2);
  const initials = parts.map((p) => p[0]?.toUpperCase()).join("");
  return initials || "U";
}

/** Nome de exibição seguro: se o nome estiver vazio, usa a parte local do
 * e-mail (antes do @) sem revelar o endereço completo. */
export function safeDisplayName(name: string | null | undefined, email: string | null | undefined): string {
  const trimmed = (name || "").trim();
  if (trimmed) return trimmed;
  const local = (email || "").split("@")[0];
  return local || "Usuário";
}
