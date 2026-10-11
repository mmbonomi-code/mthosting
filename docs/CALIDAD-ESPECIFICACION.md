# Módulo Calidad — Especificación

> Decisiones tomadas con Marcos entre el 06/10/2026 y el 07/10/2026. Lo que
> está acá es final salvo que se diga lo contrario en una decisión posterior
> fechada. Reemplaza a §3.9 y al bloque "Calidad" de §3.10 de
> `FASE-1-ESPECIFICACION.md`.

## 0. Cómo leer este documento

Es la especificación de un módulo nuevo. Se construye en este orden, y cada
paso queda funcionando y se commitea antes de empezar el siguiente:

1. Migración (§4).
2. Importación de reseñas, con su parser y sus tests (§3.1 a §3.3, §5.5).
3. Carga única del listado histórico de limpiezas (§3.5).
4. Pantalla de Calidad por departamento (§5.1).
5. Ranking de limpieza (§5.2).
6. Alertas de calidad (§3.7, §5.3).

## 1. Qué resuelve

Hoy las reseñas de Airbnb se leen una por una en Airbnb y no queda nada. El
objetivo es:

1. Saber cómo está puntuado cada departamento, en general y por categoría, y
   qué se repite cuando algo sale mal.
2. Atribuir el puntaje de limpieza a quien hizo la limpieza anterior a la
   estadía, para tener un ranking del personal de limpieza.
3. Enterarse de las reseñas malas sin tener que buscarlas.
4. Saber qué parte de los huéspedes deja reseña (tasa de reseñas).

**No** responde reseñas ni las traduce. **No** reemplaza a Airbnb como fuente:
es una copia para analizar.

## 2. Fuentes

### 2.1 Excel de reseñas

Una hoja, una fila por reseña. Columnas (las que importan en negrita):

| Columna | Uso |
|---|---|
| **ID reseña** | Clave. Identificador de Airbnb, único. |
| **ID anuncio** | Identifica el departamento (§3.2). |
| Anuncio | Solo para mostrar. Nunca es clave (regla 6 de CLAUDE.md). |
| **Huésped** | Nombre de pila. Confirma el cruce con la reserva. |
| **Check-in**, **Check-out** | Fechas de la estadía. Cruce con la reserva. |
| Noches | Se ignora: sale de las fechas. |
| **Puntaje general** | 1 a 5. |
| **Pt. Limpieza, Pt. Veracidad, Pt. Check-in, Pt. Comunicación, Pt. Ubicación, Pt. Precio-calidad** | 1 a 5 cada una. |
| **Etiquetas \<categoría\>** (6 columnas) | Texto con una etiqueta por línea: `(+) …`, `(-) …` u `Otro: …`. |
| **Reseña pública** | Texto. |
| **Comentario privado** | Texto. Puede venir vacío. |
| Respuesta anfitrión | Texto. Puede venir vacío y completarse en una carga posterior. |
| Idioma | Código (`es`, `pt`, `en`…). |

Muestra analizada: `resenas_airbnb_jun-oct_2026.xlsx`, 530 reseñas de 45
anuncios, check-in de junio al 4 de octubre de 2026.

### 2.2 Listado histórico de limpiezas

Archivo `LIMPIEZAS.xlsx`, tres columnas: `FECHA`, `DEPTO`, `RESP 1`. Del
29/05/2026 al 03/09/2026, 965 filas. Las fechas vienen en dos formatos
(fecha de Excel y texto `dd/mm/aaaa`) y se aceptan los dos.

Sirve **solo para atribuir reseñas** cuyas limpiezas no tienen responsable en
el sistema (las limpiezas se empezaron a asignar en el sistema el 02/08/2026,
y todas tienen responsable desde el 14/08/2026). Es una carga única. No tiene
pantalla propia (§3.5).

## 3. Reglas de negocio

### 3.1 Una reseña es una fila, para siempre

- La clave es `ID reseña`. Subir el mismo archivo dos veces, o dos archivos
  que se superponen, no duplica nada.
- Una reseña que ya existe se **actualiza**, con la regla general: **un valor
  vacío en el Excel nunca pisa uno cargado** (típico: la respuesta del
  anfitrión aparece en una carga posterior).
- Una reseña no se borra. Si hiciera falta sacarla del análisis, `activo =
  false`.

### 3.2 Departamento: por el ID del anuncio

