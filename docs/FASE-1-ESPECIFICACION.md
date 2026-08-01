# Fase 1 — Especificación técnica

Reemplaza el núcleo operativo de Ninox: departamentos, reservas, check-in/out,
limpiezas, export PDF diario y exportables de contactos. Las convenciones
generales están en `CLAUDE.md` y mandan sobre cualquier cosa que acá falte.

**Diseño responsive**: las pantallas de check-in/out y de asignación de
limpiezas se diseñan **mobile-first** (§3). La importación es solo escritorio.

---

## 1. Modelo de datos

La migración inicial crea **todo** el esquema, incluidas las tablas sin UI en
esta fase. Todas las tablas llevan `id uuid PK default gen_random_uuid()`,
`created_at` y `updated_at`.

### 1.0 Concepto: semana de pago

El negocio paga las limpiezas **una vez por semana, los viernes**: se paga lo
realizado entre el **viernes anterior y el jueves**. Esa ventana
viernes→jueves es la **semana de pago** y es la unidad natural de corte para
la distribución de trabajo (§3.11) y, más adelante, para los pagos al personal
(Fase 4).

- Por defecto, el día de corte es **viernes**. Se deja configurable en
  parámetros operativos (§3.7) por si alguna vez cambia, pero el default es
  viernes y no requiere tocar nada.
- Donde se muestre "la semana", se entiende viernes→jueves, no
  lunes→domingo.
- Siempre debe existir la opción de un **rango de fechas libre** para
  excepciones.

### 1.1 Tablas con UI en Fase 1

**personas** — tabla única de personas. Reemplaza los tres lugares donde Ninox
las duplicaba.

| campo | tipo | notas |
|---|---|---|
| profile_id | uuid fk nullable | → auth.users. Null si no tiene acceso a la app |
| nombre | text | |
| telefono | text | |
| hace_limpieza | bool | |
| hace_checkin | bool | |
| es_backoffice | bool | |
| modalidad_pago | enum | por_limpieza / sueldo_mensual / ambas |
| activo | bool | al desactivar sale de los desplegables, el histórico queda |

**propietarios** — nombre, contacto, comision_pct, acuerdo_pago (enum:
cobra_todo_mth / cobra_cada_uno / solo_comision), cuenta_cobro,
datos_bancarios, activo.

**departamentos**

| campo | tipo | notas |
|---|---|---|
| codigo | text unique | ej: ARAOZ1 |
| nombre_interno | text | nombre propio de MTHosting, no de Airbnb |
| propietario_id | fk | |
| estado | enum | activo / suspendido |
| direccion | text | completa, con piso y depto |
| barrio | text | para agrupar limpiezas por zona |
| ambientes | enum | monoambiente / dos / tres / cuatro — driver de tarifa |
| habitaciones, capacidad | int | |
| wifi_ssid, wifi_pass | text | consultables desde el celular (§3.1) |
| airbnb_user, airbnb_pass | text | CIFRADOS, solo rol admin |
| url_publicacion, url_mapa | text | |
| ical_url | text nullable | calendario iCal de Airbnb. Ver §2.12 |
| encargado_nombre, encargado_telefono | text | editables, dentro de "Propiedad" |
| propietario_telefono | text | editable, dentro de "Propiedad" |
| self_checkout | enum | siempre / solo_multiples / no. Ver §2.11 |
| **requiere_registro** | bool | si es false, el check-in no muestra el ítem |
| **requiere_aviso_seguridad** | bool | idem |
| indicaciones_acceso | text | editable. Recorrido, dónde está la llave de luz, indicaciones del portero |
| indicaciones_archivos | archivo[] | fotos o PDFs del acceso, cargables |
| trabajo_verificado | bool | |
| observacion | text | nota libre del departamento |
| activo | bool | |

Los dos campos `requiere_*` distinguen **"no corresponde"** de **"falta
hacerlo"**. Hoy en Ninox una celda vacía significa las dos cosas.

**listing_alias** — depto_id fk, canal (enum: airbnb/booking/directa),
nombre_listing text (tal cual viene en el CSV), activo bool. Unique en
(canal, nombre_listing).

Se gestiona desde **dos lugares**: la bandeja de importación (cuando un anuncio
nuevo cae sin mapear) y la **ficha del departamento**, donde se pueden agregar,
editar o quitar a mano los nombres de anuncio vinculados. Los anuncios de
Airbnb se renombran, así que la lista tiene que ser editable sin depender de
que caiga en la bandeja.

**puntos_acceso** — tabla de equivalencias administrable desde la UI (alta,
baja y edición sin tocar código).

| campo | tipo | notas |
|---|---|---|
| metodo | enum | presencial / candado / sobre / valijas / self / llaves |
| ubicacion | text | Talcahuano, Esmeralda, Kennedy 3, En el depto… |
| identificador | text nullable | #2906, #1080 |
| instrucciones | text | se muestran en la ficha de la reserva |
| sirve_checkin, sirve_checkout | bool | unifica las dos listas divergentes de Ninox |
| activo | bool | |

Un punto de acceso **no pertenece a un departamento**: un mismo candado o
sobre puede servir a varios (ej. Candado Kennedy 3 sirve a BORGES 1 y BORGES
2). Por eso es tabla propia y el historial de llaves cuelga de acá, no del
departamento.

**movimientos_acceso** — historial de llaves por punto de acceso.

| campo | tipo | notas |
|---|---|---|
| punto_acceso_id | fk | |
| evento_id | fk eventos_estadia | de qué check-in/out salió |
| depto_id | fk | a qué depto corresponde ese movimiento |
| tipo | enum | dejada / retirada |
| confirmado | bool | el `acceso_dejado` del evento |
| persona_id | fk nullable | quién la dejó |

Los movimientos se generan **automáticamente** al coordinar un check-in o
check-out con método físico:

- **Check-in** con método físico → el equipo deja la llave/sobre: movimiento
  `dejada`, con confirmación manual (`acceso_dejado`).
- **Check-out** con método físico → el huésped deja la llave al irse:
  movimiento `dejada` también, pero **sin confirmación del equipo**, porque no
  lo hace el equipo. (La "retirada" es cuando el próximo huésped la toma.)

