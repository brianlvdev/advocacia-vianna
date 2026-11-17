begin;
alter table public.perfis add column email text;
create or replace function public.criar_perfil() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.perfis(id,nome,email,papel) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','Cliente'),new.email,
 case when new.email_confirmed_at is not null and lower(new.email) in ('brianlucasvianna@gmail.com','advocaciaviannamg@gmail.com') then 'admin' else 'cliente' end)
 on conflict(id) do update set email=excluded.email, papel=case
 when excluded.papel='admin' then 'admin' when public.perfis.papel='admin' then 'cliente' else public.perfis.papel end;
 return new;
end; $$;
create trigger usuario_confirmado after update of email,email_confirmed_at on auth.users for each row execute function public.criar_perfil();
update public.perfis p set email=u.email,papel=case when u.email_confirmed_at is not null and lower(u.email) in ('brianlucasvianna@gmail.com','advocaciaviannamg@gmail.com') then 'admin' else p.papel end from auth.users u where u.id=p.id;
create policy equipe_admin_ler on public.perfis for select to authenticated using(public.papel_atual()='admin');
create policy equipe_admin_atualizar on public.perfis for update to authenticated using(public.papel_atual()='admin' and papel<>'admin') with check(public.papel_atual()='admin' and papel in ('cliente','estagiario'));
revoke all on public.perfis from anon,authenticated;
grant select on public.perfis to authenticated;
grant update(papel) on public.perfis to authenticated;
create policy institucional_admin on public.perfil_publico for all to authenticated using(public.papel_atual()='admin') with check(public.papel_atual()='admin');
drop policy caso_criar on public.casos;
create policy caso_criar on public.casos for insert to authenticated with check(cliente_id=auth.uid() and public.papel_atual()='cliente' and status='uploading' and estagiario_id is null and not liberado_para_estagiario);
alter table public.casos add constraint status_caso_valido check(status in ('uploading','novo','aceito','recusado','com-estagiario'));
create function public.validar_tarefa() returns trigger language plpgsql set search_path='' as $$
begin
 if public.papel_atual()='estagiario' and (to_jsonb(new)-'concluida') is distinct from (to_jsonb(old)-'concluida') then raise exception 'Somente conclusão permitida'; end if;
 return new;
end; $$;
create trigger tarefa_campos before update on public.tarefas for each row execute function public.validar_tarefa();
revoke all on function public.validar_tarefa() from public,anon,authenticated;
create extension if not exists btree_gist with schema extensions;
alter table public.agendamentos add constraint sem_sobreposicao exclude using gist (tstzrange(inicio,fim,'[)') with &&) where (status<>'cancelado');
alter table public.agendamentos add constraint link_seguro check(meet_url is null or meet_url='' or meet_url ~ '^https://meet\.google\.com/');
create function public.listar_horarios() returns table(inicio timestamptz) language sql stable security definer set search_path='' as $$
 select s.h at time zone 'America/Sao_Paulo' from public.disponibilidade d
 cross join generate_series((now() at time zone 'America/Sao_Paulo')::date::timestamp,((now() at time zone 'America/Sao_Paulo')::date+14)::timestamp,interval '1 day') dia
 cross join lateral generate_series(dia+d.inicio,dia+d.fim-make_interval(mins=>d.duracao_min),make_interval(mins=>d.duracao_min)) s(h)
 where auth.uid() is not null and extract(dow from dia)::smallint=any(d.dias_semana)
 and s.h at time zone 'America/Sao_Paulo'>now()+interval '30 minutes'
 and s.h at time zone 'America/Sao_Paulo'<=now()+interval '14 days'
 and not exists(select 1 from public.agendamentos a where a.status<>'cancelado' and tstzrange(a.inicio,a.fim,'[)') && tstzrange(s.h at time zone 'America/Sao_Paulo',(s.h at time zone 'America/Sao_Paulo')+make_interval(mins=>d.duracao_min),'[)')) order by 1;
$$;
revoke all on function public.listar_horarios() from public,anon;
grant execute on function public.listar_horarios() to authenticated;
drop policy documentos_cliente_criar on public.documentos;
create policy documentos_cliente_criar on public.documentos for insert to authenticated with check(
 caminho like 'casos/'||auth.uid()::text||'/'||caso_id::text||'/%' and
 exists(select 1 from public.casos c where c.id=caso_id and c.cliente_id=auth.uid() and c.status='uploading'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('institucional','institucional',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy fotos_admin on storage.objects for all to authenticated using(bucket_id='institucional' and public.papel_atual()='admin') with check(bucket_id='institucional' and public.papel_atual()='admin');
grant select on public.perfil_publico,public.disponibilidade to anon;
grant select,insert,update on public.perfil_publico,public.disponibilidade to authenticated;
grant select,insert on public.casos,public.documentos,public.agendamentos to authenticated;
grant select,insert,update,delete on public.tarefas to authenticated;
create index casos_cliente_idx on public.casos(cliente_id);
create index casos_estagiario_idx on public.casos(estagiario_id);
create index documentos_caso_idx on public.documentos(caso_id);
create index tarefas_estagiario_idx on public.tarefas(estagiario_id);
create index agenda_cliente_idx on public.agendamentos(cliente_id);
commit;
