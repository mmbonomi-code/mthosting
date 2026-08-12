-- El índice de `ref_externa` era parcial (`where ref_externa is not null`) y
-- así `on conflict` no lo puede usar: Postgres exige que la sentencia repita
-- el mismo predicado, cosa que el cliente no hace.
--
-- Un índice único completo sirve igual: en Postgres dos nulos no chocan entre
-- sí, así que los movimientos cargados a mano —que no tienen referencia de
-- origen— siguen pudiendo ser muchos.

drop index idx_caja_ref_externa;

create unique index idx_caja_ref_externa on movimientos_caja (ref_externa);
