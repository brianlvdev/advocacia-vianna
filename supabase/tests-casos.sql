-- Regressão isolada: somente registros fictícios, sempre desfeitos por ROLLBACK.
begin;
do $$
declare
 cliente uuid := gen_random_uuid();
 estagiario uuid := gen_random_uuid();
 gestor uuid := gen_random_uuid();
 caso uuid := gen_random_uuid();
 alterado uuid;
begin
 insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 (cliente,'qa-'||cliente||'@example.invalid',now(),'{}'),
 (estagiario,'qa-'||estagiario||'@example.invalid',now(),'{}'),
 (gestor,'qa-'||gestor||'@example.invalid',now(),'{}');
 update public.perfis set papel='estagiario' where id=estagiario;
 update public.perfis set papel='admin' where id=gestor;
 execute 'set local role authenticated';
 perform set_config('request.jwt.claim.sub',cliente::text,true);
 insert into public.casos(id,cliente_id,assunto,resumo,status) values(caso,cliente,'Teste isolado','Caso fictício para regressão de ações','uploading');
 perform public.finalizar_caso(caso);
 update public.casos set status='aceito' where id=caso returning id into alterado;
 if alterado is not null then raise exception 'Cliente conseguiu aceitar caso'; end if;
 perform set_config('request.jwt.claim.sub',gestor::text,true);
 update public.casos set status='aceito',estagiario_id=null,liberado_para_estagiario=false where id=caso returning id into alterado;
 if alterado is null or (select status from public.casos where id=caso)<>'aceito' then raise exception 'Aceitar não persistiu'; end if;
 update public.casos set status='recusado',estagiario_id=null,liberado_para_estagiario=false where id=caso returning id into alterado;
 if alterado is null or (select status from public.casos where id=caso)<>'recusado' then raise exception 'Recusar não persistiu'; end if;
 update public.casos set status='com-estagiario',estagiario_id=estagiario,liberado_para_estagiario=true where id=caso;
 perform set_config('request.jwt.claim.sub',estagiario::text,true);
 if not exists(select 1 from public.casos where id=caso and status='com-estagiario') then raise exception 'Atribuição não liberou caso'; end if;
 update public.casos set status='aceito' where id=caso returning id into alterado;
 if alterado is not null then raise exception 'Estagiário conseguiu decidir caso'; end if;
 perform set_config('request.jwt.claim.sub',gestor::text,true);
 update public.casos set status='recusado',estagiario_id=null,liberado_para_estagiario=false where id=caso;
 perform set_config('request.jwt.claim.sub',estagiario::text,true);
 if exists(select 1 from public.casos where id=caso) then raise exception 'Recusa não revogou acesso'; end if;
 execute 'reset role';
end $$;
select 'PASS: aceitar, recusar, atribuir e revogar persistem; cliente e estagiário não decidem casos' as resultado;
rollback;
