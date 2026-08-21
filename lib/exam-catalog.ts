export type ExamCatalogEntry = {
  id: string;
  label: string;
  aliases: string[];
  excludeIfContains?: string[];
};

export const EXAM_CATALOG: ExamCatalogEntry[] = [
  { id: "hemograma", label: "Hemograma", aliases: ["hemograma", "hemograma completo"] },
  { id: "ferritina", label: "Ferritina", aliases: ["ferritina"] },
  { id: "ferro_serico_transferrina", label: "Ferro sérico e saturação de transferrina", aliases: ["ferro serico e saturacao de transferrina", "ferro serico", "saturacao de transferrina"] },
  { id: "us_tc_abdome_apendicite", label: "Ultrassonografia/TC de abdome", aliases: ["ultrassonografia de abdome", "ultrassom de abdome", "usg de abdome", "ultrassom abdome", "usg abdome"] },
  { id: "urina_eas", label: "Exame de urina", aliases: ["exame de urina", "urina tipo 1", "sumario de urina", "eas"] },
  { id: "fator_reumatoide", label: "Fator reumatoide", aliases: ["fator reumatoide"] },
  { id: "anti_ccp", label: "Anti-CCP", aliases: ["anti-ccp", "anti ccp", "peptideo citrulinado"] },
  { id: "pcr_vhs", label: "PCR e VHS", aliases: ["pcr e vhs", "vhs"] },
  { id: "rx_maos", label: "Radiografia de mãos", aliases: ["radiografia de maos", "raio x das maos", "raio-x das maos", "raio x de maos"] },
  { id: "rx_torax", label: "Radiografia de tórax", aliases: ["radiografia de torax", "raio x de torax", "raio-x de torax", "rx de torax", "rx torax"] },
  { id: "gasometria_arterial", label: "Gasometria arterial", aliases: ["gasometria arterial", "gasometria"] },
  {
    id: "ct_head_noncontrast",
    label: "TC de crânio sem contraste",
    aliases: [
      "tc de cranio sem contraste",
      "tomografia de cranio sem contraste",
      "tomografia computadorizada de cranio sem contraste",
      "tomografia computadorizada de cranio",
      "tomografia de cranio",
      "tc de cranio",
      "tc cranio",
    ],
    excludeIfContains: ["angio", "angiotc", "cta", "angiotomografia"],
  },
  {
    id: "cta_head_neck",
    label: "Angio-TC de crânio e pescoço",
    aliases: [
      "angio-tc de cranio e pescoco",
      "angio tc de cranio e pescoco",
      "angiotc de cranio e pescoco",
      "angiotomografia de cranio e pescoco",
      "angio tomografia de cranio e pescoco",
      "cta de cranio e pescoco",
      "angiotomografia cranio e pescoco",
      "angio-tc cranio pescoco",
    ],
  },
  { id: "glicemia_capilar", label: "Glicemia capilar", aliases: ["glicemia capilar", "glicemia"] },
  { id: "ecg", label: "ECG", aliases: ["eletrocardiograma", "ecg"] },
  { id: "pcr", label: "PCR", aliases: ["proteina c reativa", "pcr"] },
  { id: "doppler_venoso_mmii", label: "Doppler venoso de membro inferior", aliases: ["doppler venoso de membro inferior", "doppler de membro inferior", "ultrassom venoso", "doppler venoso"] },
  { id: "cetonas", label: "Cetonas (sangue/urina)", aliases: ["cetonuria", "cetonemia", "cetonas"] },
  { id: "eletrolitos", label: "Eletrólitos", aliases: ["sodio e potassio", "eletrolitos", "potassio", "sodio"] },
  { id: "us_abdome", label: "Ultrassonografia de abdome", aliases: ["ultrassonografia de abdome", "ultrassom de abdome", "usg de abdome"] },
  { id: "funcao_hepatica", label: "Função hepática", aliases: ["funcao hepatica", "transaminases", "bilirrubinas", "bilirrubina"] },
  {
    id: "ct_abdome_urotomografia",
    label: "TC de abdome sem contraste (urotomografia)",
    aliases: ["urotomografia", "tc de abdome sem contraste", "tomografia de abdome sem contraste", "urotc"],
  },
  { id: "funcao_renal", label: "Função renal", aliases: ["funcao renal", "creatinina"] },
  { id: "eletroencefalograma", label: "Eletroencefalograma", aliases: ["eletroencefalograma", "eeg"] },
  { id: "sorologia_dengue", label: "Antígeno NS1/sorologia para dengue", aliases: ["sorologia para dengue", "antigeno ns1", "sorologia dengue", "ns1"] },
  { id: "hematocrito", label: "Hematócrito", aliases: ["hematocrito"] },
  { id: "endoscopia_digestiva_alta", label: "Endoscopia digestiva alta", aliases: ["endoscopia digestiva alta", "endoscopia"] },
  { id: "tsh", label: "TSH", aliases: ["hormonio estimulante da tireoide", "hormonio tireoidiano", "tsh"] },
  { id: "t4_livre", label: "T4 livre", aliases: ["t4 livre", "tiroxina"] },
  { id: "perfil_lipidico", label: "Perfil lipídico", aliases: ["perfil lipidico", "lipidograma", "colesterol"] },
  { id: "troponina", label: "Troponina", aliases: ["troponina"] },
  { id: "bnp", label: "BNP", aliases: ["peptideo natriuretico", "bnp"] },
  { id: "ecocardiograma", label: "Ecocardiograma", aliases: ["ecocardiograma", "eco cardiograma", "eco"] },
  { id: "funcao_renal_eletrolitos", label: "Função renal e eletrólitos", aliases: ["funcao renal e eletrolitos", "ureia e creatinina e eletrolitos", "ureia e eletrolitos"] },
  { id: "liquor_puncao_lombar", label: "Líquor (punção lombar)", aliases: ["analise do liquor", "puncao lombar", "liquor", "lcr"] },
  { id: "amilase_lipase", label: "Amilase e lipase", aliases: ["amilase e lipase", "amilase", "lipase"] },
  {
    id: "ct_abdome_noncontrast",
    label: "TC de abdome",
    aliases: ["tomografia computadorizada de abdome", "tomografia de abdome", "tc de abdome", "tc abdome"],
  },
  { id: "urocultura", label: "Urocultura", aliases: ["urocultura"] },
  { id: "us_rins_vias_urinarias", label: "Ultrassonografia de rins e vias urinárias", aliases: ["ultrassonografia de rins e vias urinarias", "usg de rins e vias urinarias", "ultrassom de rins"] },
  { id: "d_dimero", label: "D-dímero", aliases: ["d-dimero", "d dimero", "dimero"] },
  {
    id: "cta_chest",
    label: "AngioTC de tórax",
    aliases: ["angiotomografia de torax", "angio-tc de torax", "angio tc de torax", "angiotc de torax", "angiotomografia toracica"],
  },
  {
    id: "anti_tpo",
    label: "Anti-TPO (anticorpo anti-peroxidase tireoidiana)",
    aliases: ["anti-tpo", "anti tpo", "antitpo", "anticorpo anti-peroxidase tireoidiana", "anticorpo antiperoxidase tireoidiana", "anticorpo anti-peroxidase"],
  },
  {
    id: "hemocultura",
    label: "Hemocultura",
    aliases: ["hemocultura", "hemoculturas", "cultura de sangue", "culturas de sangue"],
  },
  {
    id: "trigliceridios_calcio",
    label: "Triglicerídeos e cálcio",
    aliases: ["trigliceridios e calcio", "triglicerideos e calcio", "dosagem de trigliceridios e calcio", "trigliceridios", "triglicerideos", "calcio total", "calcemia"],
  },
  { id: "teste_ergometrico", label: "Teste ergométrico", aliases: ["teste ergometrico", "teste de esforco", "ergometria"] },
  { id: "lactato", label: "Lactato sérico", aliases: ["lactato serico", "lactato arterial", "lactato"] },
  { id: "eletroneuromiografia", label: "Eletroneuromiografia", aliases: ["eletroneuromiografia", "eneuromiografia", "estudo de conducao nervosa"] },
  { id: "toracocentese", label: "Toracocentese (análise do líquido pleural)", aliases: ["toracocentese", "analise do liquido pleural", "punção pleural", "puncao pleural"] },
  { id: "baciloscopia_escarro", label: "Baciloscopia de escarro (BAAR)", aliases: ["baciloscopia de escarro", "baciloscopia", "pesquisa de baar", "escarro baar"] },
  { id: "colonoscopia", label: "Colonoscopia", aliases: ["colonoscopia", "ileocolonoscopia"] },
  { id: "sorologia_hepatites", label: "Sorologias virais para hepatite", aliases: ["sorologia para hepatite", "sorologias para hepatite", "sorologia hepatite a b c", "marcadores de hepatite"] },
  { id: "cortisol_serico", label: "Cortisol sérico", aliases: ["cortisol serico", "dosagem de cortisol", "cortisol"] },
  { id: "proteinuria_24h", label: "Proteinúria de 24 horas", aliases: ["proteinuria de 24 horas", "proteinuria 24h", "urina de 24 horas"] },
  { id: "albumina_serica", label: "Albumina sérica", aliases: ["albumina serica", "dosagem de albumina", "albumina"] },
  { id: "coagulograma", label: "Coagulograma", aliases: ["coagulograma", "tempo de protrombina e ttpa", "tp e ttpa"] },
  { id: "toxicologico_urina", label: "Triagem toxicológica de urina", aliases: ["triagem toxicologica", "exame toxicologico de urina", "toxicologico de urina", "pesquisa de drogas na urina"] },
];

const CATALOG_IDS = new Set(EXAM_CATALOG.map((e) => e.id));
export function isKnownExamId(id: string): boolean {
  return CATALOG_IDS.has(id);
}
