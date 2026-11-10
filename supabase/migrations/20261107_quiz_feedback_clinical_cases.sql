-- Opcional, mas recomendado. O app funciona sem esta migração; ela só
-- habilita dois extras:
--   1) cache das explicações "por que esta alternativa está errada"
--      (sem ela, a explicação é gerada de novo a cada erro);
--   2) armazenamento dos casos clínicos novos gerados por IA quando o
--      aluno já respondeu todos os casos-base (sem ela, o app reaproveita
--      os casos mais antigos que o aluno viu).

alter table public.simulado_questions add column if not exists option_explanations jsonb;

create table if not exists public.clinical_cases (
  id text primary key,
  topic text not null,
  title text not null,
  prompt text not null,
  asks text[] not null default '{}',
  rubric jsonb not null,
  model_answer text not null,
  explanation text not null,
  source text not null default 'ai',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Só o service role (rotas do servidor) lê/escreve: o cliente nunca vê a
-- rubrica de correção.
alter table public.clinical_cases enable row level security;