El departamento sale de `ID anuncio`, que es el número que Airbnb pone en la
URL del calendario (`/calendar/ical/<ID>.ics`) y de la publicación
(`/rooms/<ID>`).

- Se guarda en `departamentos.airbnb_listing_id`. La migración lo completa a
  partir de `ical_url` y `url_publicacion` (hoy se reconocen los 45 anuncios
  del archivo de muestra).
- Un ID desconocido **no se descarta**: la reseña se guarda sin departamento y
  aparece en la previa de la importación para vincularla a mano. Vincular
  escribe `airbnb_listing_id` en el departamento.

### 3.3 Reserva: por departamento y fechas

Una reseña se une a la reserva del mismo departamento con **igual check-in e
igual check-out**, **excluyendo las canceladas**.

- Si hay más de una candidata, desempata el nombre del huésped. En la muestra
  no hace falta: los 6 casos con dos reservas en las mismas fechas eran una
  cancelada más su nueva reserva.
- Si no hay reserva (estadías anteriores a julio, que no están en el sistema),
  la reseña se guarda igual, sin `reserva_id`. Cuenta para el departamento y,
  si el listado histórico lo permite, para el ranking.
- En la muestra: las 433 reseñas con check-in desde julio encuentran su
  reserva, y en todas coincide el nombre.

### 3.4 Limpieza anterior a la estadía

La limpieza que "le toca" a una reseña es **la última limpieza del
departamento entre el check-out anterior y el check-in de la reseña**.

- Se excluyen las limpiezas canceladas y las de `rol_reserva = 'durante'`
  (son de la estadía del huésped anterior, no preparan la llegada).
- "Check-out anterior" = el check-out más reciente de una reserva no cancelada
  del mismo departamento, en o antes del check-in de la reseña. Sin reserva
  anterior conocida, se mira hasta 15 días para atrás.
- La limpieza puede ser del mismo día del check-out o de días después: en el
  listado histórico, muchas limpiezas son del día siguiente al check-out.
  **No se compara por fecha exacta.**

### 3.5 Responsable de esa limpieza

Una limpieza la hace siempre **una sola persona** (decisión del dueño,
07/10/2026).

1. Si la limpieza del sistema tiene `asignado_a`, el responsable es ese.
   **El sistema manda.** En las 108 limpiezas que están en los dos lados,
   coinciden 106.
2. Si no, se toma del listado histórico (tabla `limpiezas_historicas`), con
   la misma regla de §3.4.
3. Si no hay ninguno, la reseña queda **sin atribuir**. No se reparte ni se
   adivina.

El listado histórico **no toca la tabla `limpiezas`**: asignar una limpieza
copia `monto_pactado` y eso desemboca en pagos. Cargar julio y agosto hacia
atrás inventaría deudas que ya se pagaron por fuera.

Equivalencias del listado, confirmadas el 07/10/2026:

| En el listado | En el sistema |
|---|---|
| `ED TALC 10` | `ED TALC 33` |
| `MARCELO T. 1/2/3` | `MARCELO T 1/2/3` |

Rocío, Elsa y Daiana figuran en el listado pero no en Personal. Ninguna de
sus filas cae antes de una reseña, así que no se dan de alta.

Resultado con la muestra: **513 de 530 reseñas con responsable**; quedan 17
sin atribuir (estadías de febrero a mayo, anteriores al listado).

La atribución **no se guarda: se calcula** en una vista (§4.4). Si mañana se
corrige la asignación de una limpieza, el ranking se corrige solo.

### 3.6 Tasa de reseñas

    tasa = estadías con reseña / estadías terminadas

- Estadías terminadas: reservas no canceladas ni descartadas cuyo check-out
  fue **hace más de 14 días** (el plazo que da Airbnb para dejar reseña).
  Contar las recientes bajaría la tasa artificialmente.
- Por departamento y total, en el período elegido.
- Solo desde julio de 2026: antes no hay reservas en el sistema y daría una
  tasa inflada.
- Muestra: 52 % (422 de 806 estadías con check-out entre el 01/07 y el
  23/09).

### 3.7 Alertas

Una reseña genera alerta si cumple **cualquiera** de:

| Motivo | Regla | En la muestra |
|---|---|---|
| General baja | Puntaje general ≤ 3 | 33 |
| Categoría baja | Alguna categoría ≤ 2 (con general ≥ 4) | 5 |
| 4 estrellas con queja | General = 4 y al menos una etiqueta `(-)` | 8 |

