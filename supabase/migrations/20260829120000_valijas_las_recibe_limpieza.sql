-- ============================================================================
-- Qué puntos de acceso significan "las valijas las recibe la limpieza".
--
-- El huésped que llega temprano deja las valijas en algún lado. Si quedan en
-- un lugar del edificio (Talcahuano) o en la oficina, a la limpieza le da lo
-- mismo. Pero cuando se las dejan A ELLOS —adentro del departamento o en mano—
-- tienen que saberlo antes de llegar (decisión del dueño, 29/08/2026).
--
-- Se marca con una columna, no adivinando por el nombre del punto: el nombre
-- se puede editar y no es clave de nada. Así, además, un punto nuevo se marca
-- desde la pantalla sin tocar el código.
-- ============================================================================

alter table puntos_acceso
  add column recibe_limpieza boolean not null default false;

comment on column puntos_acceso.recibe_limpieza is
  'La limpieza recibe las valijas del huesped: se le avisa en su pantalla.';

-- Los dos que hoy funcionan así.
update puntos_acceso
   set recibe_limpieza = true
 where (metodo = 'valijas' and ubicacion = 'En depto')
    or (metodo = 'presencial' and ubicacion = 'Limpieza');