El "cuántas llaves hay adentro ahora" se calcula sumando dejadas menos
retiradas: no es un campo que haya que mantener. La confirmación manual existe
solo del lado del check-in, que es lo único que depende del equipo.

**reservas**

| campo | tipo | notas |
|---|---|---|
| codigo_reserva | text UNIQUE | clave natural del upsert |
| canal | enum | airbnb / booking / directa |
| origen | enum | csv / ical. De dónde se creó |
| datos_completos | bool | false si vino solo del iCal y falta el CSV |
| depto_id | fk NULLABLE | null = bandeja de sin asignar |
| listing_nombre_raw | text | |
| huesped_nombre, huesped_contacto | text | |
| adultos, ninos, bebes, noches | int | |
| fecha_checkin, fecha_checkout | date | |
| fecha_checkout_real | date nullable | si cancelan una estadía en curso (§2.8) |
| fecha_reservada | date | columna "Reservada" del CSV |
| cancelada | bool | ver §2.4 |
| payout_monto | numeric | columna "Ganancias" |
| payout_moneda | text | 'USD' |
| registro_hecho, aviso_seguridad_hecho, sobre_ok | bool | |
| llegada_desde | enum nullable | depto / eze / aep / bqb |
| descartada | bool | oculta por manager/admin. Nunca DELETE físico. Vuelve a false si reaparece en una importación |
| raw | jsonb | fila original completa, siempre |
| import_id | fk | |

**importaciones** — lote: archivos jsonb (nombre + hash de cada uno),
usuario_id, filas_total, nuevas, actualizadas, sin_cambios, sin_asignar,
canceladas_detectadas, descartadas_reaparecidas, anomalias jsonb.

**eventos_estadia**

| campo | tipo | notas |
|---|---|---|
| reserva_id | fk | |
| tipo | enum | checkin / checkout |
| fecha_coordinada | date nullable | lo que se acordó con el huésped. Puede diferir de la fecha de la reserva |
| hora_coordinada | time nullable | |
| punto_acceso_id | fk nullable | |
| responsable_id | fk personas nullable | check-in presencial |
| punto_devolucion_id | fk puntos_acceso nullable | check-out. Desplegable, hereda del depto |
| responsable_devolucion_id | fk personas nullable | check-out presencial. Uno u otro |
| late_checkout | bool | solo checkout. Ver §2.9 |
| acceso_dejado | bool | confirmación manual de que el equipo dejó el sobre/llave. **Solo check-in**: en el check-out la llave la deja el huésped |
| estado | enum | pendiente / coordinado / hecho / cancelado |
| observaciones | text | |

CHECK: no pueden estar `punto_acceso_id` y `responsable_id` a la vez.

**tarifas** — versionadas por fecha.

| campo | tipo | notas |
|---|---|---|
| ambientes | enum nullable | |
| depto_id | fk nullable | excepción puntual |
| monto, moneda | numeric, text | |
| vigente_desde | date | lo carga el usuario: "desde el 20/7 rigen estos valores" |
| vigente_hasta | date nullable | null = vigente. Lo cierra el sistema al crear la siguiente |

La UI de tarifas permite cargar un juego nuevo de valores con una fecha
`desde`. Al guardar, el sistema cierra automáticamente las filas anteriores
con `vigente_hasta = desde - 1 día`. **Nunca se hace UPDATE del monto.**

**limpiezas**

| campo | tipo | notas |
|---|---|---|
| depto_id | fk NOT NULL | directa, nunca derivada de la reserva |
| reserva_id | fk nullable | |
| rol_reserva | enum nullable | salida / entrada / durante |
| fecha | date | |
| hora_checkout | time nullable | |
| prox_checkin | timestamp nullable | ventana disponible |
| tipo | enum | inicial / repaso / normal / cambio_blancos / con_huespedes / desmantelar / propietario |
| urgente | bool | true si hay check-in del mismo depto ese día |
| asignado_a | fk personas nullable | |
| estado | enum | pendiente / asignada / en_curso / hecha / verificada / cancelada |
| hora_inicio, hora_fin | timestamptz nullable | Fase 2 |
| monto_pactado | numeric nullable | snapshot al asignar, no se recalcula jamás |
| pago_doble | bool | domingo o feriado |
| moneda | text | |
| tarifa_id | fk nullable | trazabilidad |
| viatico_monto, viatico_comprobante, viatico_aprobado | | creados, se usan en Fase 2 |
| notas | text | |

**bloqueos** — depto_id, fecha_desde, fecha_hasta, motivo (enum:
mantenimiento / uso_propietario / vacio / otro), notas.

**feriados** — fecha date unique, descripcion. Carga manual. Afecta
`pago_doble`.

**puntajes_calidad** — codigo_reserva fk, puntaje int (1-5), comentario text
nullable, fecha date, import_id. Se importa desde un Excel con código de
reserva + puntaje (§3.9). Un puntaje sin reserva conocida se informa aparte.

**audit_log** — tabla, registro_id, usuario_id, accion, diff jsonb, at.
Trigger genérico.

### 1.2 Tablas creadas sin UI (fases posteriores)

- `distribucion_depto`, `item_catalogo`, `inventario_depto`
- `limpieza_checklist`, `limpieza_fotos`, `limpieza_faltantes`
- `arreglos`, `arreglo_fotos`, `prestadores`, `reclamos`, `reportes`
- `cuentas`, `categorias_gasto`, `gastos`, `cotizaciones`,
  `liquidaciones`, `liquidacion_lineas`, `pagos_personal`

**No existe** ningún módulo equivalente a CHECK LIST NOCHE de Ninox: se
descarta y no se migra.

---

## 2. Importador de reservas

Solo escritorio. Todas las reglas de esta sección tienen test.

### 2.1 Formato del archivo

CSV UTF-8 de Airbnb, hasta ~40 filas, con estas columnas exactas:

```
"Código de confirmación","Estado","Nombre del huésped","Contacto",
"Número de adultos","Número de niños","Número de bebés","Fecha de inicio",
"Fecha de finalización","Número de noches","Reservada","Anuncio","Ganancias"
```

Si el encabezado no coincide, el lote se rechaza entero con un mensaje claro.
Nunca importar "lo que se pueda".

### 2.2 Fechas — dos formatos en el mismo archivo

