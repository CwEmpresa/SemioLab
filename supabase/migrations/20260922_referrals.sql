-- Programa de indicação: quem compartilha o link e consegue 3 indicados
-- que usem o app por pelo menos 3 dias (dentro de 7 dias do cadastro
-- deles) ganha 1 mês de Pro grátis. Reaproveita login_days (já existe,
-- alimenta o streak) como fonte de "dia de uso real" — não cria uma
-- segunda fonte de verdade para atividade.
alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.profiles (id),
  add column if not exists referral_qualified boolean not null default false,
  add column if not exists pro_granted_until timestamptz;

create index if not exists profiles_referred_by_idx on public.profiles (referred_by);

-- Um registro por mês concedido — histórico auditável e barreira natural
-- contra conceder o mesmo mês duas vezes (a rotina de avaliação sempre
-- soma "quantos já foram concedidos" antes de conceder mais).
create table if not exists public.referral_grants (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  months integer not null default 1,
  granted_at timestamptz not null default now()
);

create index if not exists referral_grants_referrer_idx on public.referral_grants (referrer_id);

alter table public.referral_grants enable row level security;

create policy referral_grants_select_own on public.referral_grants
  for select using (auth.uid() = referrer_id);

-- Resolve o código de indicação (se o metadata de cadastro trouxer um)
-- além do que a função já fazia — nunca falha o cadastro se o código não
-- existir ou já não existir mais, só deixa referred_by como null.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  referrer_id uuid;
begin
  if new.raw_user_meta_data->>'ref' is not null then
    select id into referrer_id from public.profiles
      where referral_code = new.raw_user_meta_data->>'ref'
      limit 1;
  end if;
  insert into public.profiles (id, name, email, referred_by)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    referrer_id
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;
