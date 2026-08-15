-- Una limpieza movida a mano no se vuelve sola a su lugar.
--
-- QUÉ PASABA (reportado el 14/08/2026)
--
-- La limpieza de salida nace el día del check-out y el planificador la
-- mantiene ahí: si la reserva se mueve, la limpieza se mueve con ella. Eso
-- está bien cuando el que se movió es el huésped.
--
-- El problema es que no distinguía ESO de "una persona la corrió a propósito".
-- La importación vuelve a pasar el planificador sobre todas las reservas del
-- archivo —aunque no haya cambiado ninguna— y devolvía la limpieza al día del
-- check-out, pisando la decisión.
--
-- Medido sobre HONDURAS 1: la movieron al 15 cinco veces y la importación la
-- devolvió al 14 las cinco veces.
--
-- LA REGLA
--
-- Es la misma que ya rige para asignar: el sistema propone, la persona decide,
-- y lo que decidió una persona no lo pisa un recálculo (CLAUDE.md). Si después
-- la reserva se mueve de verdad, se avisa en vez de corregir por las buenas.

alter table limpiezas
  add column fecha_manual boolean not null default false;

comment on column limpiezas.fecha_manual is
  'La fecha la puso una persona, no el check-out de la reserva. El planificador no la mueve: si la reserva cambia, avisa.';

-- Se consultan por departamento y fecha; el flag viaja con esa consulta y no
-- necesita índice propio.
