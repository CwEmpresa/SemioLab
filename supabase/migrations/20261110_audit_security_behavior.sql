-- Auditoria 2026-11-10: segurança, índices, latência da IA e análise de
-- comportamento para o painel administrativo.

-- ───────────────────────────────────────────────────────────────────────
-- 1) SEGURANÇA — funções admin_* eram SECURITY DEFINER e executáveis por
--    anon/authenticated (qualquer pessoa com a chave pública lia receita e
--    engajamento via /rest/v1/rpc). Só o service role (rotas /api/admin,
--    que já validam admin_users) pode executar.
-- ───────────────────────────────────────────────────────────────────────
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace and p.proname like 'admin\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;

-- ───────────────────────────────────────────────────────────────────────
-- 2) DESEMPENHO — chaves estrangeiras sem índice + índices de análise.
-- ───────────────────────────────────────────────────────────────────────
create index if not exists error_notebook_user_id_idx on public.error_notebook (user_id);
create index if not exists patient_attempts_user_created_idx on public.patient_attempts (user_id, created_at desc);
create index if not exists quiz_attempts_user_created_idx on public.quiz_attempts (user_id, created_at desc);
create index if not exists patient_sessions_case_id_idx on public.patient_sessions (case_id);
create index if not exists payment_events_subscription_id_idx on public.payment_events (subscription_id);
create index if not exists push_subscriptions_user_id_idx on public.push_subscriptions (user_id);
create index if not exists product_events_name_created_idx on public.product_events (event_name, created_at desc);
create index if not exists product_events_user_created_idx on public.product_events (user_id, created_at);
create index if not exists ai_usage_logs_op_created_idx on public.ai_usage_logs (operation, created_at desc);

-- ───────────────────────────────────────────────────────────────────────
-- 3) LATÊNCIA DA IA — antes não havia nenhuma medição de tempo de resposta.
--    ttft_ms = tempo até a primeira palavra; duration_ms = resposta inteira.
-- ───────────────────────────────────────────────────────────────────────
alter table public.ai_usage_logs add column if not exists ttft_ms integer;
alter table public.ai_usage_logs add column if not exists duration_ms integer;

-- Novos eventos de produto: rota entre telas, paywall exibido e consulta
-- abandonada (a lista fechada continua valendo no banco e na API).
alter table public.product_events drop constraint if exists product_events_event_name_check;
alter table public.product_events add constraint product_events_event_name_check check (
  event_name = any (array[
    'checkout_clicked', 'onboarding_started', 'onboarding_skipped', 'onboarding_completed',
    'first_experience_viewed', 'first_challenge_started', 'first_question_answered',
    'first_challenge_completed', 'next_activity_selected',
    'screen_viewed', 'paywall_shown', 'consult_abandoned'
  ])
);

