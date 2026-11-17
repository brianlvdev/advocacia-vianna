-- Primeira etapa: estrutura isolada. Não aplicada em nenhum projeto.
-- As tabelas sem políticas ficam fechadas até a implementação dos fluxos.
begin;
create table public.perfis (
 id uuid primary key references auth.users(id) on delete cascade,
 nome text not null default '',
 papel text not null default 'cliente' check (papel in ('cliente','estagiario','admin')),
 criado_em timestamptz not null default now()
);
alter table public.perfis enable row level security;
create policy perfil_proprio on public.perfis for select to authenticated using (id=auth.uid());
create function public.criar_perfil() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.perfis(id,nome,papel) values(new.id,coalesce(new.raw_user_meta_data->>'full_name','Cliente'),'cliente');
 return new;
end; $$;
revoke all on function public.criar_perfil() from public;
create trigger usuario_criado after insert on auth.users for each row execute function public.criar_perfil();
create table public.perfil_publico (
 id boolean primary key default true check(id),
 dados jsonb not null default '{}'::jsonb
);
alter table public.perfil_publico enable row level security;
create policy leitura_institucional on public.perfil_publico for select to anon,authenticated using(true);
create table public.casos (
 id uuid primary key default gen_random_uuid(),
 cliente_id uuid not null references public.perfis(id),
 assunto text not null check(length(assunto) between 1 and 120),
 resumo text not null check(length(resumo) between 10 and 8000),
 status text not null default 'novo',
 estagiario_id uuid references public.perfis(id),
 liberado_para_estagiario boolean not null default false,
 criado_em timestamptz not null default now()
);
alter table public.casos enable row level security;
create table public.documentos (
 id uuid primary key default gen_random_uuid(),
 caso_id uuid not null references public.casos(id),
 caminho text not null unique,
 nome text not null,
 tamanho bigint not null check(tamanho between 1 and 10485760),
 tipo text not null check(tipo in ('application/pdf','text/plain','image/jpeg','image/png','image/webp')),
 criado_em timestamptz not null default now()
);
alter table public.documentos enable row level security;
create table public.tarefas (
 id uuid primary key default gen_random_uuid(),
 titulo text not null check(length(titulo) between 1 and 160),
 data date not null,
 estagiario_id uuid not null references public.perfis(id),
 concluida boolean not null default false,
 criado_em timestamptz not null default now()
);
alter table public.tarefas enable row level security;
create table public.disponibilidade (
 id boolean primary key default true check(id),
 dias_semana smallint[] not null default '{1,4}',
 inicio time not null default '09:00',
 fim time not null default '17:00',
 duracao_min integer not null default 30 check(duracao_min between 15 and 120),
 check(inicio<fim), check(dias_semana <@ array[0,1,2,3,4,5,6]::smallint[])
);
alter table public.disponibilidade enable row level security;
create table public.agendamentos (
 id uuid primary key default gen_random_uuid(),
 cliente_id uuid not null references public.perfis(id),
 inicio timestamptz not null,
 fim timestamptz not null check(fim>inicio),
 status text not null default 'pendente' check(status in ('pendente','confirmado','cancelado')),
 meet_url text,
 criado_em timestamptz not null default now()
);
alter table public.agendamentos enable row level security;
-- Restrição no banco: duas reservas ativas nunca compartilham o mesmo início.
create unique index horario_ativo_unico on public.agendamentos(inicio) where status <> 'cancelado';

-- Funções pequenas centralizam autorização nas políticas e evitam confiar no papel enviado pelo navegador.
create or replace function public.papel_atual() returns text language sql stable security definer set search_path=public as $$
  select papel from public.perfis where id=auth.uid();
$$;
revoke all on function public.papel_atual() from public;
grant execute on function public.papel_atual() to authenticated;

create policy caso_cliente on public.casos for select to authenticated
  using(cliente_id=auth.uid() or public.papel_atual()='admin'
    or (public.papel_atual()='estagiario' and liberado_para_estagiario and estagiario_id=auth.uid()));
