/** Casos do Simulado clínico (discursivo).
 *
 * Cada caso tem uma rubrica: o que o enunciado PEDE, com o peso de cada
 * parte (soma 100). A nota só perde pontos quando falta algo pedido ou
 * quando há uma afirmação clinicamente errada — nunca por estilo ou por
 * palavras diferentes das esperadas. `keywords` só é usado como plano B,
 * se a correção por IA estiver indisponível.
 *
 * Os casos-base ficam no código (funcionam sem nenhuma migração). Casos
 * novos gerados por IA, quando o aluno já respondeu todos estes, ficam na
 * tabela opcional `clinical_cases` (ver supabase/migrations). */

export type RubricItem = {
  id: string;
  label: string;
  points: number;
  keywords: string[];
};

export type ClinicalCase = {
  id: string;
  topic: string;
  title: string;
  prompt: string;
  asks: string[];
  rubric: RubricItem[];
  modelAnswer: string;
  explanation: string;
};

/** O que o cliente recebe durante a prova — nunca a rubrica/gabarito. */
export type PublicClinicalCase = Pick<ClinicalCase, "id" | "topic" | "title" | "prompt" | "asks">;

export function toPublicCase(c: ClinicalCase): PublicClinicalCase {
  return { id: c.id, topic: c.topic, title: c.title, prompt: c.prompt, asks: c.asks };
}

const STD_ASKS = ["Hipótese principal", "Exames prioritários", "Conduta inicial"];

