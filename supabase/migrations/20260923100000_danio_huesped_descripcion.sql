-- ============================================================================
-- Qué dejó mal el huésped, en palabras.
--
-- Hasta ahora esa categoría era solo fotos: la limpieza sacaba la foto de la
-- mancha y nadie sabía qué había pasado ni dónde. Del otro lado, el reclamo a
-- Airbnb se escribe a mano desde cero (pedido del dueño, 23/09/2026).
--
-- Va en la limpieza y no en una tabla aparte: es un texto por limpieza, igual
-- que `observacion_proxima`. Lo que hay que arreglar sigue en `arreglos`, que
-- son varios y tienen su propio estado.
-- ============================================================================

alter table limpiezas
  add column danio_huesped text;

comment on column limpiezas.danio_huesped is
  'Lo que dejo mal el huesped, descrito por quien limpio. Acompana a las fotos de tipo huesped y encabeza el reclamo.';
