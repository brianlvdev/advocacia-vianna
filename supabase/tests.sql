begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000001','cliente-teste@example.invalid',now(),'{"role":"admin"}'),
 ('00000000-0000-4000-8000-000000000002','outro-teste@example.invalid',now(),'{}'),
 ('00000000-0000-4000-8000-000000000003','brianlucasvianna@gmail.com',now(),'{}'),
 ('00000000-0000-4000-8000-000000000004','advocaciaviannamg@gmail.com',null,'{}');
do $$ begin
 if (select papel from public.perfis where id='00000000-0000-4000-8000-000000000001')<>'cliente' then raise exception 'Escalada por metadata'; end if;
 if (select papel from public.perfis where id='00000000-0000-4000-8000-000000000003')<>'admin' then raise exception 'Admin confirmado ausente'; end if;
 if (select papel from public.perfis where id='00000000-0000-4000-8000-000000000004')<>'cliente' then raise exception 'Admin sem confirmação'; end if;
end; $$;
update auth.users set email_confirmed_at=now() where id='00000000-0000-4000-8000-000000000004';
do $$ begin if (select papel from public.perfis where id='00000000-0000-4000-8000-000000000004')<>'admin' then raise exception 'Confirmação não promoveu admin'; end if; end; $$;
insert into public.disponibilidade(id,dias_semana,inicio,fim) values(true,'{0,1,2,3,4,5,6}','00:00','23:59');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
insert into public.casos(id,cliente_id,assunto,resumo,status) values('10000000-0000-4000-8000-000000000001',auth.uid(),'Teste','Descrição de teste longa','uploading');
select public.finalizar_caso('10000000-0000-4000-8000-000000000001');
do $$ declare t timestamptz; begin
 select inicio into t from public.listar_horarios() limit 1;
 if t is null then raise exception 'Sem horários'; end if;
 perform public.reservar_horario(t);
 begin perform public.reservar_horario(t); raise exception 'Duplicidade permitida'; exception when unique_violation or exclusion_violation then null; when raise_exception then if SQLERRM<>'Horário indisponível' then raise; end if; end;
 if exists(select 1 from public.listar_horarios() where inicio=t) then raise exception 'Horário ocupado exposto'; end if;
 begin update public.perfis set papel='admin' where id=auth.uid(); exception when insufficient_privilege then null; end;
 if public.papel_atual()<>'cliente' then raise exception 'Escalada de papel'; end if;
end; $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
 if exists(select 1 from public.casos) or exists(select 1 from public.agendamentos) then raise exception 'Dados de outro cliente expostos'; end if;
 begin perform public.finalizar_caso('10000000-0000-4000-8000-000000000001'); raise exception 'Caso alheio editável'; exception when raise_exception then if SQLERRM='Caso alheio editável' then raise; end if; end;
end; $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
update public.perfis set papel='estagiario' where id='00000000-0000-4000-8000-000000000002';
update public.casos set estagiario_id='00000000-0000-4000-8000-000000000002',liberado_para_estagiario=true where id='10000000-0000-4000-8000-000000000001';
insert into public.tarefas(id,titulo,data,estagiario_id) values('20000000-0000-4000-8000-000000000001','Tarefa teste',current_date,'00000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
 if (select count(*) from public.casos)<>1 then raise exception 'Caso atribuído inacessível'; end if;
 update public.tarefas set concluida=true where id='20000000-0000-4000-8000-000000000001';
 begin update public.tarefas set titulo='Inválido'; raise exception 'Estagiário alterou título'; exception when raise_exception then if SQLERRM='Estagiário alterou título' then raise; end if; end;
 if exists(select 1 from public.agendamentos) then raise exception 'Estagiário acessou agenda'; end if;
end; $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
update public.casos set liberado_para_estagiario=false where id='10000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin if exists(select 1 from public.casos) then raise exception 'Revogação ineficaz'; end if; end; $$;
reset role;
do $$ begin
 begin
 insert into public.agendamentos(cliente_id,inicio,fim) select cliente_id,inicio+interval '1 minute',fim from public.agendamentos limit 1;
 raise exception 'Sobreposição permitida';
 exception when exclusion_violation then null; end;
end; $$;
select 'PASS: admins confirmados, metadata, isolamento de clientes, casos e conflito de reservas' as resultado;
rollback;
