import { z } from "zod";
import { SEMIOLOGY_MODULES, type SemiologyModule } from "@/lib/content/semiology";
import { getOpenAIClient, OPENAI_MODEL, estimateCostUsd, extractUsage } from "@/lib/openai";
import { logAudioUsage } from "@/lib/ai-usage";
import { toCanonicalTopic } from "@/lib/canonical-topics";
import type { createServiceClient } from "@/lib/supabase/service";
import type { ResearchImage, ResearchResult, ResearchSource } from "@/lib/research-types";

/** Identificação exigida pela política de uso da API da Wikimedia. */
const WIKI_HEADERS = { "User-Agent": "SemioLab/1.0 (plataforma educacional; suporte.semiolab@gmail.com)" };
const FETCH_TIMEOUT_MS = 8000;
const MAX_IMAGES = 6;
const MAX_SOURCE_CHARS = 2200;
const STOPWORDS = new Set(["para", "como", "qual", "quais", "sobre", "entre", "pelo", "pela", "com", "sem", "dos", "das", "uma", "que", "exame", "sinal", "sinais"]);

export function normalizeQuery(query: string) {
  return query.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

function tokens(text: string) {
  return normalizeQuery(text).split(/[^a-z0-9]+/).filter((t) => t.length >= 4 && !STOPWORDS.has(t));
}

function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&apos;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

function stripHtml(html: string) {
  return decodeEntities(html.replace(/<[^>]*>/g, " ")).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

async function getText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { headers: WIKI_HEADERS, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    return response.ok ? await response.text() : null;
  } catch {
    return null;
  }
}

/* ── 1. Conteúdo do próprio SemioLab ─────────────────────────────── */

type LocalHit = { module: SemiologyModule; score: number; snippets: string[] };

function searchSemiology(query: string): LocalHit[] {
  const qTokens = tokens(query);
  if (!qTokens.length) return [];
  const matches = (text: string) => qTokens.filter((t) => normalizeQuery(text).includes(t)).length;
  return SEMIOLOGY_MODULES.map((module) => {
    const lines = [
      ...module.sections.flatMap((s) => s.items.map((item) => `${s.title}: ${item}`)),
      ...module.maneuvers.map((m) => `${m.name}: ${m.how} ${m.positive}`),
      ...(module.patterns ?? []).map((p) => `${p.condition}: ${p.findings.join(", ")}`),
      ...module.keyPoints,
    ];
    const snippets = lines.filter((line) => matches(line) > 0);
    const score = matches(`${module.title} ${module.summary}`) * 3 + snippets.length;
    return { module, score, snippets: snippets.slice(0, 10) };
  })
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/* ── 2. Wikipédia (pt): uso interno, só para achar imagens e o termo
   em inglês usado nas bases científicas. Nunca aparece como fonte. ── */

type WikiPage = { title: string; images: string[]; enTitle: string | null };

async function searchWikipedia(query: string): Promise<WikiPage | null> {
  const search = await getJson<{ query?: { search?: { title: string }[] } }>(
    `https://pt.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=5&format=json`,
  );
  const title = search?.query?.search?.map((s) => s.title).find((t) => !/desambigua/i.test(t));
  if (!title) return null;

  const page = await getJson<{ query?: { pages?: Record<string, { title: string; missing?: string; images?: { title: string }[]; langlinks?: { "*": string }[] }> } }>(
    `https://pt.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=images|langlinks&imlimit=40&lllang=en&redirects=1&format=json`,
  );
  const info = page?.query?.pages ? Object.values(page.query.pages)[0] : null;
  if (!info || info.missing !== undefined) return null;
  return {
    title: info.title,
    images: (info.images ?? []).map((img) => img.title),
    enTitle: info.langlinks?.[0]?.["*"] ?? null,
  };
}

/* ── 3. Imagens livres (Wikimedia Commons) ───────────────────────── */

const NOISE = /(icon|logo|wiki|commons|question_book|ambox|flag|symbol|edit-clear|padlock|disambig|crystal|nuvola|stub|portal|star)/i;

type ImageInfo = {
  title: string;
  imageinfo?: {
    thumburl?: string;
    url?: string;
    descriptionurl?: string;
    width?: number;
    height?: number;
    mime?: string;
    extmetadata?: Record<string, { value?: string }>;
  }[];
};

function toImage(page: ImageInfo): ResearchImage | null {
  const info = page.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const license = stripHtml(meta.LicenseShortName?.value ?? "");
  // Só imagens de licença livre (Creative Commons ou domínio público).
  if (!info?.thumburl || !info.url || !/^(cc|public domain|pd)/i.test(license)) return null;
  if ((info.width ?? 0) < 300 || (info.height ?? 0) < 200) return null;
  const host = (url: string) => { try { return new URL(url).hostname; } catch { return ""; } };
  if (host(info.thumburl) !== "upload.wikimedia.org" || host(info.url) !== "upload.wikimedia.org") return null;
  return {
    title: page.title.replace(/^(File|Ficheiro|Arquivo):/, "").replace(/\.[a-z]+$/i, "").replace(/_/g, " "),
    description: stripHtml(meta.ImageDescription?.value ?? "").slice(0, 220),
    thumbUrl: info.thumburl,
    fullUrl: info.url,
    sourceUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    author: stripHtml(meta.Artist?.value ?? "Autor desconhecido").slice(0, 120) || "Autor desconhecido",
    license,
    licenseUrl: meta.LicenseUrl?.value ?? null,
  };
}

async function commonsInfo(fileTitles: string[]): Promise<ResearchImage[]> {
  if (!fileTitles.length) return [];
  const titles = fileTitles.slice(0, 40).map((t) => t.replace(/^(Ficheiro|Arquivo|Imagem):/, "File:")).join("|");
  const data = await getJson<{ query?: { pages?: Record<string, ImageInfo> } }>(
    `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titles)}&prop=imageinfo&iiprop=url|extmetadata|size|mime&iiurlwidth=640&format=json`,
  );
  return Object.values(data?.query?.pages ?? {}).map(toImage).filter((img): img is ResearchImage => img !== null);
}

async function findImages(wiki: WikiPage | null, terms: string[]): Promise<ResearchImage[]> {
  const fromArticle = (wiki?.images ?? []).filter((t) => /\.(jpe?g|png|svg|gif|webp)$/i.test(t) && !NOISE.test(t));
  let images = await commonsInfo(fromArticle);
  // Complemento: busca direta no Commons. Os nomes de arquivo costumam estar
  // em inglês, então tenta primeiro os termos em inglês.
  for (const term of [...new Set(terms.filter(Boolean))]) {
    if (images.length >= 3) break;
    const search = await getJson<{ query?: { search?: { title: string }[] } }>(
      `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(`${term} filetype:bitmap|drawing`)}&srnamespace=6&srlimit=12&format=json`,
    );
    const extra = await commonsInfo((search?.query?.search ?? []).map((s) => s.title).filter((t) => !NOISE.test(t)));
    const seen = new Set(images.map((i) => i.fullUrl));
    images = [...images, ...extra.filter((i) => !seen.has(i.fullUrl))];
  }
  return images.slice(0, MAX_IMAGES);
}

/* ── 4. Fontes científicas (NIH / NLM) ───────────────────────────── */

/* StatPearls (livro-texto revisado por pares, hospedado no NCBI Bookshelf),
   revisões indexadas no PubMed e MedlinePlus, todos da National Library of
   Medicine dos EUA. As bases são em inglês, então a busca usa o termo em
   inglês. */

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const NCBI_ID = "tool=semiolab&email=suporte.semiolab@gmail.com";

type ScienceSource = { kind: "statpearls" | "pubmed" | "medlineplus"; title: string; label: string; url: string; text: string };

async function pubmedIds(term: string, retmax: number) {
  const data = await getJson<{ esearchresult?: { idlist?: string[] } }>(
    `${EUTILS}/esearch.fcgi?db=pubmed&retmode=json&sort=relevance&retmax=${retmax}&${NCBI_ID}&term=${encodeURIComponent(term)}`,
  );
  return data?.esearchresult?.idlist ?? [];
}

function xmlTag(xml: string, tag: string) {
  return xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? "";
}

/** Tenta do mais preciso ao mais amplo: frase exata no título, todas as
 * palavras no título e, por fim, a busca normal do PubMed (que mapeia para
 * os descritores MeSH). */
async function pubmedSearch(term: string, filter: string, retmax: number) {
  const clean = term.replace(/["[\]()]/g, " ").replace(/\s+/g, " ").trim();
  const words = clean.split(" ").filter((w) => w.length >= 3);
  const attempts = [`"${clean}"[Title]`, words.map((w) => `${w}[Title]`).join(" AND "), clean];
  for (const attempt of attempts) {
    const ids = await pubmedIds(`(${attempt}) AND ${filter}`, retmax);
    if (ids.length) return ids;
  }
  return [];
}

async function fetchPubMed(term: string): Promise<ScienceSource[]> {
  // O NCBI limita a 3 requisições por segundo sem chave, então as buscas
  // são sequenciais.
  const books = await pubmedSearch(term, "statpearls[book]", 1);
  const reviews = await pubmedSearch(term, "review[pt] NOT meta-analysis[pt] NOT systematic review[pt] AND hasabstract AND english[la] AND 2012:3000[dp]", 2);
  const ids = [...books, ...reviews];
  if (!ids.length) return [];
  const xml = await getText(`${EUTILS}/efetch.fcgi?db=pubmed&retmode=xml&${NCBI_ID}&id=${ids.join(",")}`);
  if (!xml) return [];

  const records = xml.split(/<\/(?:PubmedArticle|PubmedBookArticle)>/).filter((chunk) => /<PMID/.test(chunk));
  const byId = new Map(records.map((chunk) => [xmlTag(chunk, "PMID"), chunk]));
  return ids.flatMap((id): ScienceSource[] => {
    const chunk = byId.get(id);
    if (!chunk) return [];
    const abstract = stripHtml([...chunk.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)].map((m) => m[1]).join(" "));
    if (abstract.length < 200) return [];
    const title = stripHtml(xmlTag(chunk, "ArticleTitle") || xmlTag(chunk, "BookTitle")).replace(/\.$/, "");
    const year = chunk.match(/<PubDate>[\s\S]*?<Year>(\d{4})/)?.[1] ?? chunk.match(/<Year>(\d{4})<\/Year>/)?.[1] ?? "";
    const nbk = chunk.match(/<ArticleId IdType="bookaccession">(NBK\d+)<\/ArticleId>/)?.[1];
    if (nbk) {
      return [{ kind: "statpearls", title: `StatPearls: ${title}`, label: `StatPearls (NCBI Bookshelf, NIH), capítulo "${title}"`, url: `https://www.ncbi.nlm.nih.gov/books/${nbk}/`, text: abstract }];
    }
    const journal = stripHtml(xmlTag(chunk, "Title")) || "PubMed";
    return [{ kind: "pubmed", title: `${title}. ${journal}${year ? `, ${year}` : ""}`, label: `Revisão publicada em ${journal}${year ? ` (${year})` : ""}: "${title}"`, url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`, text: abstract }];
  });
}

/** Versão mais ampla de um termo composto: "systolic heart murmur" →
 * "heart murmur". */
function broaderTerm(term: string) {
  const words = term.trim().split(/\s+/);
  return words.length > 1 ? words.slice(1).join(" ") : "";
}

async function fetchMedlinePlus(term: string): Promise<ScienceSource | null> {
  const found = await medlinePlusTopic(term);
  const broader = broaderTerm(term);
  return found ?? (broader ? medlinePlusTopic(broader) : null);
}

async function medlinePlusTopic(term: string): Promise<ScienceSource | null> {
  const xml = await getText(`https://wsearch.nlm.nih.gov/ws/query?db=healthTopics&retmax=1&term=${encodeURIComponent(term)}`);
  const doc = xml?.match(/<document[^>]*url="([^"]+)"[^>]*>([\s\S]*?)<\/document>/);
  if (!doc) return null;
  const field = (name: string) => stripHtml(doc[2].match(new RegExp(`<content name="${name}">([\\s\\S]*?)</content>`))?.[1] ?? "");
  const title = field("title");
  const summary = field("FullSummary");
  const url = doc[1];
  if (!title || summary.length < 200 || !/^https:\/\/medlineplus\.gov\//.test(url)) return null;
  // Evita tópicos tangenciais: o resumo precisa mencionar o termo buscado.
  const words = term.toLowerCase().split(/\s+/).filter((w) => w.length >= 4);
  if (words.length && !words.some((w) => summary.toLowerCase().includes(w.slice(0, 6)))) return null;
  return { kind: "medlineplus", title: `MedlinePlus: ${title}`, label: `MedlinePlus (National Library of Medicine, NIH), tópico "${title}"`, url, text: summary };
}

/** Termo em inglês para as bases científicas: o título do artigo em inglês
 * correspondente, ou uma tradução curta pela IA quando não houver. */
async function englishTerm(query: string, wiki: WikiPage | null, userId: string, service: ReturnType<typeof createServiceClient>) {
  if (wiki?.enTitle) return wiki.enTitle.replace(/\s*\(.*?\)\s*/g, " ").trim();
  try {
    const response = await getOpenAIClient().responses.create({
      model: OPENAI_MODEL,
      instructions: "Traduza o tema médico para o termo técnico equivalente em inglês usado no PubMed. Responda só com o termo, sem pontuação.",
      input: query,
      max_output_tokens: 200,
      reasoning: { effort: "minimal" },
    });
    const usage = extractUsage(response.usage);
    await logAudioUsage(service, { userId, sessionId: null, operation: "research", model: OPENAI_MODEL, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, estimatedCostUsd: estimateCostUsd(usage) });
    const term = (response.output_text ?? "").replace(/["'.\n]/g, " ").replace(/\s+/g, " ").trim();
    return term && term.length <= 80 ? term : query;
  } catch {
    return query;
  }
}

/* ── 5. Geração com IA, citando só as fontes recebidas ───────────── */

/* Validação tolerante: pequenas variações de formato do modelo (texto no
   lugar de lista, texto longo, itens a mais) são normalizadas em vez de
   descartar o material inteiro. Só a estrutura essencial é obrigatória. */
const text = (max: number) => z.string().trim().min(1).transform((s) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s));
const list = <T extends z.ZodTypeAny>(item: T, min: number, max: number) =>
  z.union([z.array(item), item.transform((v) => [v])]).transform((arr) => arr.slice(0, max)).refine((arr) => arr.length >= min, `mínimo de ${min} itens`);

const AiSchema = z.object({
  title: text(120),
  overview: text(700),
  sections: list(z.object({ heading: text(90), paragraphs: list(text(1200), 1, 5) }), 2, 6),
  keyPoints: list(text(240), 3, 8),
  mindMap: z.object({
    center: text(60),
    branches: list(z.object({ label: text(60), children: list(text(140), 1, 5) }), 3, 6),
  }),
  flashcards: list(z.object({ front: text(240), back: text(420) }), 5, 12),
  quiz: list(
    z.object({
      question: text(420),
      options: z.array(text(220)).length(4),
      correctIndex: z.coerce.number().int().min(0).max(3),
      explanation: text(650),
    }),
    3,
    6,
  ),
});

function buildPrompt(query: string, sources: { n: number; label: string; text: string }[]) {
  return [
    `Tema pesquisado por um estudante de medicina: "${query}".`,
    "Monte um material de estudo de semiologia médica, em português do Brasil, a partir das FONTES abaixo.",
    "Algumas fontes estão em inglês (StatPearls, PubMed, MedlinePlus): traduza e adapte, usando a terminologia médica brasileira.",
    "Regras:",
    "- Baseie o conteúdo nas fontes. Pode complementar com conhecimento médico consolidado, mas NUNCA invente referências.",
    "- Cite as fontes no fim das frases com [n], usando só os números listados. Parágrafo sem apoio nas fontes fica sem número.",
    "- NUNCA inclua doses, posologia ou prescrição de medicamentos.",
    "- Linguagem didática e direta; foco em anamnese, sinais, sintomas, exame físico e raciocínio clínico.",
    "- Ignore detalhes de pesquisa muito especializados (marcadores moleculares, citocinas, estatísticas de estudos) no texto, nos flashcards e no quiz.",
    "- Flashcards: pergunta curta na frente, resposta objetiva no verso.",
    "- Quiz: 5 questões de múltipla escolha, 4 alternativas, só UMA correta, com explicação.",
    "- Mapa mental: um centro e 4 a 6 ramos, cada ramo com 2 a 4 itens curtos.",
    "",
    "FONTES:",
    ...sources.map((s) => `[${s.n}] ${s.label}\n${s.text}`),
    "",
    'Responda APENAS com JSON: {"title":string,"overview":string,"sections":[{"heading":string,"paragraphs":string[]}],"keyPoints":string[],"mindMap":{"center":string,"branches":[{"label":string,"children":string[]}]},"flashcards":[{"front":string,"back":string}],"quiz":[{"question":string,"options":[string,string,string,string],"correctIndex":0-3,"explanation":string}]}',
  ].join("\n");
}

/** Remove citações [n] que não correspondem a uma fonte existente. */
function sanitizeCitations(text: string, max: number) {
  return text.replace(/\[(\d+)\]/g, (match, n) => (Number(n) >= 1 && Number(n) <= max ? match : ""));
}

function quizTopicFor(query: string, hits: LocalHit[]) {
  if (hits[0]) return hits[0].module.quizTopic;
  const canonical = toCanonicalTopic(query);
  return canonical === "Abdome e digestório" ? "Abdome" : canonical;
}

export class ResearchError extends Error {}

export async function buildResearch(query: string, userId: string, service: ReturnType<typeof createServiceClient>): Promise<ResearchResult> {
  const hits = searchSemiology(query);
  const wiki = await searchWikipedia(query);
  const term = await englishTerm(query, wiki, userId, service);
  const [images, science, medline] = await Promise.all([findImages(wiki, [term, wiki?.enTitle ?? "", broaderTerm(term), query]), fetchPubMed(term), fetchMedlinePlus(term)]);

  const sources: ResearchSource[] = [];
  const promptSources: { n: number; label: string; text: string }[] = [];
  for (const hit of hits) {
    const n = sources.length + 1;
    sources.push({ n, kind: "semiolab", title: `SemioLab — ${hit.module.title}`, url: null, moduleId: hit.module.id });
    promptSources.push({ n, label: `SemioLab, módulo "${hit.module.title}"`, text: hit.snippets.join("\n").slice(0, MAX_SOURCE_CHARS) });
  }
  for (const source of [...science, ...(medline ? [medline] : [])]) {
    const n = sources.length + 1;
    sources.push({ n, kind: source.kind, title: source.title, url: source.url, moduleId: null });
    promptSources.push({ n, label: source.label, text: source.text.slice(0, MAX_SOURCE_CHARS * 1.5) });
  }
  if (!promptSources.length) throw new ResearchError("Não encontrei conteúdo sobre esse tema. Tente um termo mais específico, como \"sopro sistólico\" ou \"sinal de Murphy\".");

  const client = getOpenAIClient();
  const response = await client.responses.create({
    model: OPENAI_MODEL,
    instructions: "Você é um professor de semiologia médica. Responda apenas com o JSON pedido, sem markdown.",
    input: buildPrompt(query, promptSources),
    max_output_tokens: 7000,
    reasoning: { effort: "minimal" },
    text: { format: { type: "json_object" } },
  });
  const usage = extractUsage(response.usage);
  await logAudioUsage(service, {
    userId,
    sessionId: null,
    operation: "research",
    model: OPENAI_MODEL,
    inputTokens: usage.inputTokens,
    outputTokens: usage.outputTokens,
    estimatedCostUsd: estimateCostUsd(usage),
  });

  let json: unknown;
  try { json = JSON.parse(response.output_text || "{}"); } catch { json = null; }
  const parsed = AiSchema.safeParse(json);
  if (!parsed.success) {
    // Só metadados (campos e motivos), nunca o conteúdo gerado.
    console.error("[research] resposta da IA fora do formato", {
      status: response.status,
      incomplete: response.incomplete_details?.reason ?? null,
      outputChars: response.output_text?.length ?? 0,
      issues: parsed.error.issues.slice(0, 6).map((issue) => `${issue.path.join(".")}: ${issue.message}`),
    });
    throw new ResearchError("Não consegui montar o material agora. Tente de novo em instantes.");
  }

  const max = sources.length;
  const ai = parsed.data;
  return {
    query,
    title: ai.title,
    overview: sanitizeCitations(ai.overview, max),
    sections: ai.sections.map((s) => ({ heading: s.heading, paragraphs: s.paragraphs.map((p) => sanitizeCitations(p, max)) })),
    keyPoints: ai.keyPoints.map((k) => sanitizeCitations(k, max)),
    mindMap: ai.mindMap,
    flashcards: ai.flashcards,
    quiz: ai.quiz,
    sources,
    images,
    semiologyModules: hits.map((hit) => ({ id: hit.module.id, title: hit.module.title })),
    quizTopic: quizTopicFor(query, hits),
    generatedAt: new Date().toISOString(),
  };
}
