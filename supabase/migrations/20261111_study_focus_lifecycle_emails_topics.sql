-- 2026-11-11: trilha por tema da faculdade, e-mails de retorno e
-- especialidades duplicadas do Paciente Virtual.

-- ───────────────────────────────────────────────────────────────────────
-- 1) O que o estudante está vendo na faculdade agora. Gravado só pelo
--    servidor (/api/profile/focus) — o cliente continua podendo alterar
--    apenas a coluna `name`.
-- ───────────────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists study_focus text;
alter table public.profiles add column if not exists email_opt_out boolean not null default false;
-- O papel anônimo tinha UPDATE em todas as colunas de profiles. A RLS já
-- barrava (sem auth.uid() nenhuma linha passa), mas o privilégio não tem
-- por que existir.
revoke update on public.profiles from anon;

-- ───────────────────────────────────────────────────────────────────────
-- 2) E-mails de retorno (D1, D3, D7). Uma linha por usuário + tipo: nunca
--    envia o mesmo e-mail duas vezes. Só o service role lê/escreve.
-- ───────────────────────────────────────────────────────────────────────
create table if not exists public.lifecycle_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('d1', 'd3', 'd7')),
  sent_at timestamptz not null default now(),
  unique (user_id, kind)
);
alter table public.lifecycle_emails enable row level security;

create or replace function public.lifecycle_email_candidates()
returns table (user_id uuid, email text, name text, kind text, finished_consult boolean)
language sql
stable
security definer
set search_path = public
as $$
with base as (
  select p.id, p.email, p.name,
         (p.created_at at time zone 'America/Sao_Paulo')::date as d0,
         (now() at time zone 'America/Sao_Paulo')::date as today,
         (select max(l.activity_date) from login_days l where l.user_id = p.id) as last_day,
         exists(select 1 from patient_sessions s where s.user_id = p.id and s.status = 'finished') as finished_consult
  from profiles p
  join auth.users u on u.id = p.id
  where u.email_confirmed_at is not null
    and not p.email_opt_out
    and p.email is not null
    and p.created_at > now() - interval '12 days'
    and not exists (select 1 from subscriptions sb where sb.user_id = p.id and sb.status = 'active')
),
k as (
  select b.*,
         case
           -- D1: cadastrou ontem/anteontem e não voltou depois do 1º dia.
           when b.today - b.d0 between 1 and 2 and coalesce(b.last_day, b.d0) <= b.d0 then 'd1'
           -- D3: 3 a 5 dias de conta, sem abrir o app ontem nem hoje.
           when b.today - b.d0 between 3 and 5 and coalesce(b.last_day, b.d0) < b.today - 1 then 'd3'
           -- D7: fim do período de teste, parado há 3+ dias.
           when b.today - b.d0 between 7 and 10 and coalesce(b.last_day, b.d0) < b.today - 2 then 'd7'
         end as kind
  from base b
)
select k.id, k.email, k.name, k.kind, k.finished_consult
from k
where k.kind is not null
  and not exists (select 1 from lifecycle_emails e where e.user_id = k.id and e.kind = k.kind)
limit 300;
$$;

revoke execute on function public.lifecycle_email_candidates() from public, anon, authenticated;
grant execute on function public.lifecycle_email_candidates() to service_role;

-- ───────────────────────────────────────────────────────────────────────
-- 3) Especialidades duplicadas: o mesmo sistema aparecia com dois nomes
--    ("Endócrino"/"Endocrinologia", "Neurológico"/"Neurologia"...), o que
--    partia o progresso do estudante em dois. Fica um nome por sistema.
-- ───────────────────────────────────────────────────────────────────────
update public.patient_cases set specialty = 'Endocrinologia' where specialty = 'Endócrino';
update public.patient_cases set specialty = 'Gastroenterologia' where specialty = 'Gastrointestinal';
update public.patient_cases set specialty = 'Neurologia' where specialty = 'Neurológico';
update public.patient_cases set specialty = 'Nefrologia' where specialty = 'Renal e urinário';

update public.patient_attempts set topic = 'Endocrinologia' where topic = 'Endócrino';
update public.patient_attempts set topic = 'Gastroenterologia' where topic = 'Gastrointestinal';
update public.patient_attempts set topic = 'Neurologia' where topic = 'Neurológico';
update public.patient_attempts set topic = 'Nefrologia' where topic = 'Renal e urinário';

-- ───────────────────────────────────────────────────────────────────────
-- 4) O top 10 do ranking (nome, id e XP) podia ser lido sem login pela
--    chave pública. Só usuários autenticados precisam dele.
-- ───────────────────────────────────────────────────────────────────────
revoke execute on function public.ranking_top() from public, anon;
grant execute on function public.ranking_top() to authenticated, service_role;
