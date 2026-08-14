-- Reservas archivadas en el departamento equivocado.
--
-- QUÉ PASÓ (13/08/2026)
--
-- La prueba de punta a punta del calendario le presta su `ical_url` a un
-- departamento activo real y le sirve `ejemplos/ejemplo-airbnb.ics`. Ese
-- archivo es un export REAL, y es el calendario de ED TALC 07. El
-- departamento que la prueba tomaba prestado era QUARTIER 1.
--
-- Resultado: 23 reservas de ED TALC 07 quedaron archivadas en QUARTIER 1.
-- La prueba las borraba al terminar, pero la baja fallaba en silencio por
-- clave foránea (no borraba antes los eventos de estadía), así que quedaron.
--
-- Después el importador de CSV les puso su `listing_nombre_raw`
-- ("Exclusivo depto en Recoleta 07"), pero el departamento no se corrige al
-- importar: solo se completa cuando está vacío, para no pisar una asignación
-- hecha a mano. Por eso quedaron con el anuncio de un departamento y el
-- departamento de otro.
--
-- LA REGLA QUE SE APLICA
--
-- El anuncio manda (CLAUDE.md, regla 6: el mapeo anuncio→departamento vive en
-- `listing_alias`). Una reserva cuyo anuncio dice ED TALC 07 es de ED TALC 07,
-- esté archivada donde esté.
--
-- Se excluyen a propósito las reservas que tengan una limpieza viva: mover una
-- reserva mueve la limpieza de edificio, y eso no puede pasar solo. Esas
-- quedan para que las mire una persona.

update reservas r
   set depto_id = a.depto_id
  from listing_alias a
 where a.canal = 'airbnb'
   and a.activo
   and a.nombre_listing = r.listing_nombre_raw
   and r.depto_id is not null
   and r.depto_id <> a.depto_id
   and not exists (
     select 1
       from limpiezas l
      where l.reserva_id = r.id
        and l.estado <> 'cancelada'
   );

do $$
declare
  quedan integer;
begin
  select count(*) into quedan
    from reservas r
    join listing_alias a
      on a.canal = 'airbnb' and a.activo and a.nombre_listing = r.listing_nombre_raw
   where r.depto_id is not null and r.depto_id <> a.depto_id;
  raise notice 'Reservas que siguen en un departamento que su anuncio contradice (tienen limpieza viva, se revisan a mano): %', quedan;
end;
$$;