export const SEED_CLINICAL_CASES: ClinicalCase[] = [
  {
    id: "case-cv",
    topic: "Cardiovascular",
    title: "Dispneia progressiva e edema",
    prompt:
      "Mulher de 58 anos, hipertensa, apresenta dispneia aos esforços, ortopneia, ganho de 3 kg em uma semana e edema bilateral. PA 162/98 mmHg, FC 108 bpm, SpO₂ 91%, B3 e crepitações bibasais. Escreva a hipótese principal, três exames prioritários e a conduta inicial justificada.",
    asks: STD_ASKS,
    rubric: [
      { id: "hyp", label: "Insuficiência cardíaca descompensada (congestiva)", points: 40, keywords: ["insuficiencia cardiaca", "ic descompensada", "icc", "edema agudo"] },
      { id: "exams", label: "Exames: ecocardiograma, ECG, BNP/NT-proBNP (raio X de tórax, eletrólitos e função renal também valem)", points: 30, keywords: ["ecocardiograma", "eco", "eletrocardiograma", "ecg", "bnp", "raio x", "radiografia"] },
      { id: "conduct", label: "Conduta: oxigênio, diurético de alça, controle pressórico/vasodilatador, monitorização", points: 30, keywords: ["diuret", "furosemida", "oxigen", "monitor", "vasodilat", "nitrato"] },
    ],
    modelAnswer:
      "IC descompensada perfil quente-úmido, provavelmente desencadeada por hipertensão. Exames: ECG, ecocardiograma, BNP/NT-proBNP, raio X de tórax, função renal e eletrólitos. Conduta: O₂ para SpO₂ ≥ 92%, cabeceira elevada, furosemida EV, vasodilatador se hipertensa, monitorização, balanço hídrico e peso diário.",
    explanation:
      "Ortopneia, ganho de peso, edema, B3 e crepitações formam o quadro de congestão por insuficiência cardíaca. A conduta trata a congestão (diurético) e a pós-carga (vasodilatador), com suporte de oxigênio.",
  },
  {
    id: "case-rp",
    topic: "Respiratório",
    title: "Dor pleurítica e hipoxemia",
    prompt:
      "Homem de 44 anos apresenta dispneia súbita e dor torácica ventilatório-dependente após viagem longa. FC 116 bpm, FR 28 irpm, SpO₂ 89%, ausculta sem consolidação. Estruture hipótese, diferenciais, investigação inicial e medida imediata de segurança.",
    asks: ["Hipótese principal", "Diferenciais", "Investigação inicial", "Medida imediata"],
    rubric: [
      { id: "hyp", label: "Tromboembolismo pulmonar", points: 35, keywords: ["tromboembol", "embolia pulmonar", "tep"] },
      { id: "diff", label: "Diferenciais: pneumotórax, síndrome coronariana, pneumonia, pericardite", points: 15, keywords: ["pneumotorax", "coronari", "infarto", "pneumonia", "pericardite"] },
      { id: "exams", label: "Investigação: escore de probabilidade (Wells), D-dímero se baixa probabilidade, angio-TC de tórax; ECG", points: 25, keywords: ["angio", "d dimero", "dimero", "wells", "ecocardiograma", "cintilografia"] },
      { id: "conduct", label: "Medida imediata: oxigênio, estabilização e anticoagulação se não houver contraindicação", points: 25, keywords: ["oxigen", "anticoag", "heparina", "estabiliz"] },
    ],
    modelAnswer:
      "TEP após imobilização prolongada. Diferenciais: pneumotórax, SCA, pneumonia, pericardite. Avaliar estabilidade, calcular Wells; alta probabilidade → angio-TC de tórax (D-dímero só se baixa/intermediária). ECG e ecocardiograma se instável. O₂, acesso venoso, monitorização e anticoagulação empírica se não houver contraindicação.",
    explanation:
      "Dispneia súbita, dor pleurítica, taquicardia e hipoxemia sem consolidação após viagem longa sugerem TEP. A investigação segue a probabilidade clínica e a anticoagulação não deve esperar a imagem quando a suspeita é alta.",
  },
  {
    id: "case-ne",
    topic: "Neurológico",
    title: "Déficit focal agudo",
    prompt:
      "Paciente de 67 anos inicia há 50 minutos fala arrastada, desvio da rima e fraqueza em braço direito. Glicemia capilar 104 mg/dL, PA 178/102 mmHg. Descreva localização provável, avaliação imediata e exames que não podem atrasar.",
    asks: ["Localização/hipótese", "Avaliação imediata", "Exames urgentes"],
    rubric: [
      { id: "hyp", label: "AVC agudo em território de artéria cerebral média esquerda (hemisfério esquerdo)", points: 35, keywords: ["avc", "acidente vascular", "cerebral media", "hemisferio esquerdo"] },
      { id: "eval", label: "Avaliação: horário do início/última vez visto bem, NIHSS, ABC, critérios para trombólise/trombectomia", points: 30, keywords: ["nihss", "horario", "tempo", "trombol", "janela", "ictus"] },
      { id: "exams", label: "Exames: TC de crânio sem contraste imediata (± angio-TC), glicemia já feita, coagulograma", points: 35, keywords: ["tomografia", "tc de cranio", "angio", "ressonancia", "coagul"] },
    ],
    modelAnswer:
      "AVC isquêmico agudo provável, território da ACM esquerda (afasia/disartria + hemiparesia direita). Confirmar horário de início, ABC, NIHSS. TC de crânio sem contraste imediata para excluir hemorragia, angio-TC se candidato a trombectomia; dentro de 4,5 h avaliar trombólise. Não reduzir PA agressivamente (só se > 185/110 para trombolisar).",
    explanation:
      "Déficit focal súbito com glicemia normal é AVC até prova em contrário. Tempo é cérebro: a neuroimagem não pode atrasar porque define trombólise.",
  },
  {
    id: "case-iam",
    topic: "Cardiovascular",
    title: "Dor torácica em aperto",
    prompt:
      "Homem de 62 anos, tabagista e diabético, com dor retroesternal em aperto há 40 minutos, irradiando para o braço esquerdo, com sudorese. PA 140/90 mmHg, FC 96 bpm. Qual a hipótese, qual o primeiro exame (e em quanto tempo) e a conduta inicial?",
    asks: STD_ASKS,
    rubric: [
      { id: "hyp", label: "Síndrome coronariana aguda / infarto agudo do miocárdio", points: 35, keywords: ["sindrome coronariana", "infarto", "iam", "sca"] },
      { id: "exams", label: "ECG em até 10 minutos; troponina seriada", points: 30, keywords: ["eletrocardiograma", "ecg", "troponina", "10 min"] },
      { id: "conduct", label: "Conduta: AAS, monitorização, acesso, nitrato se sem contraindicação, analgesia; reperfusão se supra de ST", points: 35, keywords: ["aas", "aspirina", "nitrato", "monitor", "reperfus", "angioplastia", "hemodinamica", "trombol"] },
    ],
    modelAnswer:
      "SCA (provável IAM). ECG de 12 derivações em até 10 minutos e troponina seriada. Monitorização, acesso venoso, AAS mastigado, nitrato sublingual se PA permitir e sem uso de inibidor de PDE5, analgesia, O₂ só se SpO₂ < 90%. Com supra de ST: reperfusão imediata (angioplastia primária ou trombólise).",
    explanation:
      "Dor em aperto com irradiação e sudorese em paciente de alto risco é SCA. O ECG em 10 minutos separa o IAM com supra, que precisa de reperfusão urgente.",
  },
  {
    id: "case-fa",
    topic: "Cardiovascular",
    title: "Palpitações irregulares",
    prompt:
      "Mulher de 71 anos com palpitações há 2 dias e cansaço. Pulso irregularmente irregular, FC 132 bpm, PA 124/78 mmHg, sem dor torácica. Escreva a hipótese, o exame que confirma e a conduta inicial, incluindo prevenção de complicações.",
    asks: ["Hipótese principal", "Exame confirmatório", "Conduta e prevenção"],
    rubric: [
      { id: "hyp", label: "Fibrilação atrial com alta resposta ventricular", points: 35, keywords: ["fibrilacao atrial", "fa ", "flutter"] },
      { id: "exams", label: "ECG confirma (ausência de onda P, RR irregular); TSH, eletrólitos, ecocardiograma", points: 25, keywords: ["eletrocardiograma", "ecg", "tsh", "ecocardiograma"] },
      { id: "rate", label: "Controle de frequência (betabloqueador/bloqueador de canal de cálcio) por estar estável", points: 20, keywords: ["betabloq", "metoprolol", "diltiazem", "verapamil", "controle de frequencia", "digoxina"] },
      { id: "anticoag", label: "Avaliar anticoagulação pelo CHA₂DS₂-VASc (prevenção de AVC)", points: 20, keywords: ["anticoag", "cha2ds2", "chads", "varfarina", "apixabana", "rivaroxabana"] },
    ],
    modelAnswer:
      "FA com alta resposta, hemodinamicamente estável. ECG confirma; TSH, eletrólitos e ecocardiograma. Controle de frequência com betabloqueador ou diltiazem. CHA₂DS₂-VASc ≥ 3 (idade ≥ 65, sexo feminino) → anticoagulação. Duração > 48 h: não cardioverter sem anticoagular ou excluir trombo no ecotransesofágico.",
    explanation:
      "Pulso irregularmente irregular é a marca da FA. Em paciente estável, a prioridade é controlar a frequência e prevenir AVC com anticoagulação guiada por escore.",
  },
  {
    id: "case-pneumonia",
    topic: "Respiratório",
    title: "Febre, tosse e crepitação localizada",
    prompt:
      "Homem de 55 anos com febre de 39 °C, tosse produtiva e dor ao respirar há 3 dias. FR 24 irpm, SpO₂ 93%, PA 118/74 mmHg, sem confusão mental. Estertores crepitantes e macicez em base direita. Escreva hipótese, como decidir onde tratar e a conduta inicial.",
    asks: ["Hipótese principal", "Estratificação de gravidade", "Conduta inicial"],
    rubric: [
      { id: "hyp", label: "Pneumonia adquirida na comunidade (base direita)", points: 35, keywords: ["pneumonia", "pac"] },
      { id: "severity", label: "Estratificar gravidade (CURB-65 ou similar) para decidir ambulatório x internação", points: 25, keywords: ["curb", "crb", "psi", "gravidade", "internac", "ambulatori"] },
      { id: "exams", label: "Raio X de tórax (± hemograma, PCR, ureia)", points: 15, keywords: ["raio x", "radiografia", "rx", "hemograma", "pcr", "ureia"] },
      { id: "conduct", label: "Antibiótico empírico adequado (ex.: amoxicilina ± macrolídeo; beta-lactâmico + macrolídeo se internado)", points: 25, keywords: ["antibiot", "amoxicilina", "azitromicina", "claritromicina", "macrolideo", "ceftriaxona", "levofloxacino"] },
    ],
    modelAnswer:
      "PAC em base direita. CURB-65 = 0–1 (sem confusão, ureia a checar, FR < 30, PA normal, idade < 65) → pode tratar ambulatorialmente se SpO₂ aceitável e boa adesão. Raio X de tórax confirma. Antibiótico empírico: amoxicilina (± macrolídeo se comorbidade) ou, se internar, ceftriaxona + azitromicina; reavaliar em 48–72 h.",
    explanation:
      "Febre, tosse produtiva, dor pleurítica e síndrome de consolidação (crepitações + macicez) definem pneumonia. A decisão de onde tratar vem do escore de gravidade.",
  },
  {
    id: "case-asma",
    topic: "Respiratório",
    title: "Sibilância e fala entrecortada",
    prompt:
      "Jovem de 22 anos, asmática, chega com falta de ar há 6 horas, fala em frases curtas, sibilos difusos e uso de musculatura acessória. FR 30 irpm, SpO₂ 90%, pico de fluxo 45% do previsto. Classifique a crise e descreva a conduta inicial e os critérios de piora.",
    asks: ["Classificação da crise", "Conduta inicial", "Sinais de alarme"],
    rubric: [
      { id: "hyp", label: "Exacerbação de asma grave (moderada a grave)", points: 30, keywords: ["asma grave", "crise grave", "exacerbacao", "crise de asma", "asma"] },
      { id: "conduct", label: "Beta-2 de curta ação inalatório repetido + ipratrópio, corticoide sistêmico, oxigênio (alvo 93–95%)", points: 45, keywords: ["salbutamol", "fenoterol", "beta 2", "beta2", "broncodilat", "ipratropio", "corticoide", "prednisona", "metilprednisolona", "hidrocortisona", "oxigen"] },
      { id: "alarm", label: "Sinais de alarme: tórax silencioso, cianose, sonolência/confusão, bradicardia, hipercapnia → UTI/intubação; considerar sulfato de magnésio", points: 25, keywords: ["torax silencioso", "silencio", "cianose", "sonolen", "confus", "magnesio", "intubac", "uti", "hipercapnia"] },
    ],
    modelAnswer:
      "Crise de asma grave (fala entrecortada, musculatura acessória, PFE < 50%, SpO₂ 90%). O₂ para SpO₂ 93–95%, salbutamol inalatório repetido (3 doses na 1ª hora) + ipratrópio, corticoide sistêmico precoce, considerar sulfato de magnésio EV. Alarme: tórax silencioso, cianose, rebaixamento, exaustão, PaCO₂ normal/alta → UTI e possível intubação.",
    explanation:
      "A gravidade da crise é clínica (fala, musculatura, PFE, SpO₂). O tratamento combina broncodilatador repetido, anticolinérgico e corticoide sistêmico; piora silenciosa é sinal de falência.",
  },
  {
    id: "case-pneumotorax",
    topic: "Respiratório",
    title: "Dor súbita em jovem longilíneo",
    prompt:
      "Homem de 24 anos, alto e magro, tabagista, sente dor torácica súbita à direita e falta de ar ao subir escadas. Murmúrio vesicular abolido e hipertimpanismo à direita, traqueia centrada, PA normal. Hipótese, exame de confirmação e conduta conforme o tamanho.",
    asks: STD_ASKS,
    rubric: [
      { id: "hyp", label: "Pneumotórax espontâneo primário à direita", points: 40, keywords: ["pneumotorax"] },
      { id: "exams", label: "Raio X de tórax (ou ultrassom/TC) para confirmar e medir", points: 25, keywords: ["raio x", "radiografia", "rx", "ultrassom", "tomografia"] },
      { id: "conduct", label: "Pequeno e estável: observação + O₂; grande/sintomático: aspiração por agulha ou dreno torácico; sinais de hipertensivo → descompressão imediata", points: 35, keywords: ["dreno", "drenagem", "aspiracao", "puncao", "observ", "oxigen", "descompress"] },
    ],
    modelAnswer:
      "Pneumotórax espontâneo primário à direita (sem sinais de hipertensivo: traqueia centrada, PA normal). Raio X de tórax confirma e estima o tamanho. Pequeno e pouco sintomático: observação com O₂ e controle radiológico; grande ou sintomático: aspiração por agulha ou drenagem torácica. Orientar cessação do tabagismo.",
    explanation:
      "MV abolido com hipertimpanismo é a assinatura do ar na pleura. O tratamento depende do tamanho e dos sintomas; desvio de traqueia e hipotensão indicariam pneumotórax hipertensivo.",
  },
  {
    id: "case-dpoc",
    topic: "Respiratório",
    title: "Tabagista com piora da tosse",
    prompt:
      "Homem de 68 anos, tabagista de 50 maços-ano, com piora da dispneia e aumento do volume e purulência do escarro há 4 dias. Sibilos difusos, MV diminuído, SpO₂ 86% em ar ambiente. Hipótese, exames iniciais e conduta, incluindo cuidado com o oxigênio.",
    asks: STD_ASKS,
    rubric: [
      { id: "hyp", label: "Exacerbação de DPOC (provavelmente infecciosa)", points: 35, keywords: ["dpoc", "doenca pulmonar obstrutiva", "exacerbac"] },
      { id: "exams", label: "Gasometria arterial, raio X de tórax (± hemograma, ECG)", points: 20, keywords: ["gasometria", "raio x", "radiografia", "rx"] },
      { id: "conduct", label: "Broncodilatador (beta-2 + anticolinérgico), corticoide sistêmico, antibiótico (escarro purulento)", points: 30, keywords: ["broncodilat", "salbutamol", "ipratropio", "corticoide", "prednisona", "antibiot", "amoxicilina", "azitromicina"] },
      { id: "o2", label: "Oxigênio controlado com alvo de SpO₂ 88–92% (risco de hipercapnia); VNI se acidose respiratória", points: 15, keywords: ["88", "92", "controlad", "hipercapnia", "vni", "ventilacao nao invasiva", "bipap"] },
    ],
    modelAnswer:
      "Exacerbação de DPOC com critérios de Anthonisen (dispneia, volume e purulência do escarro). Gasometria arterial e raio X. Salbutamol + ipratrópio, prednisona 5 dias, antibiótico. O₂ controlado para SpO₂ 88–92%; VNI se pH < 7,35 com PaCO₂ elevada.",
    explanation:
      "Em DPOC, oxigênio em excesso pode piorar a retenção de CO₂ — por isso o alvo é 88–92%. Escarro purulento justifica antibiótico.",
  },
  {
    id: "case-meningite",
    topic: "Neurológico",
    title: "Febre, cefaleia e rigidez de nuca",
    prompt:
      "Estudante de 19 anos com febre alta, cefaleia intensa e vômitos há 12 horas. Rigidez de nuca, Kernig positivo, petéquias em membros inferiores. Hipótese, exames e conduta, deixando claro o que não pode atrasar.",
    asks: STD_ASKS,
    rubric: [
      { id: "hyp", label: "Meningite bacteriana (provável meningocócica, pelas petéquias)", points: 35, keywords: ["meningite", "meningococ", "meningococcemia"] },
      { id: "exams", label: "Hemoculturas e punção lombar (líquor); TC antes só se sinais focais/rebaixamento/papiledema", points: 25, keywords: ["puncao lombar", "liquor", "lcr", "hemocultura", "tomografia"] },
      { id: "conduct", label: "Antibiótico empírico imediato (ceftriaxona) ± dexametasona, sem atrasar pela punção/imagem; isolamento e quimioprofilaxia dos contactantes", points: 40, keywords: ["ceftriaxona", "antibiot", "dexametasona", "isolamento", "profilaxia", "rifampicina"] },
    ],
    modelAnswer:
      "Meningite bacteriana, provável meningococo (petéquias). Colher hemoculturas e iniciar ceftriaxona EV imediatamente (+ dexametasona antes ou junto da 1ª dose); punção lombar logo que possível, TC antes apenas se déficit focal, convulsão, rebaixamento ou papiledema. Isolamento respiratório por gotículas e quimioprofilaxia dos contactantes íntimos.",
    explanation:
      "Febre + cefaleia + rigidez de nuca é meningite até prova em contrário; com petéquias, pensar em meningococo. O antibiótico nunca espera a punção ou a tomografia.",
  },
  {
    id: "case-convulsao",
    topic: "Neurológico",
    title: "Crise que não para",
    prompt:
      "Homem de 35 anos, epiléptico, chega em crise tônico-clônica generalizada que já dura 7 minutos, sem recuperar a consciência entre os abalos. Glicemia capilar 92 mg/dL. Defina o quadro e descreva a sequência de tratamento.",
    asks: ["Definição do quadro", "Medidas iniciais", "Sequência de medicamentos"],
    rubric: [
      { id: "hyp", label: "Estado de mal epiléptico (crise ≥ 5 min ou crises sem recuperação)", points: 35, keywords: ["estado de mal", "status epilept", "mal epileptico"] },
      { id: "initial", label: "ABC, decúbito lateral, O₂, acesso venoso, monitorização, glicemia (tiamina se suspeita)", points: 25, keywords: ["via aerea", "abc", "decubito lateral", "oxigen", "acesso", "monitor", "tiamina"] },
      { id: "drugs", label: "Benzodiazepínico primeiro (diazepam/midazolam/lorazepam); se persistir, fenitoína/fosfenitoína, valproato ou levetiracetam; refratário → UTI/anestésicos", points: 40, keywords: ["benzodiazep", "diazepam", "midazolam", "lorazepam", "fenitoina", "levetiracetam", "valproato", "fenobarbital"] },
    ],
    modelAnswer:
      "Estado de mal epiléptico. ABC, decúbito lateral, O₂, acesso venoso, monitorização; glicemia normal (se baixa, glicose; tiamina antes em etilistas). Benzodiazepínico EV (diazepam ou lorazepam) ou midazolam IM se sem acesso; persistindo, fenitoína/fosfenitoína (ou levetiracetam/valproato); refratário → UTI, intubação e infusão de midazolam/propofol.",
    explanation:
      "Crise acima de 5 minutos já é estado de mal e causa lesão neuronal. O tratamento é escalonado e tem tempo: benzodiazepínico, depois anticonvulsivante de segunda linha, depois anestésico.",
  },
  {
    id: "case-cefaleia-hsa",
    topic: "Neurológico",
    title: "A pior dor de cabeça da vida",
    prompt:
      "Mulher de 48 anos sente cefaleia súbita e explosiva durante exercício, a 'pior da vida', com vômitos e leve rigidez de nuca, sem febre. Hipótese, exames na ordem certa e conduta inicial.",
    asks: STD_ASKS,
    rubric: [
      { id: "hyp", label: "Hemorragia subaracnoide (ruptura de aneurisma)", points: 40, keywords: ["hemorragia subaracnoide", "hsa", "aneurisma"] },
      { id: "exams", label: "TC de crânio sem contraste urgente; se normal e alta suspeita, punção lombar (xantocromia); angio-TC/arteriografia", points: 35, keywords: ["tomografia", "tc de cranio", "puncao lombar", "liquor", "xantocrom", "angio", "arteriografia"] },
      { id: "conduct", label: "Analgesia, controle de PA, nimodipino, avaliação neurocirúrgica", points: 25, keywords: ["neurocirurg", "nimodipino", "controle press", "analges", "pressao arterial"] },
    ],
    modelAnswer:
      "HSA por provável ruptura de aneurisma. TC de crânio sem contraste imediata; se negativa e suspeita alta, punção lombar (hemácias/xantocromia). Angio-TC para localizar o aneurisma. Repouso, analgesia, controle de PA, nimodipino, avaliação neurocirúrgica para tratamento do aneurisma.",
    explanation:
      "Cefaleia em trovoada é sinal de alarme. A TC precoce é muito sensível; a punção cobre os casos de TC normal.",
  },
  {
    id: "case-apendicite",
    topic: "Abdome",
    title: "Dor que migrou para a fossa ilíaca",
    prompt:
      "Jovem de 20 anos com dor periumbilical há 18 horas que migrou para a fossa ilíaca direita, anorexia, náusea e febre de 38 °C. Blumberg positivo. Hipótese, exames e conduta.",
    asks: STD_ASKS,
    rubric: [
      { id: "hyp", label: "Apendicite aguda", points: 40, keywords: ["apendicite"] },
      { id: "exams", label: "Hemograma (leucocitose), PCR; imagem se dúvida (ultrassom ou TC); beta-hCG em mulheres", points: 25, keywords: ["hemograma", "leucocit", "pcr", "ultrassom", "tomografia", "beta hcg", "alvarado"] },
      { id: "conduct", label: "Jejum, hidratação, analgesia, antibiótico e apendicectomia (avaliação cirúrgica)", points: 35, keywords: ["apendicectomia", "cirurg", "jejum", "antibiot", "analges", "hidrata"] },
    ],
    modelAnswer:
      "Apendicite aguda (dor migratória, anorexia, febre, Blumberg). Hemograma e PCR; imagem (US ou TC) se houver dúvida; beta-hCG em mulher em idade fértil. Jejum, hidratação EV, analgesia, antibiótico profilático e apendicectomia.",
    explanation:
      "A migração da dor periumbilical para a FID com irritação peritoneal é clássica. Analgesia não mascara o diagnóstico e não deve ser negada.",
  },
  {
    id: "case-pancreatite",
    topic: "Abdome",
    title: "Dor em faixa após festa",
    prompt:
      "Homem de 45 anos, etilista, com dor epigástrica intensa em faixa irradiando para o dorso, vômitos, iniciada após ingestão alcoólica. FC 112 bpm. Hipótese, critérios diagnósticos, exames e conduta inicial.",
    asks: STD_ASKS,
    rubric: [
      { id: "hyp", label: "Pancreatite aguda (alcoólica)", points: 35, keywords: ["pancreatite"] },
      { id: "exams", label: "Lipase/amilase (> 3x o normal); USG de abdome (litíase); TC só se dúvida ou após 72 h para complicações", points: 30, keywords: ["lipase", "amilase", "ultrassom", "usg", "tomografia"] },
      { id: "conduct", label: "Hidratação vigorosa com cristaloide, analgesia, jejum curto/dieta precoce, avaliação de gravidade", points: 35, keywords: ["hidrata", "cristaloide", "ringer", "soro", "analges", "dieta", "jejum", "gravidade", "ranson", "bisap"] },
    ],
    modelAnswer:
      "Pancreatite aguda alcoólica. Diagnóstico com 2 de 3: dor típica, lipase/amilase > 3× o normal, imagem compatível. USG para excluir litíase biliar; TC só se dúvida ou suspeita de necrose após 72 h. Hidratação com Ringer lactato guiada por diurese, analgesia, dieta oral precoce assim que tolerar, estratificar gravidade (BISAP/Ranson, PCR).",
    explanation:
      "Dor em faixa com irradiação dorsal após álcool é a apresentação clássica. A hidratação precoce é a medida que mais muda o desfecho.",
  },
  {
    id: "case-colecistite",
    topic: "Abdome",
    title: "Dor no hipocôndrio após gordura",
    prompt:
      "Mulher de 42 anos, obesa, com dor em hipocôndrio direito há 2 dias após refeição gordurosa, febre de 38,3 °C e Murphy positivo. Sem icterícia. Hipótese, exame de imagem e conduta.",
    asks: STD_ASKS,
    rubric: [
      { id: "hyp", label: "Colecistite aguda calculosa", points: 40, keywords: ["colecistite"] },
      { id: "exams", label: "Ultrassom de abdome (parede espessada, cálculo, Murphy ultrassonográfico); hemograma, bilirrubinas, enzimas hepáticas", points: 30, keywords: ["ultrassom", "usg", "ecografia", "hemograma", "bilirrubina", "transaminase", "fosfatase"] },
      { id: "conduct", label: "Jejum, hidratação, analgesia, antibiótico e colecistectomia precoce", points: 30, keywords: ["colecistectomia", "cirurg", "antibiot", "jejum", "analges", "hidrata"] },
    ],
    modelAnswer:
      "Colecistite aguda calculosa. USG de abdome confirma; hemograma, bilirrubinas, enzimas canaliculares. Jejum, hidratação, analgesia, antibiótico e colecistectomia videolaparoscópica precoce (idealmente em até 72 h).",
    explanation:
      "Dor em HCD com febre e Murphy positivo indica inflamação da vesícula. Sem icterícia, coledocolitíase/colangite é menos provável.",
  },
  {
    id: "case-hda",
    topic: "Abdome",
    title: "Vômito com sangue",
    prompt:
      "Homem de 58 anos, em uso de anti-inflamatório para dor no joelho, apresenta hematêmese e melena. PA 92/60 mmHg, FC 118 bpm, mucosas descoradas. Hipótese, prioridades iniciais e exame definitivo.",
    asks: ["Hipótese principal", "Prioridades iniciais", "Exame definitivo"],
    rubric: [
      { id: "hyp", label: "Hemorragia digestiva alta por úlcera péptica (associada a AINE), com instabilidade", points: 30, keywords: ["hemorragia digestiva alta", "hda", "ulcera", "peptica"] },
      { id: "resus", label: "Estabilização: 2 acessos calibrosos, cristaloide, tipagem e transfusão se necessário (Hb < 7), jejum", points: 35, keywords: ["acesso", "cristaloide", "volume", "transfus", "hemoconcentrado", "tipagem", "ressuscit"] },
      { id: "ppi", label: "Inibidor de bomba de prótons EV, suspender AINE", points: 15, keywords: ["omeprazol", "pantoprazol", "inibidor de bomba", "ibp", "suspender"] },
      { id: "egd", label: "Endoscopia digestiva alta em até 24 h (terapêutica)", points: 20, keywords: ["endoscopia", "eda"] },
    ],
    modelAnswer:
      "HDA, provável úlcera péptica por AINE, com instabilidade hemodinâmica. Dois acessos calibrosos, cristaloide, hemograma, tipagem, coagulograma; transfundir se Hb < 7 (ou < 8 em coronariopata). IBP EV em bolus, suspender AINE, escore de Glasgow-Blatchford. EDA em até 24 h (mais precoce se instável) para diagnóstico e hemostasia.",
    explanation:
      "Hematêmese e melena com taquicardia e hipotensão: primeiro estabilizar, depois localizar. A endoscopia é diagnóstica e terapêutica.",
  },
  {
    id: "case-cad",
    topic: "Endócrino",
    title: "Sede, poliúria e respiração profunda",
    prompt:
      "Jovem de 17 anos com poliúria, polidipsia e perda de peso há 3 semanas, hoje com dor abdominal, vômitos e respiração rápida e profunda. Glicemia capilar 'HI'. Hipótese, exames e pilares do tratamento.",
    asks: STD_ASKS,
    rubric: [
      { id: "hyp", label: "Cetoacidose diabética (abertura de DM1)", points: 35, keywords: ["cetoacidose", "cad"] },
      { id: "exams", label: "Gasometria (acidose), cetonemia/cetonúria, eletrólitos (potássio), glicemia, função renal, ânion gap", points: 25, keywords: ["gasometria", "ceton", "potassio", "eletrolit", "anion gap", "sodio"] },
      { id: "conduct", label: "Hidratação vigorosa, insulina regular EV contínua após checar potássio, reposição de potássio, monitorização e busca do fator precipitante", points: 40, keywords: ["hidrata", "soro", "insulina", "potassio", "reposic", "monitor"] },
    ],
    modelAnswer:
      "CAD como abertura de DM1. Gasometria, cetonemia, eletrólitos, glicemia, ureia/creatinina, ânion gap. SF 0,9% vigoroso na 1ª hora; checar potássio antes da insulina (K < 3,3: repor antes); insulina regular EV contínua; repor potássio; quando glicemia ~200–250 mg/dL, soro glicosado; monitorizar glicemia horária e eletrólitos.",
    explanation:
      "Respiração de Kussmaul, dor abdominal e hiperglicemia em jovem com sintomas clássicos de diabetes indicam CAD. O potássio é o ponto de segurança antes da insulina.",
  },
  {
    id: "case-hipoglicemia",
    topic: "Endócrino",
    title: "Idoso confuso e suado",
    prompt:
      "Idoso de 76 anos, diabético em uso de glibenclamida, é trazido sudorético e confuso. Glicemia capilar 38 mg/dL, consegue engolir com dificuldade. Hipótese, tratamento imediato e cuidados após a correção.",
    asks: ["Hipótese", "Tratamento imediato", "Cuidados após correção"],
    rubric: [
      { id: "hyp", label: "Hipoglicemia grave por sulfonilureia", points: 30, keywords: ["hipoglicemia"] },
      { id: "treat", label: "Glicose EV (glicose 50%) se rebaixado/sem deglutição segura; oral só se seguro; glucagon IM se sem acesso", points: 40, keywords: ["glicose", "glicosado", "50%", "glucagon", "dextrose"] },
      { id: "after", label: "Observação prolongada/internação (sulfonilureia tem ação longa, risco de recorrência), soro glicosado contínuo, revisar/suspender glibenclamida", points: 30, keywords: ["observ", "internac", "recorr", "suspender", "glibenclamida", "soro glicosado", "monitor"] },
    ],
    modelAnswer:
      "Hipoglicemia grave por sulfonilureia. Com confusão e deglutição insegura: glicose 50% EV (ou glucagon IM se sem acesso). Após correção: alimentação, soro glicosado contínuo e glicemias seriadas por 24 h ou mais, porque a glibenclamida tem ação prolongada; rever o esquema (trocar por fármaco com menor risco no idoso).",
    explanation:
      "Sulfonilureias causam hipoglicemias prolongadas e recorrentes, sobretudo em idosos — corrigir uma vez não basta.",
  },
  {
    id: "case-pielonefrite",
    topic: "Renal",
    title: "Febre e dor lombar",
    prompt:
      "Mulher de 29 anos com disúria há 3 dias e, desde ontem, febre de 39 °C, calafrios e dor lombar à esquerda. Giordano positivo à esquerda, PA normal. Hipótese, exames e tratamento.",
    asks: STD_ASKS,
    rubric: [
      { id: "hyp", label: "Pielonefrite aguda à esquerda", points: 40, keywords: ["pielonefrite", "itu alta", "infeccao urinaria alta"] },
      { id: "exams", label: "Urina tipo 1 e urocultura com antibiograma; beta-hCG; hemograma/função renal; imagem se complicada", points: 25, keywords: ["urocultura", "urina tipo", "eas", "beta hcg", "hemograma", "creatinina", "ultrassom"] },
      { id: "conduct", label: "Antibiótico com boa cobertura (ex.: ciprofloxacino ou ceftriaxona), hidratação, analgesia; internar se grave/vômitos/gestante", points: 35, keywords: ["antibiot", "ciprofloxacino", "ceftriaxona", "levofloxacino", "hidrata", "analges", "internac"] },
    ],
    modelAnswer:
      "Pielonefrite aguda não complicada à esquerda. Urina 1, urocultura com antibiograma (antes do antibiótico), beta-hCG. Tratamento ambulatorial se tolerar via oral: ciprofloxacino 7 dias (ou ceftriaxona dose inicial e ajuste pela cultura); internar se sepse, vômitos persistentes, gestação ou falha.",
    explanation:
      "Febre, dor lombar e Giordano positivo após sintomas urinários baixos indicam infecção ascendente até o rim.",
  },
  {
    id: "case-sepse",
    topic: "Infectologia",
    title: "Idosa febril e hipotensa",
    prompt:
      "Idosa de 80 anos com febre, confusão e diminuição da urina há 1 dia; urina turva. PA 84/50 mmHg, FC 120 bpm, FR 26 irpm. Hipótese e o que fazer na primeira hora.",
    asks: ["Hipótese principal", "Medidas da primeira hora"],
    rubric: [
      { id: "hyp", label: "Sepse/choque séptico de foco urinário", points: 30, keywords: ["sepse", "choque septico", "septic"] },
      { id: "labs", label: "Lactato e hemoculturas (+ urocultura) antes do antibiótico", points: 25, keywords: ["lactato", "hemocultura", "urocultura", "cultura"] },
      { id: "abx", label: "Antibiótico de amplo espectro na primeira hora", points: 25, keywords: ["antibiot", "amplo espectro", "ceftriaxona", "piperacilina", "meropenem"] },
      { id: "fluids", label: "Cristaloide 30 mL/kg e vasopressor (noradrenalina) se PAM < 65 após volume", points: 20, keywords: ["30 ml", "cristaloide", "volume", "soro", "noradrenalina", "vasopressor", "pam"] },
    ],
    modelAnswer:
      "Choque séptico de provável foco urinário. Pacote da 1ª hora: lactato, hemoculturas e urocultura, antibiótico de amplo espectro EV, cristaloide 30 mL/kg se hipotensão ou lactato ≥ 4, noradrenalina se PAM < 65 mmHg apesar do volume. Monitorizar diurese, reavaliar perfusão.",
    explanation:
      "Hipotensão, taquicardia, taquipneia e confusão com foco infeccioso é sepse grave/choque. Cada hora de atraso no antibiótico aumenta a mortalidade.",
  },
  {
    id: "case-dengue",
    topic: "Infectologia",
    title: "Febre alta e dor no corpo no verão",
    prompt:
      "Homem de 32 anos com febre alta há 4 dias, dor retro-orbitária e mialgia intensa; hoje a febre baixou, mas surgiu dor abdominal intensa e vômitos persistentes. Prova do laço positiva. Hipótese, classificação e conduta.",
    asks: ["Hipótese e classificação", "Exames", "Conduta"],
    rubric: [
      { id: "hyp", label: "Dengue com sinais de alarme (grupo C)", points: 40, keywords: ["dengue"] },
      { id: "alarm", label: "Reconhecer os sinais de alarme (dor abdominal intensa, vômitos persistentes, na defervescência)", points: 15, keywords: ["sinal de alarme", "sinais de alarme", "grupo c", "defervesc"] },
      { id: "exams", label: "Hemograma com hematócrito e plaquetas seriados (± sorologia/NS1, albumina, transaminases)", points: 20, keywords: ["hematocrito", "plaqueta", "hemograma", "ns1", "sorologia"] },
      { id: "conduct", label: "Internação e hidratação venosa com reavaliação frequente; evitar AINE/AAS", points: 25, keywords: ["internac", "hidrata", "soro", "cristaloide", "evitar", "aine", "aas", "ibuprofeno"] },
    ],
    modelAnswer:
      "Dengue com sinais de alarme (grupo C): dor abdominal intensa e vômitos persistentes na fase de defervescência. Hemograma com hematócrito e plaquetas, repetidos; NS1/sorologia conforme o dia. Internação, hidratação EV (10 mL/kg/h na 1ª hora, reavaliar), sintomáticos com dipirona/paracetamol, nunca AINE ou AAS.",
    explanation:
      "A fase crítica da dengue começa quando a febre cede: é quando surgem extravasamento plasmático e os sinais de alarme.",
  },
  {
    id: "case-anafilaxia",
    topic: "Respiratório",
    title: "Urticária e falta de ar após picada",
    prompt:
      "Mulher de 30 anos picada por abelha há 10 minutos, com urticária difusa, edema de lábios, rouquidão, sibilos e PA 86/52 mmHg. Hipótese e tratamento imediato, na ordem de prioridade.",
    asks: ["Hipótese", "Tratamento imediato"],
    rubric: [
      { id: "hyp", label: "Anafilaxia (choque anafilático)", points: 30, keywords: ["anafilax", "choque anafilatico"] },
      { id: "adrenaline", label: "Adrenalina IM (0,5 mg na face anterolateral da coxa) imediatamente, repetível", points: 40, keywords: ["adrenalina", "epinefrina"] },
      { id: "support", label: "Via aérea/O₂, decúbito com pernas elevadas, cristaloide; adjuvantes (anti-histamínico, corticoide, broncodilatador) e observação", points: 30, keywords: ["oxigen", "via aerea", "cristaloide", "volume", "anti histamin", "antihistamin", "corticoide", "salbutamol", "observ"] },
    ],
    modelAnswer:
      "Anafilaxia com comprometimento respiratório e hipotensão. Adrenalina 0,5 mg IM na coxa já, repetir a cada 5–15 min se necessário. Via aérea e O₂ (rouquidão = risco de edema de glote), decúbito com membros elevados, cristaloide em bolus. Depois: anti-histamínico, corticoide, salbutamol para broncoespasmo; observação de 6–24 h e prescrição de adrenalina autoinjetável.",
    explanation:
      "Adrenalina IM é o único tratamento que reverte a anafilaxia; anti-histamínico e corticoide são adjuvantes e nunca a substituem.",
  },
  {
    id: "case-anemia",
    topic: "Hematologia",
    title: "Cansaço e palidez em mulher jovem",
    prompt:
      "Mulher de 34 anos com cansaço progressivo, menstruação abundante e vontade de comer gelo. Palidez, unhas quebradiças, sopro sistólico leve. Hipótese, exames que confirmam e conduta.",
    asks: STD_ASKS,
    rubric: [
      { id: "hyp", label: "Anemia ferropriva por perda menstrual", points: 40, keywords: ["ferropriva", "deficiencia de ferro", "anemia"] },
      { id: "exams", label: "Hemograma (microcítica/hipocrômica), ferritina baixa, ferro/saturação de transferrina, reticulócitos", points: 30, keywords: ["hemograma", "ferritina", "ferro serico", "transferrina", "vcm", "microcit"] },
      { id: "conduct", label: "Reposição de ferro e investigação/tratamento da causa (avaliação ginecológica do sangramento)", points: 30, keywords: ["sulfato ferroso", "ferro", "reposic", "ginecolog", "causa", "sangramento"] },
    ],
    modelAnswer:
      "Anemia ferropriva por menorragia (pagofagia, coiloníquia, sopro funcional). Hemograma com anemia microcítica e hipocrômica, ferritina baixa, saturação de transferrina baixa. Sulfato ferroso oral (ferro EV se intolerância/má absorção) e investigar a menorragia com ginecologia.",
    explanation:
      "Perda crônica de sangue esgota o ferro. Tratar só a anemia sem resolver a causa leva à recidiva.",
  },
  {
    id: "case-hipotireoidismo",
    topic: "Endócrino",
    title: "Frio, ganho de peso e lentidão",
    prompt:
      "Mulher de 52 anos com cansaço, intolerância ao frio, ganho de 6 kg, constipação e pele seca há meses. FC 56 bpm, reflexos com relaxamento lento. Hipótese, exames e tratamento.",
    asks: STD_ASKS,
    rubric: [
      { id: "hyp", label: "Hipotireoidismo primário (provável tireoidite de Hashimoto)", points: 40, keywords: ["hipotireoidismo", "hashimoto"] },
      { id: "exams", label: "TSH elevado e T4 livre baixo; anti-TPO", points: 30, keywords: ["tsh", "t4", "anti tpo", "antitpo", "anti-tpo"] },
      { id: "conduct", label: "Levotiroxina em jejum com dose ajustada pelo TSH (reavaliar em 6–8 semanas)", points: 30, keywords: ["levotiroxina", "tiroxina", "t4 livre", "jejum", "6 a 8", "ajust"] },
    ],
    modelAnswer:
      "Hipotireoidismo primário, provável Hashimoto. TSH elevado com T4 livre baixo; anti-TPO positivo sugere a causa autoimune. Levotiroxina em jejum (dose menor e progressiva se idosa ou coronariopata), dosar TSH em 6–8 semanas.",
    explanation:
      "Sintomas de metabolismo lento com bradicardia e relaxamento lento dos reflexos são típicos. O TSH é o melhor exame de rastreio e de controle.",
  },
  {
    id: "case-colica-renal",
    topic: "Renal",
    title: "Dor lombar em cólica",
    prompt:
      "Homem de 38 anos com dor lombar à direita, em cólica, de início súbito, irradiando para a virilha, inquieto, com náuseas. Urina com hematúria microscópica, afebril. Hipótese, exames e conduta, incluindo sinais que mudam a urgência.",
    asks: ["Hipótese principal", "Exames", "Conduta e sinais de alerta"],
    rubric: [
      { id: "hyp", label: "Cólica renal por litíase ureteral à direita", points: 35, keywords: ["colica renal", "litiase", "calculo", "nefrolit", "urolit"] },
      { id: "exams", label: "TC de abdome sem contraste (padrão) ou ultrassom; urina 1, creatinina", points: 25, keywords: ["tomografia", "tc sem contraste", "ultrassom", "urina", "creatinina"] },
      { id: "conduct", label: "Analgesia (AINE ± opioide), antiemético, terapia expulsiva (alfabloqueador) para cálculos pequenos", points: 25, keywords: ["aine", "cetorolaco", "diclofenaco", "analges", "opioide", "tansulosina", "alfabloq", "dipirona"] },
      { id: "alarm", label: "Urgência urológica se febre/infecção (obstrução infectada), rim único, insuficiência renal ou dor refratária", points: 15, keywords: ["febre", "infec", "obstru", "rim unico", "desobstru", "urolog", "duplo j"] },
    ],
    modelAnswer:
      "Cólica renal por cálculo ureteral direito. TC de abdome sem contraste (ou US), urina 1, creatinina. AINE EV (± opioide), antiemético; cálculo < 10 mm: terapia expulsiva com tansulosina. Febre com obstrução, rim único, lesão renal ou dor refratária → desobstrução urológica urgente.",
    explanation:
      "Dor em cólica com irradiação para a virilha, inquietude e hematúria é típica. Obstrução + infecção é emergência.",
  },
];

/** Normalização usada pela correção de plano B por palavras-chave. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9%\s]/g, " ")
    .replace(/\s+/g, " ");
}