create policy caso_criar on public.casos for insert to authenticated
  with check(cliente_id=auth.uid() and public.papel_atual()='cliente');
create policy caso_admin_atualizar on public.casos for update to authenticated
  using(public.papel_atual()='admin') with check(public.papel_atual()='admin');

create policy tarefas_admin on public.tarefas for all to authenticated
  using(public.papel_atual()='admin') with check(public.papel_atual()='admin');
create policy tarefas_estagiario_ler on public.tarefas for select to authenticated
  using(estagiario_id=auth.uid() and public.papel_atual()='estagiario');
create policy tarefas_estagiario_concluir on public.tarefas for update to authenticated
  using(estagiario_id=auth.uid() and public.papel_atual()='estagiario')
  with check(estagiario_id=auth.uid() and public.papel_atual()='estagiario');

create policy disponibilidade_publica on public.disponibilidade for select to anon,authenticated using(true);
create policy disponibilidade_admin on public.disponibilidade for all to authenticated
  using(public.papel_atual()='admin') with check(public.papel_atual()='admin');
create policy agenda_cliente_ler on public.agendamentos for select to authenticated
  using(cliente_id=auth.uid() or public.papel_atual()='admin');
create policy agenda_admin_atualizar on public.agendamentos for update to authenticated
  using(public.papel_atual()='admin') with check(public.papel_atual()='admin');

create policy documentos_cliente on public.documentos for select to authenticated
  using(exists(select 1 from public.casos c where c.id=caso_id and
    (c.cliente_id=auth.uid() or public.papel_atual()='admin' or
      (public.papel_atual()='estagiario' and c.estagiario_id=auth.uid() and c.liberado_para_estagiario))));
create policy documentos_cliente_criar on public.documentos for insert to authenticated
  with check(exists(select 1 from public.casos c where c.id=caso_id and c.cliente_id=auth.uid() and c.status='uploading'));
-- Alterações sensíveis passam por funções que controlam exatamente os campos modificados.
create function public.finalizar_caso(p_caso uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  update public.casos set status='novo' where id=p_caso and cliente_id=auth.uid() and status='uploading';
  if not found then raise exception 'Caso indisponível'; end if;
end; $$;
create function public.reservar_horario(p_inicio timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.disponibilidade%rowtype; local_inicio timestamp; v_id uuid;
begin
  if auth.uid() is null or public.papel_atual()<>'cliente' then raise exception 'Acesso negado'; end if;
  select * into d from public.disponibilidade where id=true;
  if not found then raise exception 'Agenda indisponível'; end if;
  local_inicio := p_inicio at time zone 'America/Sao_Paulo';
  if p_inicio <= now()+interval '30 minutes' or p_inicio > now()+interval '14 days'
    or not (extract(dow from local_inicio)::smallint = any(d.dias_semana))
    or local_inicio::time < d.inicio or local_inicio::time + make_interval(mins=>d.duracao_min) > d.fim
    or mod((extract(epoch from (local_inicio::time-d.inicio))/60)::integer,d.duracao_min) <> 0
  then raise exception 'Horário inválido'; end if;
  insert into public.agendamentos(cliente_id,inicio,fim)
    values(auth.uid(),p_inicio,p_inicio+make_interval(mins=>d.duracao_min)) returning id into v_id;
  return v_id;
end; $$;
create function public.cancelar_agendamento(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
  update public.agendamentos set status='cancelado',meet_url=null
    where id=p_id and cliente_id=auth.uid() and status='pendente';
  if not found then raise exception 'Agendamento indisponível'; end if;
end; $$;
revoke all on function public.finalizar_caso(uuid),public.reservar_horario(timestamptz),public.cancelar_agendamento(uuid) from public;
grant execute on function public.finalizar_caso(uuid),public.reservar_horario(timestamptz),public.cancelar_agendamento(uuid) to authenticated;
revoke update on public.casos,public.agendamentos from authenticated;
grant update(status,estagiario_id,liberado_para_estagiario) on public.casos to authenticated;
grant update(status,meet_url) on public.agendamentos to authenticated;
commit;
