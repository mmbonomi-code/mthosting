-- guardar_cobertura() avisaba "la caja cambió" con 40001 (serialization
-- failure), y PostgREST reintenta solo ese código: la llamada quedaba dando
-- vueltas en vez de volver a TypeScript para recalcular. Pasa a un código
-- propio, que PostgREST devuelve tal cual.

create or replace function guardar_cobertura(p_filas jsonb, p_firma text)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_cantidad integer;
begin
  -- De a uno por vez: el segundo espera a que el primero termine.
  perform pg_advisory_xact_lock(hashtext('guardar_cobertura'));

  -- Si otro alta entró entre la lectura y este momento, este reparto ya
  -- nació viejo: se rechaza y quien llama vuelve a calcular.
  if firma_caja() is distinct from p_firma then
    raise exception 'la caja cambió mientras se recalculaba'
      using errcode = 'MT001';
  end if;

  -- Es un dato derivado que se rehace entero, no un dato operativo.
  delete from movimiento_cobertura where true;

  insert into movimiento_cobertura (movimiento_id, origen_id, monto, tc)
  select x.movimiento_id, x.origen_id, x.monto, x.tc
  from jsonb_to_recordset(p_filas)
    as x(movimiento_id uuid, origen_id uuid, monto numeric, tc numeric);

  get diagnostics v_cantidad = row_count;
  return v_cantidad;
end;
$$;
