-- Poder dar por resuelto un conflicto de cancelación / cambio de fecha
-- (decisión del dueño, 29/08/2026).
--
-- Esa alerta (spec §3.6, lista 4) se calcula viva: una limpieza ya en marcha
-- cuya reserva se canceló, se descartó o cambió de fecha por debajo. Como no
-- había forma de decir "ya lo miré, está bien así", el aviso quedaba prendido
-- para siempre y terminaba siendo ruido que se ignora.
--
-- Se guarda la FIRMA de lo que se dio por resuelto, no un simple booleano.
-- La firma dice qué situación exacta se revisó: `cancelada`, `descartada`, o
-- `fecha_cambio|2026-09-15`. Si después la reserva se mueve otra vez, la
-- firma nueva no coincide con la guardada y el aviso vuelve solo. Con un
-- booleano, apagarlo una vez lo apagaba para siempre y el segundo cambio de
-- fecha pasaba desapercibido.

alter table limpiezas
  add column conflicto_resuelto text;

comment on column limpiezas.conflicto_resuelto is
  'Firma del conflicto de reserva que alguien ya revisó y dio por bueno. Si la situación cambia, la firma deja de coincidir y la alerta vuelve a aparecer.';