Total en la muestra: 46 en cuatro meses, unas 11 por mes.

- Una alerta se da por revisada con el mismo criterio de `alerta_revisada`
  (pero en su propia tabla, `resena_revisada`): se guarda una **firma** (puntajes + etiquetas negativas). Si una carga
  posterior cambia la reseña, la alerta vuelve.
- Solo se alertan reseñas con check-out desde la fecha de la primera
  importación menos 30 días. Las viejas se ven en el listado de reseñas, pero
  no llenan la bandeja de una vez.

### 3.8 Quién ve qué

**Todo el módulo lo ven solo manager y administración** (decisión del dueño,
07/10/2026). Eso incluye comentarios privados, ranking y alertas de calidad.

- Las alertas de calidad **no van al panel general de Alertas**, porque ese
  panel también lo ve coordinación. Viven adentro de Calidad, con su contador
  en el menú.
- El personal de limpieza no ve el ranking ni sus propias reseñas.

A diferencia de las credenciales de Airbnb, esto **sí se cierra en la base**:
las tablas nuevas nacen con RLS para `admin` y `manager`. Leen
`mi_rol()`, como `alerta_revisada`.

## 4. Modelo de datos

Todo en una migración. Fechas de negocio en `date`. Auditoría con
`audit_trigger()` y `updated_at` con `set_updated_at()`, como el resto.

### 4.1 `departamentos.airbnb_listing_id`

`text`, único cuando no es nulo. La migración lo completa con el número que
aparece en `ical_url` o en `url_publicacion`.

### 4.2 `resenas`

| Campo | Tipo | Nota |
|---|---|---|
| id | uuid pk | |
| airbnb_resena_id | text not null unique | Clave natural del upsert. |
| airbnb_listing_id | text not null | Tal como vino. |
| depto_id | uuid fk null | Null = anuncio sin vincular. |
| reserva_id | uuid fk null | Null = estadía fuera del sistema. |
| anuncio_raw | text | Nombre del anuncio, solo para mostrar. |
| huesped_nombre | text | |
| fecha_checkin, fecha_checkout | date not null | |
| puntaje_general | smallint 1-5 | |
| puntaje_limpieza … puntaje_precio | smallint 1-5 | Seis columnas. |
| resena_publica, comentario_privado, respuesta_anfitrion | text | |
| idioma | text | |
| raw | jsonb | Fila original. |
| import_id | uuid fk `importaciones_resenas` | Última carga que la tocó. |
| activo | boolean default true | |

Índices: `(depto_id, fecha_checkout)`, `reserva_id`.

### 4.3 `resena_etiquetas`

Una fila por línea de etiqueta: `resena_id`, `categoria` (enum de las seis),
`signo` (`positiva` / `negativa` / `otro`), `texto`. Unique en
`(resena_id, categoria, texto)`. Se reescriben enteras al actualizar la
reseña, salvo que la columna venga vacía (regla de no pisar con vacío).

Sirven para contar ("en MARCELO T 2, 3 veces *Necesita mantenimiento*").

### 4.4 `limpiezas_historicas`

