-- Pesquisa por tema: cada pesquisa gerada fica salva (reabrir não gasta IA
-- de novo) e serve de base para o limite por plano. Só o servidor (service
-- role) grava; o aluno lê e apaga apenas as próprias pesquisas.
create table if not exists public.topic_research (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  query text not null,
  query_key text not null,
  result jsonb not null,
  saved_flashcards boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, query_key)
);

create index if not exists topic_research_user_created_idx on public.topic_research (user_id, created_at desc);

alter table public.topic_research enable row level security;

create policy topic_research_select_own on public.topic_research
  for select using (auth.uid() = user_id);
create policy topic_research_delete_own on public.topic_research
  for delete using (auth.uid() = user_id);

-- Novo tipo de operação no registro de custo de IA.
alter table public.ai_usage_logs drop constraint if exists ai_usage_logs_operation_check;
alter table public.ai_usage_logs add constraint ai_usage_logs_operation_check
  check (operation = any (array['chat', 'evaluation', 'repair', 'transcription', 'tts', 'question_generation', 'research']));
