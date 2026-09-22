-- Progresso de repetição espaçada dos flashcards, por aluno e por carta.
-- As cartas em si não ficam no banco: as curadas vêm de lib/content e as do
-- caderno de erros vêm de error_notebook (card_id = "erro:<id>").
create table if not exists public.flashcard_reviews (
  user_id uuid not null references auth.users (id) on delete cascade,
  card_id text not null,
  deck text not null,
  ease real not null default 2.5,
  interval_days integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  due_at timestamptz not null default now(),
  last_grade smallint,
  last_reviewed_at timestamptz,
  primary key (user_id, card_id)
);

create index if not exists flashcard_reviews_due_idx on public.flashcard_reviews (user_id, due_at);

alter table public.flashcard_reviews enable row level security;

create policy flashcard_reviews_select_own on public.flashcard_reviews
  for select using (auth.uid() = user_id);
create policy flashcard_reviews_insert_own on public.flashcard_reviews
  for insert with check (auth.uid() = user_id);
create policy flashcard_reviews_update_own on public.flashcard_reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy flashcard_reviews_delete_own on public.flashcard_reviews
  for delete using (auth.uid() = user_id);
