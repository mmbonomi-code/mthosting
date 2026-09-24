-- ============================================================================
-- El reparto de la caja se guarda de una sola vez (revisión, 23/09/2026).
--
-- Antes lib/caja/recalcular.ts borraba `movimiento_cobertura` entera y la
-- volvía a llenar en tandas, en llamadas separadas. Dos altas al mismo tiempo
-- dejaban el reparto duplicado (A borra, B borra, A inserta, B inserta), y un
-- corte a mitad de camino lo dejaba por la mitad.
--
-- El cálculo sigue en TypeScript (lib/caja/cobertura.ts, con tests). Acá
-- solo se guarda el resultado: en una transacción, de a una por vez, y solo
-- si la caja no cambió desde que se leyó.
-- ============================================================================

-- La huella de la caja: cambia si se agrega, se da de baja o se corrige
-- cualquier movimiento que entra en el reparto.
create or replace function firma_caja()
returns text
language sql
stable
set search_path = public
as $$
  select coalesce(
    md5(string_agg(
      concat_ws('|', id, fecha, tipo, monto, tc_cambio),
      ',' order by id
    )),
    ''
  )
  from movimientos_caja
  where activo;
$$;

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
      using errcode = '40001';
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

revoke all on function firma_caja() from public, anon;
revoke all on function guardar_cobertura(jsonb, text) from public, anon;
grant execute on function firma_caja() to authenticated, service_role;
grant execute on function guardar_cobertura(jsonb, text) to authenticated, service_role;