`depto_id`, `fecha date`, `persona_id`, `origen text` ('listado
LIMPIEZAS.xlsx'). Unique en `(depto_id, fecha, persona_id)`. Solo lectura
después de la carga.

### 4.5 Vista `resenas_atribuidas`

Une cada reseña con su limpieza anterior y su responsable según §3.4 y §3.5,
con un `LATERAL ... ORDER BY fecha DESC LIMIT 1` por reseña. Columnas
agregadas: `limpieza_id`, `responsable_id`, `origen_responsable`
(`sistema` / `listado` / null). Usa el índice `limpiezas (depto_id, fecha)`
que ya existe.

### 4.6 `resena_revisada`

Tabla propia: `resena_id` (único), `firma`, `revisada_por`. **No** se
reutiliza `alerta_revisada`: exige `limpieza_id` y el panel de Alertas
depende de eso; tocarla arriesgaba lo que ya funciona (decidido al escribir
la migración, 11/10/2026).

### 4.6 bis `importaciones_resenas`

Una fila por Excel confirmado: nombre, hash, y cuántas nuevas, actualizadas,
sin cambios, sin departamento y sin reserva. **No** se usa `importaciones`,
que es el lote del importador de reservas: se lista y se deshace desde
/importar, y una carga de reseñas ahí sería un peligro.

### 4.6 ter Auditoría

`audit_trigger` en `limpiezas_historicas` y `resena_revisada`. **No** en
`resenas` ni `resena_etiquetas`: son copia de Airbnb (la trazabilidad la dan
`import_id` y `raw`), y el diff del log llevaría los comentarios privados a
`audit_log`, que leen todos los roles de oficina.

### 4.6 quater Permisos

Una función, `puede_ver_calidad()` (manager y admin), usada por las
políticas de las cinco tablas. La vista `resenas_atribuidas` es
`security_invoker`, así la cierra el mismo RLS.

### 4.7 `puntajes_calidad`

Se elimina. Está vacía y nada la usa: era el formato de dos columnas que
preveía §3.9, superado por este.

## 5. Pantallas

Ruta `/calidad`, solo manager y administración (`lib/secciones.ts`).

### 5.1 `/calidad` — Resumen y departamentos

- Período arriba (por defecto: últimos 90 días por check-out), con el mismo
  navegador de período que el dashboard.
- Cifras del período: puntaje general, % de 5 estrellas, tasa de reseñas,
  cantidad de reseñas, alertas abiertas.
- Promedio por categoría (seis cifras).
- Tabla por departamento, ordenada de peor a mejor: reseñas, general, las seis
  categorías, tasa, la etiqueta negativa más repetida, alertas abiertas.
  - Una categoría que queda por debajo de 4,5 se pinta `aviso`.
  - Con menos de 3 reseñas en el período, el promedio va en `tinta-etiqueta`
    con la cantidad al lado: no se lee igual un 3,0 de dos reseñas que de
    veinte.
- Tocar un departamento abre sus reseñas (§5.4) filtradas.

### 5.2 `/calidad/limpieza` — Ranking

- Una fila por persona: reseñas atribuidas, promedio de limpieza, % de 5 en
  limpieza, reseñas con limpieza ≤ 3, reseñas con etiqueta negativa de
  limpieza.
- Orden por promedio de limpieza. **Mínimo 10 reseñas en el período** para
  entrar al orden; quien tiene menos aparece abajo, aparte, sin posición.
- Se informa cuántas reseñas del período quedaron sin atribuir.
- Tocar una persona abre sus reseñas.

### 5.3 `/calidad/alertas`

Bandeja de reseñas que cumplen §3.7 y no están revisadas. Cada tarjeta:
departamento, fechas, huésped, puntajes (con las categorías bajas resaltadas),
etiquetas negativas, reseña pública, comentario privado, responsable de la
limpieza anterior y origen. Botón **Revisada**.

Si la etiqueta es de mantenimiento o de algo roto (`Necesita mantenimiento`,
`<Equipo>: Estaba roto…`), la tarjeta ofrece **Crear arreglo** con el
departamento ya elegido. El arreglo se ata a la limpieza anterior a la estadía
(el panel de Alertas muestra los arreglos por limpieza) o, si no hay una en el
sistema, a la próxima limpieza del departamento. En `notas` queda
`resena:<id>`, que impide crearlo dos veces.

Contador en el menú: `aviso`.

### 5.4 `/calidad/resenas`

Listado paginado de reseñas, con filtros por departamento, persona, puntaje y
"con etiqueta negativa". Cada fila abre la reseña completa.

### 5.5 `/calidad/importar` — Solo escritorio

1. Se sube el Excel. El parser valida encabezados y fechas.
2. **Previa, sin escribir nada:** nuevas, que se actualizan, sin cambios;
   anuncios sin vincular (con selector de departamento); reseñas sin reserva;
   alertas nuevas que va a generar.
3. **Confirmar** escribe todo y registra la carga en `importaciones`.

## 6. Tests obligatorios

- Parser: fechas como fecha de Excel y como texto `dd/mm/aaaa`; puntajes
  fuera de 1-5 rechazan la fila; etiquetas con `(+)`, `(-)`, `Otro:` y
  líneas en blanco.
- Upsert: subir dos veces el mismo archivo deja las mismas filas;
  un vacío no pisa un valor cargado; la respuesta del anfitrión que aparece
  después se completa.
- Cruce con reservas: ignora canceladas; dos candidatas desempatan por nombre.
- Atribución: limpieza del día siguiente al check-out; limpieza `durante`
  ignorada; sistema gana sobre listado; sin datos queda sin atribuir.
- Tasa: no cuenta estadías con check-out de los últimos 14 días.
- Alertas: los tres motivos; la firma reabre una alerta revisada si cambia la
  reseña.
