-- El 9 después del +54 en los teléfonos ya cargados.
--
-- Airbnb entrega los contactos argentinos sin el 9 (`+54 11 4428-2700`). Sin
-- ese dígito el número no sirve para WhatsApp ni para llamar desde afuera del
-- país. Desde ahora el importador lo agrega al entrar (lib/telefono.ts); esta
-- migración arregla lo que ya estaba.
--
-- El caso se reconoce sin ambigüedad: empieza con 54, no con 549 (ningún
-- código de área argentino empieza con 9, así que un 549 solo puede ser el 9
-- del móvil ya puesto) y tiene 12 dígitos, que es 54 + los 10 nacionales.
-- Cualquier otra cosa se deja intacta.

update reservas
set huesped_contacto = regexp_replace(huesped_contacto, '^(\D*5\D*4)', '\1 9')
where huesped_contacto is not null
  and length(regexp_replace(huesped_contacto, '\D', '', 'g')) = 12
  and regexp_replace(huesped_contacto, '\D', '', 'g') like '54%'
  and regexp_replace(huesped_contacto, '\D', '', 'g') not like '549%';
