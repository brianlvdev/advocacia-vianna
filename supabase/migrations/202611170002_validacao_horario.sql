create or replace function public.reservar_horario(p_inicio timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if auth.uid() is null or public.papel_atual() is distinct from 'cliente' then raise exception 'Acesso negado'; end if;
 -- Evita alteração da disponibilidade durante a reserva.
 perform 1 from public.disponibilidade where id=true for share;
 if not exists(select 1 from public.listar_horarios() h where h.inicio=p_inicio) then raise exception 'Horário indisponível'; end if;
 insert into public.agendamentos(cliente_id,inicio,fim)
 select auth.uid(),p_inicio,p_inicio+make_interval(mins=>d.duracao_min) from public.disponibilidade d where d.id=true returning id into v_id;
 return v_id;
end; $$;
revoke all on function public.reservar_horario(timestamptz) from public,anon;
grant execute on function public.reservar_horario(timestamptz) to authenticated;
