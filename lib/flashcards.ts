import { SEMIOLOGY_MODULES } from "@/lib/content/semiology";

export type Flashcard = { id: string; deck: string; front: string; back: string };
export type FlashcardDeck = { id: string; title: string; quizTopic: string | null; kind: "semiologia" | "erros" | "pesquisa" };
/** 0 = errei, 1 = difícil, 2 = bom, 3 = fácil */
export type Grade = 0 | 1 | 2 | 3;

export const ERRORS_DECK_ID = "erros";
export const NEW_CARDS_PER_SESSION = 10;
export const SESSION_SIZE = 20;

/** Perguntas curadas por módulo; as manobras de cada módulo viram cartas
 * automaticamente (abaixo), sem repetir o conteúdo aqui. */
const CURATED: Record<string, [string, string][]> = {
  anamnese: [
    ["Quais são as partes da anamnese, em ordem?", "Identificação, queixa principal, história da doença atual, interrogatório sintomatológico, antecedentes pessoais, antecedentes familiares e hábitos e condições de vida."],
    ["Como registrar a queixa principal?", "De forma curta, de preferência nas palavras do paciente e com a duração. Ex.: \"dor no peito há 2 dias\"."],
    ["Quais características investigar de um sintoma na HDA?", "Início, localização, irradiação, caráter, intensidade, duração, evolução, fatores de melhora e piora, relação com funções do organismo e sintomas associados."],
    ["Como calcular a carga tabágica em anos-maço?", "(Cigarros por dia ÷ 20) × anos de tabagismo."],
    ["Para que serve o interrogatório sintomatológico?", "Revisar ativamente cada aparelho em busca de sintomas que o paciente não relatou."],
    ["Por que começar a entrevista com perguntas abertas?", "Para deixar o paciente contar a história sem indução; perguntas fechadas vêm depois, para detalhar."],
  ],
  "exame-geral": [
    ["Qual a sequência geral do exame físico?", "Inspeção, palpação, percussão e ausculta. No abdome, a ausculta vem antes da percussão e da palpação."],
    ["Onde a icterícia é mais visível?", "Na esclera, avaliada com luz natural."],
    ["Onde procurar cianose central?", "Na língua e nos lábios. A periférica aparece nas extremidades."],
    ["Quais características descrever em um linfonodo?", "Localização, tamanho, consistência, mobilidade, dor e coalescência."],
    ["Qual é a faixa de IMC adequada no adulto?", "Entre 18,5 e 24,9 kg/m²."],
    ["Qual a pontuação da escala de Glasgow?", "De 3 a 15 pontos."],
  ],
  "sinais-vitais": [
    ["Qual a frequência cardíaca normal do adulto em repouso?", "De 60 a 100 bpm."],
    ["Qual a frequência respiratória normal do adulto?", "De 12 a 20 irpm."],
    ["A partir de qual temperatura axilar se considera febre?", "A partir de 37,8 °C. Entre 37,3 e 37,7 °C, estado subfebril."],
    ["A partir de qual valor de consultório se define hipertensão?", "140/90 mmHg."],
    ["Qual a largura ideal do manguito?", "Cerca de 40% da circunferência do braço. Manguito pequeno superestima a pressão."],
    ["Quais sons de Korotkoff marcam a sistólica e a diastólica?", "O primeiro som marca a sistólica; o desaparecimento dos sons marca a diastólica."],
    ["Como contar um pulso irregular?", "Durante 1 minuto inteiro."],
  ],
  cardiovascular: [
    ["Onde fica o ictus cordis normal?", "No 4º ou 5º espaço intercostal esquerdo, na linha hemiclavicular, com até duas polpas digitais."],
    ["Onde fica o foco aórtico?", "No 2º espaço intercostal direito, junto ao esterno."],
    ["Onde fica o foco mitral?", "No ictus: 5º espaço intercostal esquerdo, na linha hemiclavicular."],
    ["O que produz a B1?", "O fechamento das valvas mitral e tricúspide, no início da sístole."],
    ["O que sugere uma B3 no adulto?", "Sobrecarga de volume ou insuficiência cardíaca (pode ser normal em jovens)."],
    ["Qual o sopro da estenose aórtica?", "Sistólico ejetivo no foco aórtico, irradiando para as carótidas."],
    ["Qual o sopro da insuficiência mitral?", "Holossistólico no foco mitral, irradiando para a axila."],
    ["Qual o achado de ausculta da estenose mitral?", "Ruflar diastólico no foco mitral, melhor em decúbito lateral esquerdo."],
  ],
  respiratorio: [
    ["O que acontece com o frêmito toracovocal na consolidação?", "Aumenta."],
    ["E no derrame pleural?", "Diminui ou fica abolido."],
    ["Qual o som à percussão no pneumotórax?", "Hipersonoridade ou timpanismo."],
    ["Quando aparecem os estertores finos e o que sugerem?", "No fim da inspiração; pneumonia, congestão pulmonar ou fibrose."],
    ["O que são sibilos?", "Sons musicais por estreitamento das vias aéreas, como na asma e na DPOC."],
    ["Qual padrão respiratório é típico da acidose metabólica?", "Respiração de Kussmaul: profunda e rápida."],
  ],
  abdome: [
    ["Qual a sequência do exame do abdome?", "Inspeção, ausculta, percussão e palpação."],
    ["Por que auscultar o abdome antes de palpar?", "Porque percutir e palpar alteram os ruídos intestinais."],
    ["O que sugerem ruídos hidroaéreos ausentes?", "Íleo paralítico."],
    ["Quais achados sugerem ascite?", "Macicez móvel de decúbito e sinal do piparote."],
    ["Por onde começar a palpação de um abdome doloroso?", "Pelo quadrante mais distante da dor."],
  ],
  neurologico: [
    ["Como é graduada a força muscular?", "De 0 (sem contração) a 5 (força normal)."],
    ["Qual raiz corresponde ao reflexo patelar?", "L3-L4."],
    ["Qual raiz corresponde ao reflexo aquileu?", "S1."],
    ["Quais testes avaliam a coordenação cerebelar?", "Índex-nariz, calcanhar-joelho e movimentos alternados rápidos."],
    ["Quais os componentes da escala de Glasgow?", "Abertura ocular (1 a 4), resposta verbal (1 a 5) e resposta motora (1 a 6)."],
  ],
};

