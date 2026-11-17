-- O projeto concede EXECUTE para anon por padrão; remover explicitamente.
revoke execute on function public.criar_perfil() from anon, authenticated;
revoke execute on function public.papel_atual() from anon;
revoke execute on function public.finalizar_caso(uuid) from anon;
revoke execute on function public.reservar_horario(timestamptz) from anon;
revoke execute on function public.cancelar_agendamento(uuid) from anon;
