-- Storage para la vista de limpiadora (Fase 2): fotos de la limpieza
-- terminada, de arreglos y de lo que dejó mal el huésped, y el comprobante
-- del viático. Bucket privado, mismo criterio que reclamos y comprobantes de
-- caja: se sirve siempre por URL firmada generada en el servidor, nunca por
-- link público.

insert into storage.buckets (id, name, public)
values ('limpiezas', 'limpiezas', false)
on conflict (id) do nothing;

create policy limpiezas_storage_autenticados on storage.objects
  for all to authenticated
  using (bucket_id = 'limpiezas')
  with check (bucket_id = 'limpiezas');