-- ───────────────────────────────────────────────────────────────────────
-- 4) COMPORTAMENTO — retenção por coorte, o que o usuário fez no 1º dia e
--    se voltou, funil completo, rota entre telas, abandono e latência.
-- ───────────────────────────────────────────────────────────────────────
create or replace function public.admin_behavior_stats()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with u as (
  select p.id, p.created_at,
         (p.created_at at time zone 'America/Sao_Paulo')::date as d0
  from profiles p
),
flags as (
  select u.id, u.d0, u.created_at,
    exists(select 1 from login_days l where l.user_id = u.id) as ever_opened,
    exists(select 1 from login_days l where l.user_id = u.id and l.activity_date = u.d0 + 1) as d1,
    exists(select 1 from login_days l where l.user_id = u.id and l.activity_date between u.d0 + 1 and u.d0 + 7) as w1,
    exists(select 1 from login_days l where l.user_id = u.id and l.activity_date between u.d0 + 8 and u.d0 + 30) as m1,
    exists(select 1 from login_days l where l.user_id = u.id and l.activity_date between u.d0 + 1 and u.d0 + 14) as returned14,
    exists(select 1 from product_events e where e.user_id = u.id and e.event_name = 'first_experience_viewed') as fe_viewed,
    exists(select 1 from first_experience_progress f where f.user_id = u.id and f.completed_at is not null) as fe_done,
    exists(select 1 from first_experience_progress f where f.user_id = u.id and f.completed_at is not null and f.completed_at < u.created_at + interval '1 day') as fe_done_d0,
    exists(select 1 from patient_sessions s where s.user_id = u.id) as consult_started,
    exists(select 1 from patient_sessions s where s.user_id = u.id and s.status = 'finished') as consult_finished,
    exists(select 1 from patient_sessions s where s.user_id = u.id and s.created_at < u.created_at + interval '1 day') as consult_started_d0,
    exists(select 1 from patient_sessions s where s.user_id = u.id and s.status = 'finished' and s.created_at < u.created_at + interval '1 day') as consult_finished_d0,
    exists(select 1 from quiz_attempts q where q.user_id = u.id) as quiz_done,
    exists(select 1 from quiz_attempts q where q.user_id = u.id and q.created_at < u.created_at + interval '1 day') as quiz_d0,
    exists(select 1 from push_subscriptions ps where ps.user_id = u.id) as push_on,
    exists(select 1 from subscriptions sb where sb.user_id = u.id and sb.status = 'active') as paying
  from u
),
cohorts as (
  select to_char(date_trunc('week', d0), 'YYYY-MM-DD') as week,
         count(*) as size,
         count(*) filter (where ever_opened) as opened,
         count(*) filter (where d1) as d1,
         count(*) filter (where w1) as w1,
         count(*) filter (where m1) as m1,
         count(*) filter (where consult_finished_d0) as consult_d0
  from flags
  group by 1
  order by 1 desc
  limit 16
),
mature as (select * from flags where created_at < now() - interval '14 days'),
segments as (
  select * from (
    select 1 as ord, 'Todos os cadastros' as label, count(*) as n, count(*) filter (where returned14) as returned from mature
    union all select 2, 'Terminou consulta + fez quiz no 1º dia', count(*), count(*) filter (where returned14) from mature where consult_finished_d0 and quiz_d0
    union all select 3, 'Terminou uma consulta no 1º dia', count(*), count(*) filter (where returned14) from mature where consult_finished_d0
    union all select 4, 'Fez um quiz no 1º dia', count(*), count(*) filter (where returned14) from mature where quiz_d0
    union all select 5, 'Começou consulta e não terminou', count(*), count(*) filter (where returned14) from mature where consult_started_d0 and not consult_finished_d0
    union all select 6, 'Só o microcaso inicial (nada depois)', count(*), count(*) filter (where returned14) from mature where fe_done_d0 and not consult_started_d0 and not quiz_d0
    union all select 7, 'Não concluiu nem o microcaso', count(*), count(*) filter (where returned14) from mature where not fe_done_d0
    union all select 8, 'Ativou notificações push', count(*), count(*) filter (where returned14) from mature where push_on
    union all select 9, 'Sem notificações push', count(*), count(*) filter (where returned14) from mature where not push_on
  ) s
),
funnel as (
  select jsonb_build_array(
    jsonb_build_object('label', 'Cadastrou', 'value', (select count(*) from auth.users)),
    jsonb_build_object('label', 'Confirmou o e-mail', 'value', (select count(*) from auth.users where email_confirmed_at is not null)),
    jsonb_build_object('label', 'Abriu o app', 'value', count(*) filter (where ever_opened)),
    jsonb_build_object('label', 'Viu o microcaso inicial', 'value', count(*) filter (where fe_viewed or fe_done)),
    jsonb_build_object('label', 'Concluiu o microcaso', 'value', count(*) filter (where fe_done)),
    jsonb_build_object('label', 'Começou uma consulta real', 'value', count(*) filter (where consult_started)),
    jsonb_build_object('label', 'Terminou uma consulta real', 'value', count(*) filter (where consult_finished)),
    jsonb_build_object('label', 'Voltou em outro dia (7d)', 'value', count(*) filter (where w1)),
    jsonb_build_object('label', 'Virou assinante', 'value', count(*) filter (where paying))
  ) as steps
  from flags
),
views as (
  select e.user_id, e.created_at,
         e.safe_metadata->>'screen' as screen,
         lag(e.safe_metadata->>'screen') over (partition by e.user_id order by e.created_at) as prev_screen,
         lag(e.created_at) over (partition by e.user_id order by e.created_at) as prev_at,
         row_number() over (partition by e.user_id order by e.created_at desc) as rn_desc
  from product_events e
  where e.event_name = 'screen_viewed' and e.created_at > now() - interval '30 days'
),
transitions as (
  select prev_screen as "from", screen as "to", count(*) as n, count(distinct user_id) as users
  from views
  where prev_screen is not null and prev_screen <> screen and created_at - prev_at < interval '30 minutes'
  group by 1, 2 order by n desc limit 25
),
screen_totals as (
  select screen, count(*) as views, count(distinct user_id) as users from views group by 1 order by users desc
),
exits as (
  -- Última tela vista por quem sumiu há 3+ dias: onde a pessoa estava
  -- quando desistiu.
  select v.screen, count(*) as users
  from views v
  where v.rn_desc = 1
    and not exists (select 1 from login_days l where l.user_id = v.user_id and l.activity_date > (now() at time zone 'America/Sao_Paulo')::date - 3)
  group by 1 order by users desc
),
paywall as (
  select coalesce(safe_metadata->>'reason', '—') as reason,
         count(*) filter (where event_name = 'paywall_shown') as shown,
         count(distinct user_id) filter (where event_name = 'paywall_shown') as shown_users,
         count(*) filter (where event_name = 'checkout_clicked') as clicks,
         count(distinct user_id) filter (where event_name = 'checkout_clicked') as click_users
  from product_events
  where event_name in ('paywall_shown', 'checkout_clicked')
  group by 1 order by 2 desc, 4 desc
),
abandoned as (
  select case when message_count = 0 then '0 perguntas'
              when message_count <= 2 then '1–2 perguntas'
              when message_count <= 6 then '3–6 perguntas'
              else '7+ perguntas' end as bucket,
         count(*) as n
  from patient_sessions
  where status = 'active' and started_at < now() - interval '6 hours'
  group by 1 order by 1
),
latency as (
  select to_char((created_at at time zone 'America/Sao_Paulo')::date, 'YYYY-MM-DD') as day,
         count(*) as n,
         round(percentile_cont(0.5) within group (order by ttft_ms)) as ttft_p50,
         round(percentile_cont(0.9) within group (order by ttft_ms)) as ttft_p90,
         round(percentile_cont(0.5) within group (order by duration_ms)) as total_p50,
         round(percentile_cont(0.9) within group (order by duration_ms)) as total_p90
  from ai_usage_logs
  where operation = 'chat' and ttft_ms is not null and created_at > now() - interval '14 days'
  group by 1 order by 1 desc
),
latency_legacy as (
  -- Antes da medição direta: intervalo entre a fala do estudante e a
  -- resposta gravada do paciente (resposta inteira, não a 1ª palavra).
  select round((percentile_cont(0.5) within group (order by g) * 1000)::numeric) as p50,
         round((percentile_cont(0.9) within group (order by g) * 1000)::numeric) as p90,
         count(*) as n
  from (
    select extract(epoch from (created_at - lag(created_at) over (partition by session_id order by created_at, id))) as g,
           role, lag(role) over (partition by session_id order by created_at, id) as prev_role, created_at
    from patient_messages
    where created_at > now() - interval '30 days'
  ) m
  where role = 'patient' and prev_role = 'student' and g between 0 and 120
),
hours as (
  select extract(hour from created_at at time zone 'America/Sao_Paulo')::int as hour, count(*) as n
  from patient_sessions group by 1 order by 1
)
select jsonb_build_object(
  'generatedAt', now(),
  'totals', (select jsonb_build_object(
      'users', count(*),
      'neverOpened', count(*) filter (where not ever_opened),
      'd1', count(*) filter (where d1),
      'w1', count(*) filter (where w1),
      'didNothingReal', count(*) filter (where not consult_started and not quiz_done),
      'pushOn', count(*) filter (where push_on)) from flags),
  'cohorts', coalesce((select jsonb_agg(to_jsonb(c) order by c.week desc) from cohorts c), '[]'::jsonb),
  'segments', coalesce((select jsonb_agg(jsonb_build_object('label', label, 'n', n, 'returned', returned) order by ord) from segments), '[]'::jsonb),
  'funnel', (select steps from funnel),
  'transitions', coalesce((select jsonb_agg(to_jsonb(t) order by t.n desc) from transitions t), '[]'::jsonb),
  'screens', coalesce((select jsonb_agg(to_jsonb(s) order by s.users desc) from screen_totals s), '[]'::jsonb),
  'exits', coalesce((select jsonb_agg(to_jsonb(x) order by x.users desc) from exits x), '[]'::jsonb),
  'paywall', coalesce((select jsonb_agg(to_jsonb(pw)) from paywall pw), '[]'::jsonb),
  'abandoned', coalesce((select jsonb_agg(to_jsonb(a)) from abandoned a), '[]'::jsonb),
  'latency', coalesce((select jsonb_agg(to_jsonb(l) order by l.day desc) from latency l), '[]'::jsonb),
  'latencyLegacy', (select to_jsonb(ll) from latency_legacy ll),
  'hours', coalesce((select jsonb_agg(to_jsonb(h) order by h.hour) from hours h), '[]'::jsonb)
);
$$;

