import { createClient } from "@/lib/supabase/server";
import {
  CURATED_CARDS,
  ERRORS_DECK,
  ERRORS_DECK_ID,
  NEW_CARDS_PER_SESSION,
  SEMIOLOGY_DECKS,
  SESSION_SIZE,
  scheduleReview,
  type Flashcard,
  type FlashcardDeck,
  type Grade,
} from "@/lib/flashcards";

type ResearchRow = { id: string; result: { title?: string; flashcards?: { front: string; back: string }[] } };

/** Baralhos das pesquisas que o aluno salvou (um por pesquisa). */
async function researchDecks(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase
    .from("topic_research")
    .select("id, result")
    .eq("user_id", userId)
    .eq("saved_flashcards", true)
    .order("created_at", { ascending: false })
    .limit(30);
  const decks: FlashcardDeck[] = [];
  const cards: Flashcard[] = [];
  for (const row of (data ?? []) as ResearchRow[]) {
    const deckId = `pesq:${row.id}`;
    decks.push({ id: deckId, title: `Pesquisa: ${row.result.title ?? "tema"}`, quizTopic: null, kind: "pesquisa" });
    (row.result.flashcards ?? []).forEach((card, i) => cards.push({ id: `${deckId}:${i}`, deck: deckId, front: card.front, back: card.back }));
  }
  return { decks, cards };
}

export const dynamic = "force-dynamic";

type ReviewRow = { card_id: string; deck: string; due_at: string; ease: number; interval_days: number; reps: number; lapses: number };

async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

/** Cartas do caderno de erros do aluno: uma por questão (a mais recente),
 * frente = enunciado, verso = resposta correta + explicação. */
async function errorCards(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<Flashcard[]> {
  const { data } = await supabase
    .from("error_notebook")
    .select("question_id, question, correct_answer, explanation, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  const seen = new Set<string>();
  const cards: Flashcard[] = [];
  for (const row of data ?? []) {
    if (!row.question_id || seen.has(row.question_id)) continue;
    seen.add(row.question_id);
    cards.push({
      id: `erro:${row.question_id}`,
      deck: ERRORS_DECK_ID,
      front: row.question,
      back: [`Resposta correta: ${row.correct_answer}.`, row.explanation].filter(Boolean).join(" "),
    });
  }
  return cards;
}

export async function GET(request: Request) {
  const { supabase, user } = await getContext();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const deckId = new URL(request.url).searchParams.get("deck");
  const [{ data: reviewRows }, errors, research] = await Promise.all([
    supabase.from("flashcard_reviews").select("card_id, deck, due_at, ease, interval_days, reps, lapses").eq("user_id", user.id),
    errorCards(supabase, user.id),
    researchDecks(supabase, user.id),
  ]);
  const reviews = new Map((reviewRows as ReviewRow[] | null ?? []).map((row) => [row.card_id, row]));
  const now = Date.now();
  const all = [...CURATED_CARDS, ...errors, ...research.cards];
  const allDecks = [ERRORS_DECK, ...research.decks, ...SEMIOLOGY_DECKS];

  if (!deckId) {
    const decks = allDecks.map((deck) => {
      const cards = all.filter((card) => card.deck === deck.id);
      const due = cards.filter((card) => {
        const review = reviews.get(card.id);
        return review && new Date(review.due_at).getTime() <= now;
      }).length;
      const fresh = cards.filter((card) => !reviews.has(card.id)).length;
      return { ...deck, total: cards.length, due, fresh };
    });
    return Response.json({ decks });
  }

  const deck = allDecks.find((d) => d.id === deckId);
  if (!deck) return Response.json({ error: "Baralho não encontrado." }, { status: 404 });

  const cards = all.filter((card) => card.deck === deckId);
  const due = cards
    .filter((card) => {
      const review = reviews.get(card.id);
      return review && new Date(review.due_at).getTime() <= now;
    })
    .sort((a, b) => new Date(reviews.get(a.id)!.due_at).getTime() - new Date(reviews.get(b.id)!.due_at).getTime());
  const fresh = cards.filter((card) => !reviews.has(card.id)).slice(0, NEW_CARDS_PER_SESSION);
  const session = [...due, ...fresh].slice(0, SESSION_SIZE).map((card) => ({ ...card, isNew: !reviews.has(card.id) }));
  const nextDue = cards
    .map((card) => reviews.get(card.id)?.due_at)
    .filter((d): d is string => !!d && new Date(d).getTime() > now)
    .sort()[0] ?? null;

  return Response.json({ deck, cards: session, nextDue });
}

export async function POST(request: Request) {
  const { supabase, user } = await getContext();
  if (!user) return Response.json({ error: "Não autenticado" }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as { cardId?: string; grade?: number };
  const grade = body.grade;
  if (!body.cardId || (grade !== 0 && grade !== 1 && grade !== 2 && grade !== 3)) {
    return Response.json({ error: "Dados inválidos." }, { status: 400 });
  }

  // A carta precisa existir: curada, ou do caderno de erros deste aluno.
  let deck: string | null = CURATED_CARDS.find((card) => card.id === body.cardId)?.deck ?? null;
  if (!deck && body.cardId.startsWith("erro:")) {
    const { data } = await supabase
      .from("error_notebook")
      .select("question_id")
      .eq("user_id", user.id)
      .eq("question_id", body.cardId.slice("erro:".length))
      .limit(1)
      .maybeSingle();
    if (data) deck = ERRORS_DECK_ID;
  }
  if (!deck && body.cardId.startsWith("pesq:")) {
    const [, researchId, index] = body.cardId.split(":");
    const { data } = await supabase.from("topic_research").select("result").eq("user_id", user.id).eq("id", researchId).maybeSingle();
    const cards = (data?.result as ResearchRow["result"] | undefined)?.flashcards ?? [];
    if (cards[Number(index)]) deck = `pesq:${researchId}`;
  }
  if (!deck) return Response.json({ error: "Carta não encontrada." }, { status: 404 });

  const { data: existing } = await supabase
    .from("flashcard_reviews")
    .select("ease, interval_days, reps, lapses")
    .eq("user_id", user.id)
    .eq("card_id", body.cardId)
    .maybeSingle();
  const next = scheduleReview(existing ?? null, grade as Grade);

  const { error } = await supabase.from("flashcard_reviews").upsert(
    {
      user_id: user.id,
      card_id: body.cardId,
      deck,
      ...next,
      last_grade: grade,
      last_reviewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,card_id" },
  );
  if (error) return Response.json({ error: "Não foi possível salvar a revisão." }, { status: 500 });
  return Response.json({ ok: true, dueAt: next.due_at, intervalDays: next.interval_days });
}
