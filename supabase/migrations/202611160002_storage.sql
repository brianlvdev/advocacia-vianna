insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('documentos','documentos',false,10485760,
  array['application/pdf','text/plain','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=false, file_size_limit=10485760;

-- Paths use: casos/<cliente_uuid>/<caso_uuid>/<arquivo_uuid>.<ext>
create policy documentos_ler on storage.objects for select to authenticated
using(bucket_id='documentos' and exists (
  select 1 from public.casos c
  where c.id=(storage.foldername(name))[3]::uuid
    and (c.cliente_id=auth.uid() or public.papel_atual()='admin'
      or (public.papel_atual()='estagiario' and c.estagiario_id=auth.uid() and c.liberado_para_estagiario)
)));
create policy documentos_enviar on storage.objects for insert to authenticated
with check(bucket_id='documentos' and (storage.foldername(name))[1]='casos'
  and (storage.foldername(name))[2]::uuid=auth.uid()
  and exists (select 1 from public.casos c where c.id=(storage.foldername(name))[3]::uuid
    and c.cliente_id=auth.uid() and c.status='uploading'));