- `Fecha de inicio` / `Fecha de finalización`: `d/m/yyyy` **sin ceros a la
  izquierda** (`15/7/2026`, `5/7/2026`). Parsear forzando día-primero.
  PROHIBIDO dejar que la librería adivine: `5/7/2026` leído como formato
  estadounidense da 7 de mayo.
- `Reservada`: ISO `yyyy-mm-dd`.

### 2.3 Ganancias

Formato: `$` + espacio duro (`\xa0`) + número. **El mismo archivo mezcla coma
y punto decimal** (`$ 93,53` y `$ 0.00`). Moneda USD.

1. Quitar `$`, `\xa0` y espacios.
2. Si contiene coma → quitar los puntos (miles) y convertir la coma en punto.
3. Si no contiene coma → parsear directo.

Tests: `$ 93,53` → 93.53; `$ 0.00` → 0; `$ 1.234,56` → 1234.56 (caso > 1000,
ausente en la muestra, es donde un parser invertido convierte 1.234 dólares
en 1,234).

Las canceladas pueden tener Ganancias > 0 (retención por política). No asumir
cancelada ⇒ 0.

### 2.4 La columna "Estado" NO es un estado

Valores observados: "Estadía en curso", "Se va hoy", "Evaluá al huésped",
"Cancelación por parte del viajero". Son etiquetas de la interfaz de Airbnb
**relativas al día de la exportación**: la misma reserva muestra valores
distintos según cuándo se exporta. No persistir ese texto como estado.

Solo se extrae `cancelada = /cancel/i.test(estado)` (case-insensitive). El
texto crudo queda en `raw`.

`cancelada` es **terminal**: si un archivo posterior trae la misma reserva sin
marca de cancelación, NO se revierte; se registra como anomalía.

### 2.5 Upsert y preservación

- Upsert por `codigo_reserva`.
- **Nunca sobrescribir un valor existente con uno vacío.** Airbnb borra el
  contacto al cancelar; el sistema conserva lo anterior. Regla genérica.
- `raw` e `import_id` sí se actualizan siempre.
- Re-importar un archivo idéntico produce cero cambios.

### 2.6 Lote múltiple

- Se suben varios CSV juntos; se ordenan por el timestamp del nombre
  (`reservations_-_2026-07-18T080825_717.csv`). Nombre que no parsea → al
  final, con warning.
- Si el mismo código aparece en más de un archivo, gana el más reciente.
- **Transaccional por lote**: si un archivo está corrupto, no queda nada a
  medio importar.
- Un solo resumen final: nuevas / actualizadas / sin cambios / sin
  departamento / canceladas / descartadas que reaparecieron / anomalías.
- La **ausencia** de una reserva en un archivo no significa nada. Solo se
  procesan las filas presentes.

### 2.7 Resolución de departamento

- `Anuncio` se busca en `listing_alias` (canal airbnb, activo). Sin match → la
  reserva entra con `depto_id null` y aparece en la **bandeja de sin asignar**.
