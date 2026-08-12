-- Clave de origen para la importación de la caja de Ninox.
--
-- El export no trae identificador de fila, así que sin esto correr el
-- importador dos veces duplicaría los 545 movimientos y el saldo quedaría al
-- doble. Con una clave única por fila del archivo, reimportar no cambia nada
-- —la misma regla que ya cumple el importador de reservas.
--
-- Queda para cualquier importación futura, no solo la de Ninox.

alter table movimientos_caja add column ref_externa text;

create unique index idx_caja_ref_externa on movimientos_caja (ref_externa)
  where ref_externa is not null;