export const SEMIOLOGY_DECKS: FlashcardDeck[] = SEMIOLOGY_MODULES.map((module) => ({
  id: module.id,
  title: module.title,
  quizTopic: module.quizTopic,
  kind: "semiologia",
}));

export const ERRORS_DECK: FlashcardDeck = { id: ERRORS_DECK_ID, title: "Caderno de erros", quizTopic: null, kind: "erros" };

/** Todas as cartas curadas, com ids estáveis ("sem:<deck>:<n>" e
 * "sem:<deck>:m<n>" para manobras): mudar a ordem aqui reinicia o progresso
 * daquelas cartas, então só acrescente ao fim. */
export const CURATED_CARDS: Flashcard[] = SEMIOLOGY_MODULES.flatMap((module) => [
  ...(CURATED[module.id] ?? []).map(([front, back], i) => ({ id: `sem:${module.id}:${i}`, deck: module.id, front, back })),
  ...module.maneuvers.map((m, i) => ({
    id: `sem:${module.id}:m${i}`,
    deck: module.id,
    front: `${m.name}: como pesquisar e o que indica?`,
    back: `${m.how} ${m.positive}`,
  })),
]);

export type ReviewState = { ease: number; interval_days: number; reps: number; lapses: number };

/** Agendamento no estilo SM-2, simplificado para 4 respostas. Devolve o novo
 * estado e quando a carta volta. "Errei" volta em 10 minutos. */
export function scheduleReview(state: ReviewState | null, grade: Grade, now = new Date()) {
  const prev = state ?? { ease: 2.5, interval_days: 0, reps: 0, lapses: 0 };
  let { ease, interval_days: interval, reps, lapses } = prev;
  let dueAt: Date;

  if (grade === 0) {
    lapses += 1;
    reps = 0;
    interval = 0;
    ease = Math.max(1.3, ease - 0.2);
    dueAt = new Date(now.getTime() + 10 * 60 * 1000);
  } else {
    if (grade === 1) {
      interval = reps === 0 ? 1 : Math.max(1, Math.round(interval * 1.2));
      ease = Math.max(1.3, ease - 0.15);
    } else if (grade === 2) {
      interval = reps === 0 ? 1 : reps === 1 ? 3 : Math.round(interval * ease);
    } else {
      interval = reps === 0 ? 3 : Math.round(Math.max(interval, 1) * ease * 1.3);
      ease += 0.15;
    }
    reps += 1;
    dueAt = new Date(now.getTime() + interval * 24 * 60 * 60 * 1000);
  }
  return { ease: Math.round(ease * 100) / 100, interval_days: interval, reps, lapses, due_at: dueAt.toISOString() };
}