- Al mapear manualmente, se crea el alias: no se vuelve a preguntar.
- Variantes casi idénticas ("Exclusivo depto en Recoleta 05" vs "Exclusivo
  depto. en Recoleta 33") son alias distintos. Es correcto, no un bug.

### 2.8 Efectos de cada import

Para cada reserva nueva o modificada, en la misma transacción:

1. **Eventos**: se crean/actualizan los dos `eventos_estadia`.
2. **Limpieza de salida**: cada checkout genera limpieza `tipo normal`,
   `rol_reserva salida`, `fecha = fecha_checkout`, estado `pendiente`, sin
   responsable.
3. **Repaso**: si un check-in no tiene check-out previo en ese departamento
   (primera reserva, o hueco tras un bloqueo), se genera limpieza
   `tipo repaso`, `rol_reserva entrada`, previa al check-in.
4. **urgente** = existe check-in del mismo `depto_id` esa fecha (excluyendo
   canceladas).
5. **prox_checkin** = próximo check-in del mismo `depto_id` (por depto, NUNCA
   por nombre de anuncio; excluyendo canceladas).
6. **Cambio de fechas**: se actualizan los eventos. **La limpieza NO se mueve.**
   Ver §2.10.

#### 2.8.bis Las tres fechas

Son tres conceptos distintos y no deben mezclarse en un mismo campo:

| Concepto | Dónde vive | Quién la cambia |
|---|---|---|
| **Fecha de la reserva** | `reservas.fecha_checkin` / `fecha_checkout` | Solo la importación de Airbnb. Es la fecha contractual |
| **Fecha coordinada** | `eventos_estadia.fecha_coordinada` + `hora_coordinada` | Back office, al coordinar con el huésped |
| **Fecha de limpieza** | `limpiezas.fecha` | Se genera desde la fecha de la reserva. Después, la manager |

Ejemplo: la reserva termina el 23/7. Al coordinar, el huésped avisa que se va
el 22 a las 15. Se carga `fecha_coordinada = 22/7`, `hora_coordinada = 15:00`.
**La fecha de check-out de la reserva sigue siendo el 23** y la limpieza sigue
planificada para el 23: el departamento está pago hasta esa fecha y no hay
apuro por limpiarlo antes. Si la manager quiere aprovechar la salida
anticipada, mueve la limpieza a mano.

Lo mismo del lado de la entrada: un check-in del 19 con llegada coordinada
para el 20 a las 9.

#### 2.8.ter Movimiento de limpiezas

| Qué cambia | Efecto sobre la limpieza |
|---|---|
| La **fecha de la reserva** cambia (llega por importación) | **La limpieza se mueve con ella.** La reserva cambió de verdad |
| Se carga o cambia una **fecha coordinada** | **No se mueve nada.** Es información de coordinación |
| Late check-out sin check-in ese día | Se mueve al día siguiente (§2.9) |
| Cualquier otro caso | Solo la manager, a mano |

Excepción absoluta en todos los casos: una limpieza en `en_curso`, `hecha` o
`verificada` **no se mueve nunca**. Si la fecha de la reserva cambia y la
limpieza está en uno de esos estados, se genera alerta y decide una persona.

### 2.8.quater Ventana insuficiente entre salida y entrada

Cuando en un mismo departamento y un mismo día hay check-out y check-in, el
sistema evalúa si la ventana alcanza para limpiar. Se usan las horas
**coordinadas** cuando existen; si no, las de la reserva.

Se genera alerta cuando:

```
hora_salida  >  config.hora_limite_checkout   (default 11:00)
   Y
hora_entrada <  config.hora_minima_checkin    (default 12:00)
```

Ambos umbrales son configuración editable (§3.7), no valores fijos en código:
si el check-out estándar pasa a las 10:00, se ajusta sin tocar el sistema.

Es una alerta distinta de `urgente`. `urgente` marca que hay salida y entrada
el mismo día. Esta marca que la ventana es **materialmente imposible**. Va
junto con la de estadía ocupada, al tope del panel (§3.6).

La alerta no bloquea ni mueve nada: la resuelve una persona, negociando el
horario con uno de los dos huéspedes.

### 2.11 Self check-out configurable por departamento

El campo `departamentos.self_checkout` define si el huésped puede irse solo:

| Valor | Comportamiento al elegir self en la reserva | Instrucción que muestra |
|---|---|---|
| `siempre` | Self directo, cualquier cantidad de huéspedes | "Dejan las llaves adentro y salen" |
| `solo_multiples` | Con 2+ huéspedes: self permitido. Con 1 huésped: **avisa** y pide confirmación | 2+: "Bajan, abren la puerta, uno sube a dejar las llaves y baja". 1: alerta de que puede quedar trabado afuera |
| `no` | Bloquea self: obliga a asignar responsable o punto de acceso | — |

El caso de 1 huésped en `solo_multiples` existe porque, si el acceso al
edificio requiere la misma llave que se deja adentro, una persona sola queda
sin forma de devolverla y sin reingreso. Con 2+ personas, una sostiene el
acceso mientras otra devuelve.

El mensaje aparece en el momento de elegir "self" en la ficha de check-out, no
después.

### 2.12 Sincronización por iCal

Cada departamento puede tener una `ical_url` de Airbnb. El sistema la lee de
forma automática **cada pocas horas**, más un botón de "sincronizar ahora".
Complementa el CSV, no lo reemplaza.

**Formato real** (verificado contra un `.ics` de producción):

```
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260726
DTEND;VALUE=DATE:20260728
SUMMARY:Reserved
UID:1418fb94e984-11dec2a327e4a2c9955aa259afa29bda@airbnb.com
DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/de
 tails/HMWHAKBNE2\nPhone Number (Last 4 Digits): 5778
END:VEVENT
```

Qué trae cada campo:

| Campo | Contenido | Uso |
|---|---|---|
| `DTSTART` / `DTEND` | Fecha de inicio y fin (formato `AAAAMMDD`) | Fechas de la reserva |
| `SUMMARY` | `Reserved` o `Airbnb (Not available)` | Distingue reserva de bloqueo |
| `DESCRIPTION` | URL con `.../details/HMXXXXXXXX` + últimos 4 dígitos del teléfono | Código de reserva (clave) y dato de teléfono |
| `UID` | Identificador interno del evento | No es el código de reserva; ignorar |

**Reglas de parseo (con test obligatorio contra un `.ics` real):**

1. **Desdoblado RFC 5545 primero.** Las líneas largas se parten con `CRLF` +
   espacio, y el código de reserva viene cortado a la mitad
   (`...de\r\n tails/HM...`). Hay que unir esas líneas ANTES de extraer nada.
   Un parser que no lo haga encuentra **cero códigos y no lanza error**: falla
   en silencio. Este es el riesgo principal de la feature.
2. **Código**: extraer de `DESCRIPTION`, patrón `details/([A-Z0-9]{8,12})`.
   Formato observado: `HM` + 8 caracteres, en el 100% de las reservas.
3. **Teléfono (últimos 4)**: `Last 4 Digits\): (\d{4})`. Se guarda como dato
   —puede ayudar a identificar al huésped en el check-in— pero no se usa para
   cruzar ni validar: el cruce con el CSV es siempre por código de reserva,
   que es único.

**Clasificación por `SUMMARY`:**

- `Reserved` → reserva. Siempre trae código.
- `Airbnb (Not available)` → bloqueo manual del calendario. **No trae código
  ni teléfono.** Va a la tabla `bloqueos`, no a `reservas`.

**Procesamiento, por cada evento `Reserved`:**

1. Se extrae el código. **Si no hay código parseable, el evento se saltea y se
   informa; nunca se crea una reserva sin código.**
2. Si la reserva ya existe (cualquier origen): no se toca nada.
3. Si no existe: se crea con código, fechas, depto, los 4 dígitos del
   teléfono, `origen = ical` y `datos_completos = false`, y **se genera su
   limpieza tentativa**. Vale más una limpieza de más, fácil de cancelar, que
   una reserva que nadie vio venir.

Una reserva `datos_completos = false` se muestra marcada como tentativa: sirve
para planificar la limpieza, pero en la práctica no se podrá coordinar el
check-in hasta que el CSV traiga el teléfono completo (sin teléfono no hay
comunicación con el huésped). No es un bloqueo del sistema: es una limitación
natural de la operación.

Notas de alcance observadas en el archivo real:

- El iCal cubre **hasta un año de reservas futuras** (mucho más que el CSV
  típico). Por eso es tan útil para descubrir con anticipación.
- Airbnb manda (§2.10): el iCal descubre, el CSV completa, ninguno genera
  conflicto con el otro.

### 2.9 Late check-out

Marcar `late_checkout = true` significa que ese día el departamento **no se
puede limpiar**: el huésped sigue adentro.

- **Sin check-in ese día** → la limpieza se mueve automáticamente al día
  siguiente. Es el único caso de movimiento automático del sistema, y aplica
  porque hay un único destino posible. Se informa el movimiento.
- **Con check-in ese día** → el sistema NO decide. Conflicto en el momento de
  marcar el late, y en el panel de alertas. Late check-out a las 14 con
  huésped entrando a las 15 lo resuelve una persona, no una regla.

### 2.10.bis Edición manual de datos que vienen de Airbnb

Los campos de `reservas` que llegan del CSV (fechas, huésped, contacto,
noches, payout) **no son editables por el rol coordinador**. Solo `manager` y
`admin` pueden modificarlos.

**Airbnb manda sobre sus propios campos.** Una edición manual es un override
temporal: la próxima importación que traiga esa reserva la pisa con el valor
del archivo. No se marcan campos editados ni se reportan diferencias.

Requisito de interfaz: al editar uno de estos campos, la ficha debe advertirlo
en el momento ("este dato viene de Airbnb; la próxima importación puede
reemplazarlo"). El comportamiento es correcto, pero tiene que ser visible
antes de editar, no descubrirse después.

El `audit_log` conserva quién cambió qué y cuándo.

### 2.10.ter Descartar una reserva

Solo `manager` y `admin`. No existe borrado físico: se marca
`descartada = true` y la reserva deja de aparecer en las vistas operativas.
Sus eventos y limpiezas asociadas pasan a `cancelada`, con la excepción de
siempre: una limpieza `en_curso`, `hecha` o `verificada` no se toca.

**No hay lista de ignorados.** Si la reserva sigue existiendo en Airbnb y
aparece en una importación posterior, `descartada` vuelve a `false` y la
reserva reaparece con sus eventos y su limpieza.

Es el comportamiento deseado: el sistema es un espejo de Airbnb. Una baja que
sobreviviera a la importación podría ocultar de forma permanente una reserva
real, y un huésped que llega sin que nadie lo espere es peor problema que una
fila de más.

El resumen del lote informa cuántas reservas descartadas reaparecieron, para
que el hecho no pase inadvertido.

Toda la operación queda en `audit_log`.

### 2.10 Coordinación y cambios de fecha

`fecha_coordinada` y `hora_coordinada` son campos de coordinación: registran
lo que se acordó con el huésped. Arrancan vacíos; si están vacíos, se muestra
la fecha de la reserva.

- **No afectan la limpieza.** Ver §2.8.ter.
- Sí se usan para ordenar y mostrar el día operativo: la vista de check-in/out
  muestra la hora coordinada, y las salidas se ordenan por ella.
- Si `fecha_coordinada` difiere de la fecha de la reserva, la ficha lo indica
  de forma visible, sin alertar.

Cuando la **fecha de la reserva** cambia por importación:

- La limpieza asociada se mueve con ella, si está en `pendiente` o `asignada`.
  El resumen del lote informa cuántas limpiezas se movieron.
- Si la limpieza está en `en_curso`, `hecha` o `verificada`, no se mueve y
  aparece en el panel de alertas para que decida una persona.
- Si el check-out se atrasa y la limpieza no pudo moverse, queda **dentro de
  una estadía ocupada**: alerta roja, primera de la lista (§3.6).

---

## 3. Vistas

### 3.1 Check-in / Check-out del día — MOBILE-FIRST

El uso real desde el celular es **consulta**, no carga: alguien llama, están
en la calle y necesitan responder rápido. El diseño se ordena en consecuencia.

**Celular**

- **Buscador arriba de todo.** Una sola caja que busca por código de reserva,
  nombre y apellido del huésped, departamento y teléfono. Un campo, no cinco
  filtros.
- **Navegación de fecha**: flechas de día anterior/siguiente, botón "Hoy", y
  un selector de calendario para saltar a cualquier fecha (ej. tres semanas
  adelante) sin recorrer día por día.
- Los campos de hora (llegada, salida) usan franjas de **5 minutos**.
- Lista compacta del día: depto, huésped, hora coordinada, punto de acceso o
  responsable.
- Al tocar una reserva, ficha con:
  - Huésped, código, noches, cantidad de personas
  - **Botones de llamar y WhatsApp** (tap-to-call sobre el teléfono)
  - **Acceso**: método, instrucciones completas, teléfono del encargado
  - **Departamento**: dirección, ambientes, capacidad, **wifi con botón de
    copiar**
  - **Fecha de la reserva** (solo lectura) y **fecha y hora coordinadas**
    (editables). Si difieren, se indica de forma visible
  - Registro y aviso de seguridad, si el departamento los requiere
  - **Salida anterior**: fecha y hora coordinadas del check-out previo del
    mismo departamento, y la ventana disponible. Es lo que permite no
    acordar una hora imposible mientras se coordina la llegada
- Los ítems de registro y aviso solo aparecen si el departamento los requiere
  (`requiere_registro`, `requiere_aviso_seguridad`). Si no, se muestra
  "No aplica" en gris — nunca como tarea pendiente.

**Escritorio**

- Dos listas (llegadas y salidas) con más columnas visibles a la vez:
  observaciones, sobre, noches, días sin limpiar.
- **Días sin limpiar** = hoy − fecha de la última limpieza hecha/verificada
  del depto. Informativa: no bloquea ni alerta.
- Edición inline de hora y observaciones.

**Selector de responsable (ambos formatos)**

UN solo campo con buscador, que lista puntos de acceso y personas juntos,
agrupados bajo encabezados "Sin persona" / "Personas". Guarda
`punto_acceso_id` O `responsable_id`. **No hay punto de acceso por defecto por departamento**: el acceso se elige por
reserva al coordinar, desde la lista completa de puntos y personas.

### 3.2 Asignación de limpiezas — MOBILE-FIRST

Una sola pantalla para planificar y despachar.

**Escritorio**: ventana móvil de 7 días agrupada por día, sin asignar arriba
de cada grupo. Filtro por fecha puntual disponible.

**Celular**: día único por defecto, navegable con flechas. Más el resumen
semanal de §3.3.

**Común a ambos**

- Semáforo por proximidad en el borde izquierdo de cada fila: sin responsable
  para mañana → rojo; a 2–3 días → ámbar; más adelante → gris visible.
- Por limpieza: departamento, tipo, ventana (hora checkout → próx. check-in),
  urgente, barrio, ambientes, **quién limpió ese depto la última vez**, días
  sin limpiar, monto que va a cobrar.
- Carga del día por persona (cantidad + monto acumulado), visible arriba.
- **Al asignar**: se resuelve la tarifa vigente a la fecha, se calcula
  `pago_doble` (domingo o feriado) y se congela `monto_pactado`. El monto con
  pago doble se muestra ya duplicado en la fila.
- Alta manual de limpiezas (inicial / cambio_blancos / con_huespedes /
  desmantelar / propietario) eligiendo departamento directo, con o sin
  reserva. Alta y baja de bloqueos desde acá.
- **Emisión de la lista del día**: no se puede emitir sin pasar visualmente
  por las limpiezas sin responsable. Presión visual, no bloqueo duro.

### 3.3 Resumen semanal — CELULAR

Pantalla de entrada en el celular. Siete filas, una por día:

- Día y fecha
- Barra de proporción asignadas / sin asignar
- Cantidad total y cantidad sin asignar
- Marca de domingo o feriado (pago doble)
- Color del borde por urgencia, igual que §3.2
- Total de la semana y total sin asignar en el encabezado

Cada fila lleva al día correspondiente en la vista de asignación.

### 3.4 Export PDF diario

- PDF de las limpiezas de una fecha (default: mañana).
- Columnas, replicando el formato actual: departamento, fecha, noches,
  check-out, hora check-out, tipo de limpieza, próx. reserva, próx. check-in,
  dirección, **+ responsable** (hoy va por mensajes aparte).
- Generación server-side, tabla simple, sin diseño elaborado.
- Se descarga; el envío por WhatsApp sigue siendo manual en esta fase.

### 3.5 Exportables de contactos

Dos exportables, mismo filtro: **rango desde / hasta sobre la fecha de
check-in**, seleccionado por el usuario.

**Exclusiones automáticas en ambos**: reservas canceladas (Airbnb borra el
teléfono) y reservas sin departamento asignado.

**Normalización del teléfono**: quitar todo lo que no sea dígito de
`huesped_contacto`. `+55 38 99940-9246` → `553899409246`.

#### 3.5.0 Limpiezas por rango de fechas

Además del PDF del día, un exportable de limpiezas por **rango de fecha de
limpieza** (desde / hasta). Columnas: departamento, fecha de limpieza,
responsable. Formatos XLSX y CSV. Incluye limpiezas con y sin responsable
asignado; las sin responsable se marcan.

#### 3.5.1 Sistema de comunicación (XLSX)

Encabezados exactos, en este orden:

```
Nombre | Celular | Email | Direccion | Genero | Ciudad | Pais | Apellidos |
Autoasignar Tipo | Autoasignar Id | Etiquetas | Documento | Extra 1 | Extra 2
```

| Columna | Contenido |
|---|---|
| Nombre | Nombre completo del huésped, sin partir |
| Celular | Teléfono normalizado. **Celda con formato TEXTO** |
| Email | vacío |
| Direccion | vacío |
| Genero | vacío |
| Ciudad | Código de reserva |
| Pais | ISO-2 derivado del código telefónico. Vacío si es ambiguo o desconocido |
| Apellidos | `nombre_interno` del departamento |
| Autoasignar Tipo / Id | vacío |
| Etiquetas | vacío |
| Documento | vacío |
| Extra 1 | Fecha de check-in, `dd/mm/aaaa` |
| Extra 2 | Fecha de check-out, `dd/mm/aaaa` |

**El Celular debe escribirse como texto**, no como número. Un teléfono largo
guardado como número se convierte en notación científica y el archivo llega
roto al destino.

Mapa de código telefónico → país: 54 AR, 55 BR, 56 CL, 34 ES, 52 MX, 51 PE,
598 UY, 595 PY, 591 BO, 57 CO, 33 FR, 39 IT, 44 GB, 49 DE, 351 PT, 31 NL,
61 AU, 972 IL. **`+1` queda vacío**: es Estados Unidos y Canadá a la vez y no
se puede distinguir. Cualquier código no listado, vacío.

#### 3.5.2 Google Contacts (CSV)

Formato estándar de importación de Google Contacts. Columnas mínimas:

```
Name,Given Name,Family Name,Phone 1 - Type,Phone 1 - Value,Notes
```

| Columna | Contenido |
|---|---|
| Name | `{nombre del huésped} {nombre_interno del depto}` — así el celular muestra ambos al entrar la llamada |
| Given Name | Nombre completo del huésped |
| Family Name | `nombre_interno` del departamento |
| Phone 1 - Type | `Mobile` |
| Phone 1 - Value | Teléfono normalizado con `+` adelante |
| Notes | Código de reserva y fechas de check-in / check-out |

### 3.5.bis Estado "departamento listo"

Cuando el personal marca una limpieza como `hecha` (Fase 2) o back office la
marca `verificada`, el departamento queda **listo** para el próximo huésped.
Ese estado se propaga a dos lugares de Fase 1:

- En la vista de asignación, la limpieza muestra ✓ Terminada.
- En el check-in de la próxima reserva de ese departamento aparece
  "Departamento listo". Es lo que le permite a back office confirmarle al
  huésped que puede entrar, sin llamar a nadie.

**Regla exacta.** Un check-in muestra "departamento listo" cuando existe una
limpieza de ese departamento que esté `hecha` o `verificada`, cuya fecha sea:

- **posterior (o igual) al último check-out** de ese departamento, y
- **anterior o igual a la fecha de esta llegada**.

**El tiempo transcurrido no importa.** Si el depto se limpió el lunes y el
huésped entra el jueves, el jueves igual dice "listo". Lo único que importa es
que haya una limpieza terminada entre la última salida y esta entrada. No está
atado a "el mismo día".

Caso borde: si entre esa limpieza y la nueva llegada hubo otro check-out
(una estadía intermedia), el departamento **no** está listo: hace falta una
limpieza posterior a esa última salida. Por eso la referencia es siempre "el
último check-out", no "una limpieza cualquiera del pasado".

### 3.5.ter Accesos y llaves

Una vista que lista los puntos de acceso físicos (candados, sobres, valijas) y,
por cada uno, su historial de movimientos (§ puntos_acceso). Muestra cuántas
llaves hay dentro de cada punto en este momento —calculado, no almacenado— y
resalta los movimientos sin confirmar.

Sirve para responder "¿quedó puesto el sobre del 2258?" sin llamar a nadie, y
para ver de un vistazo si una llave que debería estar disponible sigue en poder
de un huésped.

### 3.5.quater Ficha de departamento (organización)

La ficha es larga (inventario de 40+ campos). Para no obligar a scrollear:

- **Bloque fijo arriba**: dirección, barrio, ambientes, capacidad y **wifi**.
  Lo más consultado.
- **Secciones plegables** (acordeón), cerradas por defecto, con resumen en el
  encabezado: Propiedad (propietario + su teléfono, acuerdo de pago, cuenta,
  publicación, credenciales solo-admin, y **encargado del edificio**);
  Requisitos de ingreso (registro, aviso a seguridad, **modalidad de self
  check-out** e **indicaciones de check-in/out** con archivos); Anuncios
  vinculados; Ambientes y camas; Grupos de inventario; Observación.

### 3.6 Panel de alertas

Una pantalla, siete listas, en este orden:

0. **Limpieza sobre estadía ocupada** (§2.10): el check-out se atrasó y la
   limpieza no pudo moverse (ya estaba en curso o hecha), por lo que quedó
   dentro de una estadía ocupada. **Siempre primera de la lista, en rojo.** Es
   la única alerta donde alguien puede golpear la puerta de un huésped que
   está adentro.
0.b **Ventana insuficiente** (§2.8.quater): salida y entrada el mismo día con
   una ventana materialmente imposible de limpiar. Junto a la anterior, al
   tope y en rojo.
1. **Falta limpieza**: entre un check-out y el siguiente check-in del mismo
   departamento no existe ninguna limpieza no-cancelada. Incluye check-ins sin
   check-out previo y check-outs sin reserva siguiente. Canceladas no alertan.
2. **Sin responsable**: limpiezas próximas sin asignar (mismo semáforo).
3. **Reservas sin departamento**: la bandeja de §2.7.
4. **Conflictos de cancelación / cambio de fecha**: los casos de §2.8 que
   esperan decisión, incluida la carga de `fecha_checkout_real`.
5. **Conflictos de late check-out**: los casos de §2.9 con check-in el mismo
   día.

Una limpieza sin responsable SÍ cubre el hueco estructural (lista 1), pero
aparece en la lista 2.

### 3.7 Administración

- **Usuarios**: alta de usuario, asignación de uno de los cinco roles
  definidos (admin / manager / coordinador / limpieza / propietario),
  activación y desactivación. **No** hay editor de permisos a medida: el
  alcance de cada rol está definido en la matriz de §3.8 e implementado en
  RLS. Con 10–15 personas y cinco roles, cambiar un permiso es un cambio de
  código de minutos; un editor configurable es un proyecto propio que se
  rompe seguido.

### 3.8 Matriz de permisos

Esta tabla **es** la definición de qué ve y qué hace cada rol. Se revisa y se
aprueba antes de construir; después se traduce a políticas RLS en Postgres.
Cambiar un permiso es editar esta tabla y su política, no configurar nada
desde la aplicación.

Referencias: ✓ puede · — no ve la pantalla · ✗ ve pero no puede

| Capacidad | admin | manager | gobernanta | coordinador | limpieza | propietario |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| **Operación diaria** |
| Resumen del día y de la semana | ✓ | ✓ | ✓ | ✓ | solo lo suyo | — |
| Ver check-in / check-out | ✓ | ✓ | — | ✓ | — | — |
| Cargar fecha y hora coordinadas | ✓ | ✓ | — | ✓ | — | — |
| Marcar registro y aviso de seguridad | ✓ | ✓ | — | ✓ | — | — |
| Marcar late check-out | ✓ | ✓ | — | ✓ | — | — |
| Escribir observaciones | ✓ | ✓ | — | ✓ | — | — |
| Panel de alertas | ✓ | ✓ | — | ✓ | — | — |
| **Limpiezas** |
| Ver todas las limpiezas | ✓ | ✓ | ✓ | ✓ | solo las suyas | — |
| Asignar responsable | ✓ | ✓ | ✓ | ✓ | ✗ | — |
| Mover la fecha de una limpieza | ✓ | ✓ | ✓ | ✓ | ✗ | — |
| Alta manual de limpieza | ✓ | ✓ | ✓ | ✓ | — | — |
| Asignarse limpiezas a sí misma | ✓ | ✓ | ✓ | — | — | — |
| Vista de limpiadora (sus propias limpiezas) | ✓ | ✓ | ✓ | — | ✓ | — |
| **Vista de distribución (equidad)** | ✓ | ✓ | ✓ | — | — | — |
| Ver ingreso de cada persona | ✓ | ✓ | ✓ (solo ver) | — | solo el propio | — |
| Marcar limpiezas como pagadas | ✓ | ✓ | ✗ | — | — | — |
| Ver el monto de una limpieza | ✓ | ✓ | ✓ | ✓ | solo el propio | — |
| Emitir el PDF del día | ✓ | ✓ | ✓ | ✓ | — | — |
| **Reservas** |
| Ver datos del huésped (nombre y contacto) | ✓ | ✓ | — | ✓ | solo nombre | — |
| Editar datos que vienen de Airbnb | ✓ | ✓ | — | ✗ | — | — |
| Descartar una reserva | ✓ | ✓ | — | ✗ | — | — |
| Importar archivos | ✓ | ✓ | — | — | — | — |
| Asignar departamento a reserva sin mapear | ✓ | ✓ | — | ✓ | — | — |
| Exportar contactos de huéspedes | ✓ | ✓ | — | ✓ | — | — |
| **Departamentos** |
| Ver ficha e inventario | ✓ | ✓ | ✓ | ✓ | solo asignados | solo propios |
| Editar departamento e inventario | ✓ | ✓ | — | ✗ | — | — |
| Ver credenciales de Airbnb | ✓ | — | — | — | — | — |
| **Configuración** |
| Valores de limpieza (tarifas) | ✓ | ✓ | — | — | — | — |
| Puntos de acceso, personas, feriados | ✓ | ✓ | — | — | — | — |
| Parámetros operativos | ✓ | ✓ | — | — | — | — |
| Crear usuarios y asignar roles | ✓ | — | — | — | — | — |
| Ver el log de auditoría | ✓ | ✓ | — | — | — | — |

Notas:

- El rol **`gobernanta`** es un híbrido: reparte limpiezas (como coordinador)
  y además tiene sus propias limpiezas y la vista de limpiadora (como
  limpieza). Su pantalla propia es la **vista de distribución** (§3.11). No ve
  check-in/out, reservas ni configuración: su trabajo es repartir carga de
  limpieza de forma equitativa. Ve el ingreso de cada persona pero **no puede
  marcar pagos**: eso es de admin/manager.
- El rol `limpieza` no tiene pantallas en Fase 1: la fila «solo lo suyo»
  describe lo que verá en Fase 2. Se define ahora para que las políticas RLS
  no haya que rehacerlas después.
- El rol `propietario` es de Fase 4.
- `manager` no ve las credenciales de Airbnb de los propietarios. Es la única
  capacidad reservada exclusivamente a `admin` además de la gestión de
  usuarios.
- **Puntos de acceso**: ABM completo.
- **Personas**: ABM completo.
- **Tarifas**: carga de un juego de valores con fecha `desde`.
- **Feriados**: ABM. Es donde se cargan las fechas que se pagan doble. Al
  asignar una limpieza, el sistema consulta esta tabla y marca `pago_doble`
  automáticamente si la fecha es domingo o feriado.
- **Parámetros operativos**: `hora_limite_checkout` (default 11:00),
  `hora_minima_checkin` (default 12:00) para la alerta de ventana insuficiente,
  y `dia_corte_semana_pago` (default viernes) para la semana de pago (§1.0).
- **Departamentos, propietarios, socios**: ABM.

---

### 3.9 Calidad (importación de puntajes)

Pantalla para importar un Excel de puntajes de Airbnb. Formato mínimo: dos
columnas, código de reserva y puntaje (1 a 5). Opcional: comentario.

- Se cruza por código de reserva contra las reservas existentes.
- Un puntaje cuyo código no coincide con ninguna reserva se informa aparte,
  no se descarta.
- Alimenta el dashboard (§3.10): promedio por departamento y reseñas bajas.

### 3.10 Dashboard

Vista general que arranca con dos bloques y crece después:

- **Ocupación porcentual por departamento**: noches ocupadas sobre noches
  disponibles en el período. Se calcula de las reservas no canceladas.
- **Calidad**: promedio de puntaje por departamento, cantidad de reseñas, y una
  lista de reseñas bajas para revisar, con su código de reserva.

A futuro suma ingresos, liquidaciones a propietarios y costos de limpieza
(Fase 4). El dashboard va último en cada fase porque consume datos de todo lo
demás.

### 3.11 Vista de distribución (rol gobernanta)

La pantalla propia del rol `gobernanta`. Sirve para repartir las limpiezas de
forma equitativa entre el personal. Por cada persona muestra, en el período
elegido:

- Cantidad de limpiezas hechas.
- Ingreso acumulado (solo lectura; no puede marcar pagos).
- Cantidad de ambientes (una limpieza de 4 ambientes no es una de 1).
- Zonas donde limpió (para repartir también por traslado, no solo por cantidad).

Una barra comparativa deja ver de un vistazo quién está por encima y por
debajo del promedio. El objetivo es equilibrar carga, no solo contar.

**Período — la semana de pago.** Ver §1.0 «semana de pago». La vista abre por
defecto en la semana de pago vigente (viernes a jueves) y permite navegar a
semanas anteriores/siguientes con un toque. Para casos especiales, permite
elegir un **rango de fechas libre**.

La gobernanta también puede asignar limpiezas (incluidas las propias) y tiene
la vista de limpiadora, por lo que este rol combina distribución y ejecución.

## 4. Migración desde Ninox

1. **personas**: normalizar duplicados antes de cargar (LUDMILA=LUDMI,
   MAGUIE=MAGUI, PATRI=PATRICIA — confirmar mapa con la manager).
2. **puntos_acceso**: depurar el catálogo; unificar las listas divergentes de
   check-in y check-out con `sirve_checkin` / `sirve_checkout`.
3. **propietarios y departamentos**: los 50+ reales, con dirección,
   barrio, ambientes, punto de acceso default y los flags `requiere_registro`
   y `requiere_aviso_seguridad`.
4. **listing_alias**: cargar el mapeo existente de "Anuncio vs depto.csv".
5. **tarifas**: montos vigentes por ambientes, `vigente_desde` = fecha de
   migración.
6. **feriados**: los del año en curso.
7. **reservas**: por el importador, los CSV con reservas en curso y futuras.
8. Las reservas ficticias de Ninox (VACIO / PROPIETARIO / ARREGLO) NO se
   importan como reservas: se recrean como `bloqueos`.

**No se migran**: GASTOS (VIEJO) — se descarta. CHECK LIST NOCHE — el módulo
no existe en el sistema nuevo.

---

## 5. Criterios de aceptación de la Fase 1

1. Importar un CSV real crea reservas, eventos y limpiezas. Re-importarlo
   produce cero cambios.
2. Cancelación de una reserva **futura**: la limpieza se cancela sola.
   Cancelación de una reserva **en curso**: la limpieza se mantiene y pide
   fecha real de salida. En ambos casos se conservan nombre y contacto
   previos.
3. Un anuncio nuevo cae en la bandeja; se mapea una vez; los imports
   siguientes lo resuelven solos.
4. Marcar late check-out sin check-in ese día mueve la limpieza al día
   siguiente y lo informa. Con check-in ese día, genera conflicto en el panel
   de alertas y no mueve nada.
4.b Cargar una fecha coordinada distinta a la de la reserva NO mueve la
   limpieza. Que la fecha de la RESERVA cambie por importación sí la mueve,
   salvo que la limpieza ya esté en curso o hecha: en ese caso alerta.
5. Asignar una limpieza congela `monto_pactado`. Cargar tarifas nuevas con
   fecha desde no altera lo ya asignado. Domingo o feriado duplica el monto.
6. El PDF de mañana sale con las columnas definidas, incluido el responsable.
7. Los dos exportables de contactos generan archivos que el sistema de
   comunicación y Google Contacts importan sin error, con el rango de fechas
   de check-in seleccionado.
8. La vista de check-in/out y la de asignación funcionan en celular; el
   resumen semanal muestra la carga de los 7 días.
9. Un check-out coordinado a las 11:30 con entrada el mismo día a las 12:00
   genera la alerta de ventana insuficiente al tope del panel.
10. Un coordinador no puede editar la fecha de check-out ni descartar una
   reserva. El manager sí, y la ficha le advierte que la próxima importación
   puede reemplazar el valor.
11. Una reserva descartada que sigue en Airbnb reaparece al reimportar, y el
   resumen del lote lo informa.
12. Todo corre en producción y la manager opera desde el celular.
13. **Ninox queda apagado** para reservas, limpiezas y check-ins.
