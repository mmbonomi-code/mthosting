-- Reservas cargadas a mano (docs/FASE-1-ESPECIFICACION.md §2.10.bis).
--
-- Hasta ahora una reserva solo podía venir del CSV de Airbnb o del calendario
-- iCal. Se agrega un tercer origen para las que carga una persona: una
-- reserva directa fuera de Airbnb, o una de Airbnb que todavía no llegó en
-- ninguna importación.
--
-- El origen importa porque decide qué manda: sobre una reserva `csv` o
-- `ical`, Airbnb tiene la última palabra y la próxima importación pisa lo
-- editado a mano. Sobre una `manual` no hay importación que la pise, salvo
-- que se haya cargado con el código real de Airbnb, que es justamente lo que
-- permite que se fusionen solas.

alter type origen_reserva add value if not exists 'manual';
