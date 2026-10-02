-- Rol nuevo: logística (decisión del dueño, 02/10/2026).
--
-- Es la persona que lleva la ropa blanca y saca la sucia de cada
-- departamento, deja las llaves en los candados y lleva y retira cunas y
-- sillas. Lo que ve y lo que puede marcar está en la migración siguiente.
--
-- Va sola en su archivo: un valor nuevo de un enum no se puede usar en la
-- misma transacción que lo agrega, y las funciones de la migración siguiente
-- lo nombran.

alter type rol_usuario add value if not exists 'logistica';
