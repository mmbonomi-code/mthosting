# Fase 2 — Vista del personal de limpieza

Es el módulo que decide si el proyecto sirve. El personal no usa Ninox hoy:
recibe un PDF por WhatsApp con todas las limpiezas del día, sin indicar cuáles
son suyas ni cómo entra al departamento.

No se les está cambiando de herramienta: se les está cambiando el hábito.
WhatsApp tiene fricción cero. **Todo lo que sigue existe para que la app dé
algo que WhatsApp no da.**

---

## 1. Qué gana la persona de limpieza

| Hoy | Con la app |
|---|---|
| Un PDF con las 12 limpiezas del día, la mayoría de otras personas | Solo las suyas |
| Sin instrucciones de acceso: hay que preguntar | Acceso, encargado y teléfono en pantalla |
| No sabe qué llevar hasta llegar | Sábanas, toallas y pie de baño calculados |
| No sabe qué faltaba la vez anterior | Lo ve antes de salir de casa |
| Adelanta el viático y depende de acordarse de reclamarlo | Lo carga con foto en el momento |

---

## 2. Contenido de la pantalla de una limpieza

### 2.1 Ubicación y traslado

- Dirección completa con piso y departamento.
- Barrio.
- **Botón que abre Google Maps** con la dirección cargada. Es lo primero que
  usa: necesita saber cómo llegar antes que cualquier otra cosa.

### 2.2 Ventana y carga de trabajo

- Hora de salida del huésped y hora de entrada del siguiente.
- **Noches que duró la estadía anterior.** Es la mejor señal disponible de
  cuánto trabajo va a ser: una estadía de 14 noches con 6 personas no se
  parece a una de 2 noches. Se destaca a partir de 10 noches.
- Tipo de limpieza.

### 2.3 Acceso

Método, instrucciones completas del punto de acceso, y teléfono del encargado
del edificio cuando existe.

### 2.4 Qué llevar

Se calcula del inventario del departamento (§4.2 de la spec de Fase 1). No es
texto libre: son cantidades derivadas de datos.

| Ítem | Cálculo |
|---|---|
| Juegos de sábanas | Uno por cama, discriminado por tipo: king, queen, twin, sillón cama |
| Juegos de toallas | Uno por cada huésped posible = capacidad del departamento |
| Pie de baño | Uno por cada baño del departamento |

Por eso el inventario tiene que estar cargado con cantidades reales por tipo
de cama y cantidad de baños, no como texto.

### 2.5 De la limpieza anterior

Requiere consultar la **limpieza previa del mismo departamento**, no solo la
actual. Se muestra:

- Fecha y quién la hizo.
- **Faltantes cargados esa vez**, marcados como "llevar". Es lo que evita el
  viaje perdido: si la vez pasada faltaban toallones, se entera antes de
  salir.
- Comentarios y observaciones de esa limpieza.

### 2.6 Checklist

Los checklists actuales de Ninox, migrados tal cual: Cocina (10 ítems),
Funcionamiento (7), Baño (5), Habitación (5). Con guardado local del borrador
para no perder trabajo si se corta la conexión.

### 2.7 Al terminar

- Subir fotos del departamento terminado y de problemas detectados.
  **Compresión en el cliente antes de subir**: máximo 1200 px, ~200 KB.
- Cargar faltantes contra el catálogo de ítems.
- Reportar algo para arreglar (crea un arreglo asociado a la limpieza).
- Cargar viático con foto del comprobante.
- Marcar como terminada. Se muestra el monto que cobra por esa limpieza.

---

## 3. Requisitos de diseño

- **Abre mostrando HOY** (decisión del dueño, 27/08/2026). Antes acá decía
  "mañana, no hoy", razonando que la lista se manda la noche anterior. En el
  primer uso real quedó claro que no: la pantalla se abre durante el día para
  marcar lo que se va terminando, y aterrizar en mañana hacía parecer que no
  había nada asignado. Mañana queda a un toque de la flecha.
- **Navegación hacia días anteriores, hasta 15 días atrás.** Además de
  mañana, la persona tiene que poder mirar sus limpiezas ya hechas de las
  últimas dos semanas, para repasar el detalle, el checklist o lo que dejó
  anotado. No hace falta navegar más adelante que mañana: la lista recién
  existe desde el día anterior a cada limpieza.
- Mobile-first real: teléfono de gama baja, datos móviles limitados.
- El rol `coordinador` (back office) puede ver y cargar fotos de cualquier
  limpieza, no solo de las propias.

---

## 4. Datos que esta vista exige y que Fase 1 debe dejar listos

1. `inventario_depto` cargado con cantidades reales por tipo de cama y
   cantidad de baños. Sin esto, "qué llevar" no se puede calcular.
2. `departamentos.capacidad` correcto: define los juegos de toallas.
3. `puntos_acceso.instrucciones` completos.
4. `departamentos.url_mapa` o dirección normalizada, para el botón de Maps.
5. `limpieza_faltantes` y las observaciones de cada limpieza, que son lo que
   consume la limpieza siguiente.

Los puntos 1 a 4 se cargan en la migración de Fase 1. El punto 5 se genera
solo, a partir del uso.
