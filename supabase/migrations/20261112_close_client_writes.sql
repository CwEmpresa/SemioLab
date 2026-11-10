-- 2026-11-12: fecha as escritas diretas do cliente em tabelas que geram XP.
--
-- ATENÇÃO — APLICAR SÓ DEPOIS DO DEPLOY do código que acompanha este
-- arquivo. A versão anterior de /api/learning gravava login_days e
-- quiz_attempts com o cliente do próprio usuário; se estas policies forem
-- removidas antes do deploy, o streak para de ser registrado.
--
-- Antes: qualquer usuário logado podia chamar o PostgREST direto e inserir
-- tentativas de quiz/consulta com a nota que quisesse (os gatilhos de XP
-- disparam no INSERT), inflando XP e ranking. Agora só o servidor (service
-- role) escreve nessas tabelas, sempre com valores que ele mesmo calculou.

drop policy if exists quiz_attempts_insert_own on public.quiz_attempts;
drop policy if exists patient_attempts_insert_own on public.patient_attempts;
drop policy if exists login_days_insert_own on public.login_days;
drop policy if exists topic_activity_insert_own on public.topic_activity;
drop policy if exists topic_activity_update_own on public.topic_activity;

-- Remove qualquer outra policy de escrita que tenha outro nome nessas
-- tabelas (o SELECT do próprio usuário continua valendo).
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('quiz_attempts', 'patient_attempts', 'login_days', 'topic_activity')
      and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

revoke insert, update, delete on public.quiz_attempts, public.patient_attempts, public.login_days, public.topic_activity
  from anon, authenticated;