-- Linha do tempo de um usuário: tudo o que ele fez, em ordem — para
-- entender caso a caso por que alguém parou de usar.
create or replace function public.admin_user_timeline(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with ev as (
  select created_at as at, 'signup' as kind, 'Criou a conta' as label from profiles where id = p_user_id
  union all
  select created_at, 'login', 'Abriu o app' from login_days where user_id = p_user_id
  union all
  select completed_at, 'first_experience', 'Concluiu o microcaso inicial'
    from first_experience_progress where user_id = p_user_id and completed_at is not null
  union all
  select s.started_at, 'consult_start', 'Começou consulta: ' || coalesce(c.title, 'caso')
    from patient_sessions s left join patient_cases c on c.id = s.case_id where s.user_id = p_user_id
  union all
  select s.finished_at, 'consult_finish',
         'Terminou consulta (nota ' || coalesce(s.score::text, '—') || ', ' || s.message_count || ' perguntas)'
    from patient_sessions s where s.user_id = p_user_id and s.finished_at is not null
  union all
  select created_at, 'quiz', 'Quiz: ' || topic || ' (' || correct || '/' || total || ')'
    from quiz_attempts where user_id = p_user_id
  union all
  select started_at, 'simulado', 'Simulado (' || status || ')' from simulado_attempts where user_id = p_user_id
  union all
  select created_at,
         case when event_name = 'screen_viewed' then 'screen' when event_name in ('paywall_shown', 'checkout_clicked') then 'paywall' else 'event' end,
         case event_name
           when 'screen_viewed' then 'Abriu a tela: ' || coalesce(safe_metadata->>'screen', '?')
           when 'paywall_shown' then 'Viu o paywall (' || coalesce(safe_metadata->>'reason', '—') || ')'
           when 'checkout_clicked' then 'Clicou em assinar (' || coalesce(safe_metadata->>'plan', '—') || ')'
           else event_name || coalesce(' · ' || (safe_metadata->>'step'), '')
         end
    from product_events where user_id = p_user_id
)
select coalesce(jsonb_agg(jsonb_build_object('at', at, 'kind', kind, 'label', label) order by at desc), '[]'::jsonb)
from (select * from ev where at is not null order by at desc limit 250) t;
$$;

revoke execute on function public.admin_behavior_stats() from public, anon, authenticated;
revoke execute on function public.admin_user_timeline(uuid) from public, anon, authenticated;
grant execute on function public.admin_behavior_stats() to service_role;
grant execute on function public.admin_user_timeline(uuid) to service_role;
