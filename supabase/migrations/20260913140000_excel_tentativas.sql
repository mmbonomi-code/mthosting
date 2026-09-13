-- Excel de tentativas que se vuelve a subir (decisión del dueño, 13/09/2026).
--
-- Sin el archivo de reservas de Airbnb, lo que falta de las reservas que trae
-- el calendario (nombre, teléfono, huéspedes) y lo que confirma o descarta una
-- posible cancelación se completa en el Excel de tentativas y se sube desde
-- /importar.
--
-- 1. De dónde salió una marca de posible cancelación.
--
-- Si el Excel dice "Cancelada" pero el calendario todavía muestra la reserva,
-- no se cancela: queda marcada para que la confirmen en Alertas. Esa marca NO
-- la puede cerrar la sincronización por "volver a coincidir con el
-- calendario", porque el calendario nunca dejó de mostrarla: la cerraría a
-- la madrugada siguiente sin que nadie la mire.

alter table cambios_calendario
  add column origen text not null default 'calendario'
    check (origen in ('calendario', 'excel'));

comment on column cambios_calendario.origen is
  'calendario: la detectó la sincronización. excel: la pidió el Excel de tentativas; la sincronización no la cierra sola.';

-- 2. Qué se importó. El historial de /importar muestra las dos cosas juntas.

alter table importaciones
  add column tipo text not null default 'csv'
    check (tipo in ('csv', 'excel_tentativas'));

comment on column importaciones.tipo is
  'csv: archivo de reservas de Airbnb. excel_tentativas: el Excel de tentativas completado a mano.';
