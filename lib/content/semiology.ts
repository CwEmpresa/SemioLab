/** Conteúdo curado da área de Semiologia. Texto educacional de referência
 * (semiologia clássica, adultos). Deve passar por revisão médica antes de
 * cada publicação; não substitui livro-texto nem conduta clínica. */

export type SemiologySection = { title: string; items: string[] };
export type SemiologyManeuver = { name: string; how: string; positive: string };
export type SemiologyPattern = { condition: string; findings: string[] };

export type SemiologyModule = {
  id: string;
  title: string;
  /** Tema usado pelo Quiz e pelos flashcards. */
  quizTopic: string;
  summary: string;
  sections: SemiologySection[];
  maneuvers: SemiologyManeuver[];
  patterns?: SemiologyPattern[];
  keyPoints: string[];
};

export const SEMIOLOGY_MODULES: SemiologyModule[] = [
  {
    id: "anamnese",
    title: "Anamnese",
    quizTopic: "Anamnese",
    summary: "O roteiro da entrevista clínica, da identificação aos hábitos de vida.",
    sections: [
      {
        title: "Identificação",
        items: [
          "Nome, idade, sexo, cor, estado civil e escolaridade.",
          "Profissão atual e anteriores: exposições ocupacionais orientam hipóteses.",
          "Naturalidade e procedência: dão contexto epidemiológico (doenças endêmicas).",
        ],
      },
      {
        title: "Queixa principal",
        items: [
          "O motivo da consulta, de preferência nas palavras do paciente.",
          "Registre com a duração: \"dor no peito há 2 dias\".",
        ],
      },
      {
        title: "História da doença atual",
        items: [
          "Narrativa cronológica, do início dos sintomas até hoje.",
          "Para cada sintoma: início, localização, irradiação, caráter, intensidade (0 a 10), duração, evolução.",
          "Fatores de melhora e piora, relação com funções do organismo e sintomas associados.",
          "Tratamentos já feitos e a resposta a eles.",
        ],
      },
      {
        title: "Interrogatório sintomatológico",
        items: [
          "Revisão ativa por aparelhos, em busca de sintomas que o paciente não relatou.",
          "Evita que achados importantes fiquem de fora da história.",
        ],
      },
      {
        title: "Antecedentes pessoais",
        items: [
          "Fisiológicos: gestação, parto e desenvolvimento (principalmente em pediatria).",
          "Patológicos: doenças prévias, cirurgias, internações, traumas e transfusões.",
          "Medicamentos em uso, alergias e situação vacinal.",
        ],
      },
      {
        title: "Antecedentes familiares",
        items: [
          "Doenças em parentes de primeiro grau: hipertensão, diabetes, câncer, doença coronariana precoce.",
          "Causa e idade de óbito dos pais, quando for o caso.",
        ],
      },
      {
        title: "Hábitos e condições de vida",
        items: [
          "Tabagismo (em anos-maço), etilismo e uso de outras drogas.",
          "Alimentação, atividade física e sono.",
          "Moradia, saneamento, renda e rede de apoio.",
        ],
      },
    ],
    maneuvers: [],
    keyPoints: [
      "Comece com perguntas abertas e só depois foque com perguntas fechadas.",
      "Não induza respostas: pergunte \"como é a dor?\" e não \"a dor é em aperto?\".",
      "Anos-maço = (cigarros por dia ÷ 20) × anos de tabagismo.",
      "Queixa principal curta; os detalhes vão para a história da doença atual.",
    ],
  },
  {
    id: "exame-geral",
    title: "Exame físico geral",
    quizTopic: "Exame físico",
    summary: "A primeira impressão do paciente, antes do exame por aparelhos.",
    sections: [
      {
        title: "Sequência do exame",
        items: [
          "Inspeção, palpação, percussão e ausculta.",
          "Exceção: no abdome, ausculte antes de percutir e palpar.",
        ],
      },
      {
        title: "Estado geral e consciência",
        items: [
          "Estado geral: bom, regular ou grave.",
          "Consciência: lúcido e orientado no tempo e no espaço; se alterado, use a escala de Glasgow (3 a 15).",
          "Fácies, atitude, decúbito e biotipo (normolíneo, brevilíneo, longilíneo).",
        ],
      },
      {
        title: "Pele e mucosas",
        items: [
          "Mucosas coradas ou hipocoradas (graduadas de + a ++++).",
          "Hidratação: umidade das mucosas, turgor da pele, olhos.",
          "Icterícia: melhor vista na esclera, com luz natural.",
          "Cianose central (língua, lábios) ou periférica (extremidades frias).",
        ],
      },
      {
        title: "Edema, linfonodos e medidas",
        items: [
          "Edema: localização, simetria, cacifo e graduação (+ a ++++).",
          "Linfonodos: local, tamanho, consistência, mobilidade, dor e coalescência.",
          "IMC = peso (kg) ÷ altura² (m); adequado entre 18,5 e 24,9.",
        ],
      },
    ],
    maneuvers: [
      {
        name: "Sinal do cacifo (Godet)",
        how: "Pressione com o polegar, por alguns segundos, uma área sobre osso, como a região pré-tibial.",
        positive: "A depressão que persiste depois de retirar o dedo indica edema.",
      },
    ],
    keyPoints: [
      "A inspeção começa assim que o paciente entra no consultório.",
      "Icterícia é mais visível na esclera; cianose central aparece na língua e nos lábios.",
      "Linfonodo endurecido, fixo e indolor exige investigação.",
    ],
  },
  {
    id: "sinais-vitais",
    title: "Sinais vitais",
    quizTopic: "Exame físico",
    summary: "Valores de referência no adulto e a técnica correta de medida.",
    sections: [
      {
        title: "Valores de referência (adulto em repouso)",
        items: [
          "Pressão arterial: hipertensão a partir de 140/90 mmHg em consultório.",
          "Frequência cardíaca: 60 a 100 bpm (abaixo, bradicardia; acima, taquicardia).",
          "Frequência respiratória: 12 a 20 irpm.",
          "Temperatura axilar: febre a partir de 37,8 °C; entre 37,3 e 37,7 °C, estado subfebril.",
          "Saturação de oxigênio: 95% ou mais em ar ambiente, na ausência de doença pulmonar crônica.",
        ],
      },
      {
        title: "Como medir a pressão arterial",
        items: [
          "Paciente sentado, em repouso de 3 a 5 minutos, costas apoiadas e pernas descruzadas.",
          "Braço na altura do coração; manguito com largura de cerca de 40% da circunferência do braço.",
          "Estime a sistólica palpando o pulso radial antes de auscultar.",
          "Desinsufle devagar (2 a 3 mmHg por segundo).",
          "Primeiro som de Korotkoff = sistólica; desaparecimento dos sons = diastólica.",
        ],
      },
      {
        title: "Pulso",
        items: [
          "Avalie frequência, ritmo, amplitude e simetria entre os lados.",
          "Se o ritmo for irregular, conte durante 1 minuto inteiro.",
        ],
      },
    ],
    maneuvers: [],
    keyPoints: [
      "Manguito pequeno para o braço superestima a pressão.",
      "Pulso irregular: conte por 60 segundos, nunca 15 × 4.",
      "Dor também é avaliada como sinal vital, com escala de 0 a 10.",
    ],
  },
  {
    id: "cardiovascular",
    title: "Exame cardiovascular",
    quizTopic: "Cardiovascular",
    summary: "Ictus, focos de ausculta, bulhas e como descrever um sopro.",
    sections: [
      {
        title: "Inspeção e palpação do precórdio",
        items: [
          "Ictus cordis: no 4º ou 5º espaço intercostal esquerdo, na linha hemiclavicular.",
          "Extensão normal de até duas polpas digitais.",
          "Ictus desviado para baixo e para a esquerda sugere dilatação do ventrículo esquerdo.",
        ],
      },
      {
        title: "Focos de ausculta",
        items: [
          "Aórtico: 2º espaço intercostal direito, junto ao esterno.",
          "Pulmonar: 2º espaço intercostal esquerdo, junto ao esterno.",
          "Aórtico acessório: 3º espaço intercostal esquerdo.",
          "Tricúspide: borda esternal esquerda baixa.",
          "Mitral: no ictus (5º espaço intercostal esquerdo, linha hemiclavicular).",
        ],
      },
      {
        title: "Bulhas",
        items: [
          "B1: fechamento das valvas mitral e tricúspide, marca o início da sístole.",
          "B2: fechamento das valvas aórtica e pulmonar; desdobra fisiologicamente na inspiração.",
          "B3: no início da diástole; sugere sobrecarga de volume ou insuficiência cardíaca (pode ser normal em jovens).",
          "B4: no fim da diástole; contração atrial contra ventrículo rígido, como na hipertrofia.",
        ],
      },
      {
        title: "Descrevendo um sopro",
        items: [
          "Fase (sistólico ou diastólico), foco, irradiação, intensidade (1 a 6) e timbre.",
          "Estenose aórtica: sopro sistólico ejetivo no foco aórtico, irradiando para as carótidas.",
          "Insuficiência mitral: sopro holossistólico no foco mitral, irradiando para a axila.",
          "Estenose mitral: ruflar diastólico no foco mitral.",
        ],
      },
    ],
    maneuvers: [
      {
        name: "Manobra de Rivero-Carvallo",
        how: "Ausculte o foco tricúspide enquanto o paciente inspira profundamente.",
        positive: "O sopro aumenta na inspiração: origem nas câmaras direitas (tricúspide).",
      },
      {
        name: "Decúbito lateral esquerdo",
        how: "Com o paciente virado para a esquerda, ausculte o foco mitral com a campânula.",
        positive: "Acentua sopros mitrais e B3, como o ruflar da estenose mitral.",
      },
    ],
    keyPoints: [
      "Palpe o pulso carotídeo enquanto ausculta para saber o que é sístole.",
      "Sopro diastólico é sempre patológico.",
      "Irradiação para a axila lembra mitral; para as carótidas, aórtica.",
    ],
  },
  {
    id: "respiratorio",
    title: "Exame respiratório",
    quizTopic: "Respiratório",
    summary: "Os quatro tempos do exame do tórax e os padrões que eles formam.",
    sections: [
      {
        title: "Inspeção",
        items: [
          "Forma do tórax: normal, em tonel, pectus excavatum ou carinatum.",
          "Padrão respiratório: Kussmaul (acidose), Cheyne-Stokes, Biot.",
          "Tiragem e uso de musculatura acessória indicam esforço respiratório.",
        ],
      },
      {
        title: "Palpação",
        items: [
          "Expansibilidade dos ápices e das bases, comparando os dois lados.",
          "Frêmito toracovocal (paciente fala \"trinta e três\"): aumenta na consolidação, diminui no derrame e no pneumotórax.",
        ],
      },
      {
        title: "Percussão",
        items: [
          "Som claro pulmonar é o normal.",
          "Macicez: derrame pleural ou consolidação.",
          "Hipersonoridade ou timpanismo: pneumotórax e enfisema.",
        ],
      },
      {
        title: "Ausculta",
        items: [
          "Murmúrio vesicular: o som normal do parênquima.",
          "Estertores finos (crepitantes): no fim da inspiração; pneumonia, congestão, fibrose.",
          "Estertores grossos: secreção em vias aéreas de maior calibre.",
          "Roncos: secreção nos brônquios; sibilos: estreitamento, como na asma e na DPOC.",
          "Atrito pleural: inflamação da pleura.",
        ],
      },
    ],
    maneuvers: [],
    patterns: [
      { condition: "Consolidação (pneumonia)", findings: ["Frêmito aumentado", "Macicez", "Estertores finos e sopro tubário"] },
      { condition: "Derrame pleural", findings: ["Frêmito diminuído ou abolido", "Macicez", "Murmúrio diminuído ou abolido"] },
      { condition: "Pneumotórax", findings: ["Frêmito diminuído", "Hipertimpanismo", "Murmúrio diminuído ou abolido"] },
    ],
    keyPoints: [
      "Compare sempre pontos simétricos dos dois hemitórax.",
      "Frêmito é o que separa consolidação (aumenta) de derrame (diminui).",
      "Um achado isolado vale pouco; o padrão dos quatro tempos é que orienta.",
    ],
  },
  {
    id: "abdome",
    title: "Exame do abdome",
    quizTopic: "Abdome",
    summary: "A sequência própria do abdome e os sinais que você precisa reconhecer.",
    sections: [
      {
        title: "Sequência",
        items: [
          "Inspeção, ausculta, percussão e palpação.",
          "A ausculta vem antes porque percutir e palpar alteram os ruídos intestinais.",
          "Divida o abdome em quadrantes ou em nove regiões para localizar os achados.",
        ],
      },
      {
        title: "Ausculta e percussão",
        items: [
          "Ruídos hidroaéreos aumentados: diarreia ou obstrução em fase inicial.",
          "Ruídos ausentes após ausculta prolongada: íleo paralítico.",
          "Timpanismo predomina na percussão normal.",
          "Macicez móvel de decúbito e piparote sugerem ascite.",
        ],
      },
      {
        title: "Palpação",
        items: [
          "Superficial e depois profunda, começando longe da área dolorosa.",
          "Avalie defesa, rigidez, massas, fígado e baço.",
        ],
      },
    ],
    maneuvers: [
      {
        name: "Sinal de Murphy",
        how: "Palpe o ponto cístico (hipocôndrio direito) e peça uma inspiração profunda.",
        positive: "A inspiração é interrompida pela dor: sugere colecistite aguda.",
      },
      {
        name: "Sinal de Blumberg",
        how: "Comprima o ponto de McBurney e solte de forma rápida.",
        positive: "Dor à descompressão brusca: irritação peritoneal, como na apendicite.",
      },
      {
        name: "Sinal de Rovsing",
        how: "Comprima a fossa ilíaca esquerda.",
        positive: "Dor na fossa ilíaca direita: sugere apendicite.",
      },
      {
        name: "Sinal de Giordano",
        how: "Faça punho-percussão na região lombar, de cada lado.",
        positive: "Dor à percussão: sugere pielonefrite ou litíase renal.",
      },
    ],
    keyPoints: [
      "No abdome, a ausculta vem antes da palpação.",
      "Comece a palpação pelo quadrante mais distante da dor.",
      "Dor à descompressão brusca é sinal de irritação peritoneal.",
    ],
  },
  {
    id: "neurologico",
    title: "Exame neurológico",
    quizTopic: "Neurológico",
    summary: "Consciência, força, reflexos, coordenação e sinais meníngeos.",
    sections: [
      {
        title: "Consciência",
        items: [
          "Escala de Glasgow: abertura ocular (1 a 4), resposta verbal (1 a 5) e resposta motora (1 a 6).",
          "Pontuação total de 3 a 15.",
        ],
      },
      {
        title: "Motricidade e reflexos",
        items: [
          "Força muscular graduada de 0 (sem contração) a 5 (normal).",
          "Tônus: hipertonia, hipotonia ou normal.",
          "Reflexos profundos graduados de 0 a 4+: bicipital (C5-C6), tricipital (C7), patelar (L3-L4), aquileu (S1).",
        ],
      },
      {
        title: "Coordenação, equilíbrio e marcha",
        items: [
          "Índex-nariz, calcanhar-joelho e movimentos alternados avaliam o cerebelo.",
          "Observe a marcha: ceifante, atáxica, parkinsoniana, escarvante.",
        ],
      },
    ],
    maneuvers: [
      {
        name: "Sinal de Babinski",
        how: "Estimule a borda lateral da planta do pé, do calcanhar em direção aos dedos.",
        positive: "Extensão do hálux: lesão do primeiro neurônio motor (via piramidal). É normal nos primeiros meses de vida.",
      },
      {
        name: "Sinal de Romberg",
        how: "Paciente em pé, pés juntos e braços ao lado do corpo; peça para fechar os olhos.",
        positive: "Perde o equilíbrio só de olhos fechados: ataxia sensitiva (propriocepção).",
      },
      {
        name: "Rigidez de nuca, Kernig e Brudzinski",
        how: "Flexione o pescoço (rigidez e Brudzinski) ou estenda o joelho com o quadril fletido (Kernig).",
        positive: "Resistência ou dor: irritação meníngea, como na meningite.",
      },
      {
        name: "Sinal de Lasègue",
        how: "Com o paciente deitado, eleve a perna estendida.",
        positive: "Dor irradiada pelo trajeto do nervo ciático: radiculopatia lombossacra.",
      },
    ],
    keyPoints: [
      "Romberg positivo aponta para propriocepção, não para o cerebelo.",
      "Babinski em adulto indica lesão da via piramidal.",
      "Compare sempre força e reflexos entre os dois lados.",
    ],
  },
];

export function getSemiologyModule(id: string) {
  return SEMIOLOGY_MODULES.find((module) => module.id === id) ?? null;
}
