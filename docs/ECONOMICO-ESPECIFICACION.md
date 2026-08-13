# Solicitud para Claude Code — Módulo "Ingresos por Departamento" (App MTHosting)

> Pegar este documento completo como prompt inicial. Antes de escribir código, inspeccioná el repo y adaptá nombres/rutas/stack a lo existente. No inventes una arquitectura paralela: reusá el modelo de Departamentos y su `% comisión`, y el layout/nav actual de la app.

> **Orden de construcción sugerido:** (1) importador en lote + modelo de datos → (2) motor de cálculo → (3) **pantalla de validación (6.6)** → (4) tabla Departamento × Mes (6.2) → (5) dashboard (6.1). La validación va antes que el dashboard: nadie va a usar los gráficos si no confía en los números.

---

## 1. Objetivo

Agregar un módulo que muestre, **por departamento y por mes**, exactamente dos números y su diferencia:

| | Definición |
|---|---|
| **GANANCIA** | Lo que MTHosting *debería* ganar: `comisión sobre el alquiler + tarifa de limpieza`, según el `% comisión` de cada departamento. |
| **PERCIBIDO** | Lo que MTHosting *efectivamente* percibió, sin importar por qué canal llegó. |
| **BRECHA** | `PERCIBIDO − GANANCIA`. Puede dar positivo o negativo y ambos son informativos (ej.: early/late check-in a los que no se les cobró la parte de comisión). |

**Requisito de presentación explícito de Marcos:** el desglose por canal (coanfitrión vs payout) **no es una columna de la vista principal**. Es un detalle de implementación que solo aparece en el drill-down de una fila, para auditar un número que llame la atención. La vista principal es `Departamento × Mes → Ganancia | Percibido | Brecha`.

Los datos entran por **importación de CSV exportados de Airbnb**, en dos sabores: **cobros efectivos** (histórico, inmutable salvo duplicados) y **programados/pending** (futuro, se reemplaza en cada importación).

### 1.1 Dónde vive esto: sección "ECONÓMICO"

Este módulo **no es una pantalla suelta**: es el primer ladrillo de una sección nueva de la app llamada **ECONÓMICO**, donde va a vivir toda la información financiera del negocio. Crear la sección en la navegación principal aunque hoy tenga una sola sub-vista.

Roadmap de la sección (contexto para que el modelo de datos no quede corto):

| Sub-vista | Estado |
|---|---|
| **Ingresos y ganancias por departamento y mes** | **Esta entrega** |
| Pagos / giros a propietarios | No existe todavía — etapa 2 |
| Gastos de Airbnb y operativos | No existe todavía — etapa 2 |
| Resultado por departamento (ganancia − gastos) | Consecuencia de las anteriores |

**Implicancia de diseño, importante:** modelá el almacenamiento como un **libro de movimientos económicos** genérico (`movimiento_economico`: fecha, departamento, propietario, categoría, moneda, monto, origen, referencia al batch de import) en lugar de tablas ad-hoc que solo sirvan para cobros de Airbnb. Los pagos a propietarios y los gastos van a ser filas de otra categoría en la misma estructura. Si esto se modela hoy como "tabla de cobros de Airbnb", en la etapa 2 hay que rehacerlo.

El objetivo declarado de la sección es **tomar decisiones** —qué departamento rinde, cuál se cae, dónde se está perdiendo plata—, así que priorizá legibilidad y comparabilidad por sobre exhaustividad de datos en pantalla.

Los datos entran por **importación de CSV exportados de Airbnb**, en dos sabores: **cobros efectivos** (histórico, inmutable salvo duplicados) y **programados/pending** (futuro, se reemplaza en cada importación).

---

## 2. Fuentes de datos (formato real, ya verificado)

Los CSV vienen del export de Airbnb → Ganancias → Historial de transacciones. Hay **3 variantes de header** en circulación; el parser debe tolerarlas todas mapeando por **nombre de columna**, nunca por posición:

| Variante | Columnas | Uso |
|---|---|---|
| 21 col | incluye `Fecha de llegada estimada` y `Cobrado` | cobros efectivos |
| 22 col | idem + una columna extra | cobros efectivos |
| 18 col | sin `Fecha de llegada estimada` ni `Cobrado` | programados (`airbnb_pending*.csv`) |

**Columnas relevantes:**
`Fecha`, `Tipo`, `Código de confirmación`, `Fecha de la reserva`, `Fecha de inicio`, `Fecha de finalización`, `Noches`, `Huésped`, `Anuncio`, `Detalles`, `Moneda`, `Monto`, `Cobrado`, `Tarifa de limpieza`, `Ingresos brutos`.

**Detalles críticos de parseo:**

- Encoding: **UTF-8 con BOM** (`utf-8-sig`). Hay filas con mojibake heredado (`CÃ³modo`) — normalizar y no romper.
- Fechas: formato **MM/DD/YYYY** (formato US). Soportar también `YYYY-MM-DD`.
- Números: usan **coma decimal en algunos campos** (`Tarifa por servicio` = `"3,91"`) y punto en otros (`Monto` = `126.39`). Parser tolerante a ambos.
- `Monto` es **negativo** en las filas `Cobro como coanfitrión`.

**Valores de `Tipo` presentes (volumen real del histórico):**

| Tipo | Filas | Tratamiento |
|---|---|---|
| `Reserva` | 3.835 | Base del cálculo teórico |
| `Cobro como coanfitrión` | 3.825 | Base del ingreso efectivo (componente 1) |
| `Payout` | 2.902 | Base del ingreso efectivo (componente 2), solo si destino = cuenta MTH |
| `Cobro de la resolución` | 304 | Ingreso extra: comisiona igual que `Reserva` |
| `Ajuste` | 33 | Ingreso extra |
| `Ajuste de la resolución` | 28 | Ingreso extra |
| `Tarifa de cancelación` | 17 | Ingreso extra |
| `Reembolso de la tarifa de cancelación` | 14 | Ingreso extra (puede ser negativo) |

---

## 3. Identificación del departamento

**No existe columna de departamento.** Se resuelve por el texto de `Anuncio`.

- **Usar el mecanismo que ya existe en la app.** Cada departamento ya tiene cargado el/los nombre/s de anuncio, y las **reservas hoy se cruzan exactamente así**. Reutilizá esa misma tabla y esa misma función de matching — no crees un mapeo paralelo.
- Si la app hoy soporta un solo nombre de anuncio por departamento, **extendelo a N:1**: hay departamentos con varios anuncios (renombres históricos, anuncios ocultos, variantes con y sin acentos). Ejemplo: `"Amplio y cómodo departamento"`, `"Espacio cómodo y tranquilo (oculto)"` y `"Amplio y cómodo departamento (oculto)"` → todos `ARAOZ 1`.
- Como semilla / control cruzado hay ~146 pares ya relevados en `anuncio_depto.json` y en `TABLAS.xlsx` (hoja1, col A=Anuncio, col B=Departamento). Antes de migrar nada, **comparalos contra lo que ya tiene la app** y reportá las diferencias en vez de pisar datos.
- Matching: exacto primero; si falla, normalizado (trim, lowercase, sin acentos, colapso de espacios).
- **Si no matchea:** NO descartar la fila. Queda en estado `sin_asignar` y la UI muestra una bandeja "Anuncios sin mapear" donde el usuario lo asocia al departamento con un click, lo que crea el alias en la tabla existente y **reprocesa retroactivamente** todas las filas de ese anuncio.

---

## 4. Importador

### 4.1 Comportamiento general

- **Carga en lote, requisito explícito de Marcos: nunca de a un archivo.** El flujo real es exportar ~40 CSV de una sentada, así que el importador debe aceptar:
  - drag & drop de **N archivos a la vez** (y selección múltiple en el file picker),
  - **arrastrar una carpeta entera**,
  - subir un **.zip** y procesar todos los CSV que contenga.
  Con barra de progreso por archivo, procesamiento resiliente (si un archivo falla, los demás siguen) y un **resumen único al final** de todo el lote, no un mensaje por archivo. Los ~40 archivos se importan como **un solo `import_batch`** para poder deshacer la carga completa de un click.
- ⚠️ **Un archivo puede contener varios departamentos**: la exportación se hace **por propietario**, y un propietario puede tener varias unidades. Nunca asumir "un archivo = un departamento". La imputación es siempre **fila por fila, por el nombre del anuncio**.
- El orden de las filas dentro del archivo **es significativo** (ver 5.2). El parser debe preservar el orden original y guardarlo (`orden_en_archivo`).
- El usuario elige el tipo de carga: **Cobros efectivos** o **Programados**. Detectar y sugerir automáticamente (nombre `airbnb_pending*` y/o ausencia de la columna `Cobrado` → programados).
- Cada carga genera un registro `import_batch` (archivo, hash, tipo, fecha, usuario, filas leídas / insertadas / duplicadas / sin mapear) y es **reversible** (deshacer batch).
- Previsualización antes de confirmar: cuántas filas nuevas, cuántas duplicadas se van a ignorar, cuántos anuncios sin mapear.

### 4.2 Cobros efectivos — deduplicación (requisito explícito)

Los exports se solapan fuertemente entre sí (mismo rango de fechas reexportado muchas veces). **Una fila ya cargada no se vuelve a tomar.**

- **Clave natural de deduplicación (validada sobre datos reales):**
  `hash(Tipo, Código de confirmación, Fecha, Monto, Cobrado, Moneda, Anuncio, Detalles, ocurrencia)`
  → índice **UNIQUE** en BD.
  - `Detalles` entra en la clave porque los `Payout` no tienen código de confirmación y se distinguen por destino.
  - ⚠️ **`Cobrado` es imprescindible.** En las filas `Payout` el campo `Monto` viene **vacío** y el importe está en `Cobrado`. Sin `Cobrado` en la clave, dos payouts distintos del mismo día a la misma cuenta colapsan en uno solo. Verificado: en un archivo de prueba de 152 filas se perdían 4 payouts legítimos (ej. 14/05/2026: uno de 41.944,39 y otro de 48.723,99 ARS, ambos a la misma cuenta).
  - `ocurrencia` = contador 1,2,3… de filas idénticas **dentro del mismo archivo**. Cubre el caso de filas realmente iguales (13 casos en el histórico, típicamente payouts de 0,00 el mismo día a la misma cuenta): la primera es la ocurrencia 1, la segunda la 2, y al reimportar el archivo vuelven a matchear una a una.

  **Resultado de la simulación con la clave corregida:** archivo A (152 filas) → 152 insertadas; archivo B que lo contiene y lo extiende (222 filas) → +70 nuevas, 152 detectadas como duplicadas; reimportar B → **0 filas nuevas**. Sobre el histórico completo (5.712 filas, 41 archivos) el resultado es **idéntico en cualquier orden de importación** y reimportar todo agrega 0.
- **Ojo — no confundir duplicado con pago legítimo repetido:** una misma reserva puede tener **varias filas `Reserva` con distinta `Fecha`** (estadías largas cobradas mes a mes) y **varias filas `Cobro como coanfitrión`** por el mismo código. Eso **no es duplicado**: la fecha y el monto difieren. Solo se descarta cuando *todos* los campos de la clave coinciden.
- Además dedup a nivel archivo por hash de contenido: si se sube el mismo archivo dos veces, avisar y no procesar.
- Las filas descartadas se registran en el batch (contador + detalle descargable), no se borran silenciosamente.

### 4.3 Programados — reemplazo, no acumulación

Los pendientes mutan: pasan a efectivos o se cancelan.

- Guardar en tabla separada (`cobros_programados`), **nunca mezclada** con los efectivos en la misma tabla física.
- Al importar un nuevo set de programados: **snapshot completo**. Se marca el set anterior como `superseded` (soft delete con `batch_id`) y el nuevo pasa a ser el vigente. Conservar el histórico de snapshots para poder auditar qué se cayó.
- Un programado cuyo `(Código de confirmación, Fecha, Monto)` ya existe en la tabla de efectivos se marca `materializado` y **se excluye del total proyectado** (evita doble conteo teórico + efectivo).
- Reporte automático de diffs entre el snapshot anterior y el nuevo: **materializados** / **cancelados (desaparecieron)** / **nuevos** / **modificados (cambió monto o fecha)**.

---

## 5. Reglas de cálculo

Todas las fórmulas configurables; el `% comisión` **se lee del departamento** (campo ya existente en el modelo de Departamentos), con fallback a un default global (20%) si está vacío.

### 5.1 GANANCIA (lo que MTHosting debería ganar)

Sobre filas `Tipo = Reserva` (más los tipos "extra" del punto 2):

```
alquiler = Monto − Tarifa de limpieza
comision = alquiler × (%comision del departamento)
GANANCIA = comision + Tarifa de limpieza
```

- **La limpieza va 100% a MTHosting**, no comisiona. (Es la lógica ya usada en `Cobros_MTHosting_Febrero_2026.xlsx` y en `build_cobros_mthostin.py`.)
- Filas de tipo extra (`Cobro de la resolución`, `Ajuste`, etc.): `GANANCIA = Monto × %comision`, limpieza = 0.

**⚠️ AirCover — categoría propia, con asignación manual.** Los reembolsos de AirCover por daños llegan como `Cobro de la resolución` pero con `Detalles` que contiene "Reembolso de AirCover" (detectar por ese texto). **No son ingreso del alquiler y no se comisionan automáticamente**: según el caso pueden corresponder al propietario (daño en el inmueble) o a MTHosting (gasto que absorbió MTH). No se puede decidir desde el CSV.

Tratamiento:
- Se importan y se guardan con categoría `AIRCOVER`, imputados a su departamento y mes.
- **No suman a GANANCIA ni a PERCIBIDO** mientras estén sin asignar.
- Aparecen en una **bandeja "AirCover a asignar"** donde Marcos marca cada uno como *de MTHosting* o *del propietario*. Al asignarlo a MTHosting suma a la ganancia del departamento en el mes del movimiento; al asignarlo al propietario queda registrado pero no impacta.
- Son montos chicos pero el criterio importa: comisionarlos automáticamente equivale a cobrarle comisión al propietario sobre una indemnización por daños que suele corresponderle entera.

Caso real de referencia: KENNEDY 1, HMYEW9WZZX, USD 6,00 el 26/04/2026.

**Política de redondeo — definirla una sola vez y aplicarla en todo el módulo.** Calcular y almacenar **con todos los decimales**; redondear **solo en la presentación**. Nunca redondear el importe de cada movimiento antes de sumarlo: sobre KENNEDY 1 esa diferencia de criterio ya produjo desvíos de 1 a 2 centavos por mes contra la tabla dinámica de control de Marcos. Las sumas de la app tienen que reproducirse exactamente en una dinámica de Excel sobre los mismos datos.
- El `% comisión` debe poder **variar en el tiempo** por departamento (vigencia desde/hasta). Si el modelo actual solo guarda un valor único, agregá versionado — hay departamentos donde la comisión cambió. Si preferís no versionar todavía, dejalo preparado con una tabla `departamento_comision(depto_id, pct, vigente_desde)` y tomá la vigente a la `Fecha` de la fila.

**Estadías largas (> 30 noches):** el cobro llega fraccionado mes a mes. Mantener la lógica ya existente en `build_cobros_mthostin.py`: si `Noches > 30` y hay una sola fila `Reserva`, prorratear por noches en cada mes (`nightly = (Monto − limpieza) / Noches`), imputando la limpieza completa al primer mes. Marcar estas filas con una bandera visible en la UI (en el Excel actual se resaltan en amarillo).

### 5.2 PERCIBIDO (lo que realmente entró a MTHosting)

**Es un solo número por departamento y mes.** Internamente se arma de dos orígenes que se suman, pero el desglose **no se expone como columna** — solo en el drill-down (ver punto 1).

**Origen 1 — Derivado a MTHosting como coanfitrión**

```
percibido_coanfitrion = − Σ Monto de filas Tipo = 'Cobro como coanfitrión'
```

⚠️ **Usar el signo invertido de la suma, NUNCA `abs()` fila por fila.** Las líneas de coanfitrión son normalmente negativas, pero **existen líneas positivas**: son devoluciones de comisión cuando se ajusta una reserva. Con `abs()` una devolución sumaría en vez de restar. Caso real verificado (KENNEDY 1, HMFQKSZYF8): coanfitrión de −88,36 y luego +5,89 de devolución → percibido correcto = 82,47. Con `abs()` daría 94,25, un error de 11,78 en una sola reserva.

Se imputa al departamento del `Anuncio` y al mes de la `Fecha`.

**El PERCIBIDO es siempre lo que efectivamente entró: la línea de coanfitrión, tal cual, sin normalizar ni ajustar.** Aunque sea muy superior a la comisión teórica. Esa diferencia es información válida, no un error a corregir.

**⚠️ Detector de cambio de esquema — avisar, NUNCA inferir.** El porcentaje implícito de la línea de coanfitrión sobre el alquiler, `(coanfitrión − limpieza) / (Monto − limpieza)`, puede dejar de coincidir con el `% comisión` del departamento. Cuando eso pasa de forma sostenida, el sistema **avisa y pide confirmación**; no reinterpreta el dato por su cuenta.

El mismo patrón admite explicaciones distintas y **ninguna es deducible del CSV**:

- cambió la comisión pactada con el propietario;
- **acuerdo temporal de recupero**: MTHosting cobra un % mayor hasta cancelar una deuda del propietario;
- se invirtieron los roles y ahora el coanfitrión es el propietario;
- error de carga en Airbnb.

Comportamiento requerido: detectar el quiebre, mostrarlo en la bandeja de revisión con la fecha en que empieza, el % anterior, el % nuevo y la cantidad de reservas afectadas, y ofrecer a Marcos etiquetar el período con una de esas causas. Hasta que se etiquete, el percibido se computa igual (es plata que entró) pero el período queda marcado como *no conciliado*.

⚠️ **Calcular el % a nivel de pago, NO agregando por código de confirmación.** Una reserva puede cobrarse en **varios pagos parciales**, cada uno con su propia fila `Reserva` y su propia fila `Cobro como coanfitrión`, y la limpieza aparece en uno solo de ellos. Si se suman todas las filas de un código y se divide por el último `Monto`, el porcentaje sale cualquier cosa. **Emparejar cada `Reserva` con la línea de coanfitrión de su mismo grupo de payout.** Verificado: agregando por código, ED TALC arrojaba dos falsos positivos de 136,4% y 30,7%; emparejando por grupo de payout, las 26 comparaciones dan 20,0% exacto.

**Caso real verificado — KENNEDY 1:** de enero a mayo 2026 la línea de coanfitrión es exactamente el **20%** del alquiler en las 49 reservas. Desde junio pasa a ser exactamente el **80% + la limpieza** en las 18 reservas de junio y julio. **Es intencional:** MTHosting acordó cobrar el 80% temporalmente porque el propietario tenía una deuda. El percibido de junio (956,25) y julio (674,63) es correcto; la brecha positiva de +818 contra la ganancia teórica **es recupero de deuda, no ingreso ordinario**.

**Hay varios departamentos en esta situación, algunos cobrados al 100%.** No es un caso aislado.

### La etiqueta define si la GANANCIA cambia — regla central

**La rentabilidad de un departamento la define la GANANCIA, no el PERCIBIDO.** El percibido es control de caja: en algunos departamentos va a estar por encima y en otros por debajo, y eso no los hace más ni menos rentables.

Por eso la etiqueta que Marcos elige al confirmar un cambio de esquema **determina el tratamiento contable**:

| Etiqueta | Efecto sobre GANANCIA | Efecto sobre PERCIBIDO |
|---|---|---|
| **Nueva comisión pactada** | **Sí**: se versiona el `% comisión` desde esa fecha y la ganancia se recalcula. El departamento es más (o menos) rentable de verdad. | Sin cambio |
| **Recupero de deuda / cobro del 100% transitorio** | **No**: la ganancia sigue calculándose con la comisión ordinaria. Entró más plata, pero no se ganó más. | Sin cambio |
| **Roles invertidos** | Sin cambio | Revisar de qué canal sale |
| **Error de carga** | Sin cambio | Se excluye el movimiento |

Confundir las dos primeras es el error más caro posible en este módulo: un departamento cobrado al 100% para recuperar una deuda aparecería como el más rentable de la cartera cuando en realidad es un departamento con un propietario deudor.

Implicancias:
1. **`% comisión` versionado por fecha** (punto 5.1) deja de ser opcional.
2. La brecha positiva sostenida no debe leerse como "cobré de más por error": marcar el período con un ícono según su etiqueta, para que el número siga siendo interpretable dentro de seis meses.
3. El monto percibido por encima de la comisión ordinaria es el insumo natural de la **cuenta corriente con propietarios** de la etapa 2.
4. **Todo ranking, gráfico de rentabilidad y comparación entre departamentos del dashboard usa GANANCIA.** El percibido solo aparece en la vista de control de cobranza y en la brecha.

**Origen 2 — Payouts propios a cuentas de MTHosting**

```
percibido_payout = Σ 'Cobrado' de Payouts a cuenta MTH que NO son fondos en custodia
```

**Exclusión de fondos en custodia — importante.** Un payout que entra a una cuenta MTH no siempre es ingreso de MTHosting: en muchos casos es la plata del propietario, que MTHosting cobra y después le gira por fuera de Airbnb. Contarla como percibido inflaría el número y volvería inservible la brecha (los desvíos reales son de decenas de dólares; los flujos de custodia, de cientos por reserva).

**Regla de detección, automática, sin configuración por departamento:**

- Payout a cuenta MTH **cuyo grupo contiene una línea `Cobro como coanfitrión`** → la comisión ya se cobró por ese canal; el payout es **custodia** → **NO suma a PERCIBIDO**.
- Payout a cuenta MTH **sin línea de coanfitrión en el grupo** → es ingreso propio → **suma a PERCIBIDO**.

Caso real que motiva la regla (ARENALES 2, "Silencioso depto en Recoleta"):

```
Payout → MT Hosting, Checking 4343     327,49   ← plata del propietario (custodia)
   Reserva                             415,06
   Cobro como coanfitrión              −87,57   ← comisión MTHosting = PERCIBIDO
```

Volumen medido en el histórico: de los payouts a cuentas 4343, **624 grupos (USD 73.864) tienen línea de coanfitrión** (custodia) y **64 (USD 1.861) no la tienen** (ingreso propio).

Los fondos en custodia **se guardan igual** (campo `es_custodia`), pero **no se exponen en esta etapa**. Quedan persistidos y correctamente imputados por departamento y mes para habilitar la **etapa 2** del módulo: el control de giros a propietarios (cuánto se cobró en nombre de cada propietario, cuánto se le giró, saldo pendiente). No construir esa pantalla ahora; solo asegurar que el dato quede bien guardado y no se pierda.

**No hay doble conteo entre los dos orígenes.** Está verificado: el importe de cada `Payout` **ya viene neto de lo derivado al coanfitrión**. Ejemplo real del histórico:

```
07/17  Payout                  → PayPal b••••n@gmail.com        81.11
07/17  Reserva                 HMWP9Z5QWX   Hermoso depto...   126.39
07/17  Cobro como coanfitrión  HMWP9Z5QWX                      −45.28
                                              126.39 − 45.28 =  81.11  ✔
```

Es decir: cuando el anfitrión es el propietario, MTHosting cobra vía "coanfitrión" y el payout va al propietario (no se cuenta). Cuando el cobro lo hace MTHosting, el payout va a la cuenta MTH (sí se cuenta). Nunca se cuentan las dos puntas de la misma plata.

**Validación automatizada sobre los datos reales:** de 1.705 grupos de payout analizados, **1.509 cierran exactamente** (`Payout = Σ Monto de las filas siguientes`) y los 196 restantes cierran también pero **con conversión de moneda** (payout en ARS/EUR contra filas en USD). Usar esta identidad como test de integridad del importador.

### Clasificación de cuentas — tabla `cuentas_payout`

El destino está en `Detalles`, texto libre y **con muchas grafías del mismo destino**. Ejemplos reales:

```
Transferir a MTHOSTING, Checking 4343 (USD)        403
Transferir a MTHosting LLC, Checking 4343 (USD)    181
Transferir a MTHosting, Checking 4343 (USD)        154
Transferir a MT HOSTING, Savings 4343 (USD)        115
Transferir a MTHOSTING LLC, Checking 4343 (USD)     91
Transferir a MT HOSTING, Checking 4343 (USD)        72
Transferir a MT Hosting, Checking 4343 (USD)        54
Transferir a Tomas CRESSALL, Checking 4343 (USD)    75   ← mismo nro de cuenta, confirmar
Transferir a Tarjeta de débito: Payoneer (USD)     532   ← NO es MTH: es de propietarios
```

**Clasificaciones ya confirmadas por Marcos:**
- Todos los destinos **Payoneer son de PROPIETARIOS**, no de MTHosting (MTHosting los usó en años anteriores, pero no corresponden a ingreso actual). Precargar así.
- Las cuentas **4343** (todas sus grafías: `MTHOSTING`, `MTHosting LLC`, `MT HOSTING`, `MT Hosting`, `MTHOSTING LLC`, `Tomas CRESSALL`, Checking y Savings) son de **MTHosting**.
- ⚠️ **Hay más cuentas de MTHosting además de la 4343.** No hardcodear ese número en ninguna parte del código: la única fuente de verdad es la tabla `cuentas_payout` con el flag que tilda Marcos. El `4343` es solo un valor de precarga inicial, no una regla de negocio.

Requerimiento: el importador **extrae y da de alta automáticamente cada destino nuevo** que encuentra, parseando `titular`, `tipo` (Checking/Savings/PayPal/Payoneer/IBAN), `número` y `moneda`. La UI muestra el listado completo de cuentas detectadas con su volumen de movimientos y monto acumulado, y **Marcos tilda cuáles son de MTHosting**. Ningún destino nuevo se clasifica solo.

- Agrupar por **número de cuenta** cuando existe (el `4343` aparece con 7 nombres distintos): una fila por cuenta real, no por grafía.
- Estados: `MTH` / `PROPIETARIO` / `SIN_CLASIFICAR`. Los `SIN_CLASIFICAR` no suman a PERCIBIDO pero se muestran en un contador visible para que no pasen desapercibidos.
- Clasificar una cuenta **aplica retroactivamente** a todo el histórico, sin reimportar.

### Imputación del payout al departamento

Los `Payout` **no traen `Anuncio` ni código de confirmación**. Se imputan por **posición dentro del archivo**: cada fila `Payout` es seguida por las filas de detalle (`Reserva`, `Cobro como coanfitrión`, `Ajuste`, etc.) que la componen, hasta el siguiente `Payout`. El anuncio está en esas filas.

Regla (**asignación exacta, no estimación**):

1. Recorrer el archivo **en orden original** y agrupar: `Payout` + todas las filas siguientes hasta el próximo `Payout`.
2. Resolver el departamento de cada fila de detalle por su `Anuncio`.
3. **La parte del payout que corresponde a cada departamento = suma de los `Monto` de las filas de ese departamento dentro del grupo** (respetando los signos negativos de coanfitrión y ajustes). No hace falta prorratear: la suma de las partes da exactamente el payout.

Verificado sobre los datos reales:

```
06/20  payout 45.00   → DARREGUEYRA 1: 20.00 | BORGES 2: 25.00                        = 45.00  ✔
07/01  payout  8.60   → SOLDADO 2: −26.40 + 20.00 | NEWBERY 1: 15.00                  =  8.60  ✔
03/30  payout 154.65  → NEWBERY 1: 96.03 − 43.21 | SOLDADO 2: 152.29 − 50.46          = 154.65 ✔
```

**Único caso donde sí hace falta prorratear:** cuando el payout está en otra moneda que las filas de detalle (payout ARS vs detalle USD). Ahí se calcula el TC implícito del grupo (`Cobrado / Σ Monto`) y se aplica a la parte de cada departamento.

**Alcance del problema (medido, no estimado):** sobre 41 archivos del histórico, **6 contienen más de un departamento**, y generan 175 de los 1.705 grupos de payout. Detalle:

| Archivo | Grupos multi-depto | Departamentos |
|---|---|---|
| `airbnb_01_2026-07_2026 (38 ).csv` | 149 | ED TALC 05 a 12 (8 unidades) |
| `airbnb_01_2026-07_2026 (22).csv` | 10 | NEWBERY 1, SOLDADO 2 |
| `airbnb_01_2026-07_2026 (33).csv` | 8 | MAIPU 2, MAIPU 3 |
| `airbnb_01_2026-07_2026 (3).csv` | 5 | ARENALES 6, CABELLO 2, JUNCAL 1 |
| `airbnb_01_2026-07_2026 (7).csv` | 2 | ARENALES 4, GORRITI 1 |
| `airbnb_01_2026-07_2026 (13).csv` | 1 | BORGES 2, DARREGUEYRA 1 |

Casos a manejar: payout huérfano al inicio del archivo (sin filas de detalle debajo, porque el corte del export las dejó afuera) → queda `sin_imputar` y se lista en la bandeja de revisión.

### 5.3 Monedas

Hay filas en **USD, ARS, EUR, GBP**. Guardar `moneda` y `monto_original` siempre. Definir moneda de reporte (USD) y una tabla de tipos de cambio por fecha. Mientras no exista, mostrar los totales **segmentados por moneda** en vez de sumar peras con manzanas.

Dato útil: cuando el payout está en ARS/EUR y las filas de detalle en USD, **el tipo de cambio efectivo de Airbnb se puede despejar** (`Cobrado_payout / Σ Monto_detalle_USD`) y guardarse por payout. Ej.: payout de 404.499,72 ARS contra 274,10 USD → 1.475,7 ARS/USD. Eso permite reportar todo en USD sin depender de una fuente externa.

---

## 6. Vistas de la UI

Respetar el layout y los componentes actuales de la app (misma navegación, misma tabla base, mismos filtros, mismo estilo de tarjetas).

**Filtros globales de la sección:** rango de fechas (por `Fecha de cobro`), departamento (multi), propietario, moneda, estado (`efectivo` / `programado` / `ambos`).

### 6.1 Dashboard "Económico" — pantalla de entrada

**Nivel de exigencia: este dashboard tiene que servirle a un CFO.** No es un resumen bonito: es la herramienta con la que se entiende hacia dónde va la compañía y dónde hay que hacer ajustes. Dos requisitos que mandan sobre todo lo demás:

1. **Versatilidad.** Todo se puede filtrar, agrupar, comparar y exportar. El usuario tiene que poder responder una pregunta que no anticipamos, sin pedir desarrollo.
2. **Densidad de información útil.** Preferir mostrar de más antes que de menos, siempre que cada número sea accionable y esté explicado. Nada de KPIs decorativos.

#### Capacidades transversales (esto es lo que lo hace versátil)

- **Filtros combinables y persistentes:** período, departamento (multi), propietario, zona/barrio, moneda, estado (efectivo/programado), etiqueta del esquema de cobro (ordinario / recupero / comisión especial).
- **Agrupación configurable:** el usuario elige el eje de análisis — por departamento, por propietario, por zona, por mes, por trimestre. La misma pantalla sirve para "¿qué propietario me deja más?" y para "¿qué barrio rinde mejor?".
- **Comparador de períodos arbitrario:** mes vs mes, trimestre vs trimestre, año vs año, o dos rangos elegidos a mano. Siempre mostrando variación absoluta y porcentual.
- **Vistas guardadas:** el usuario guarda una combinación de filtros con nombre y la reabre después. Un CFO revisa las mismas 4 o 5 vistas todos los meses.
- **Todo exportable** a Excel y todo clickeable hasta el movimiento individual. Ningún número puede ser un callejón sin salida: siempre se llega al CSV de origen.
- **Alternar valores absolutos / porcentajes / índice base 100** para comparar departamentos de tamaños distintos.

#### Fila de KPIs (con variación contra el período anterior)

Ganancia · Percibido · Brecha (abs y %) · Programado pendiente · Ganancia proyectada del mes · N° de departamentos activos · Ganancia promedio por departamento · Ganancia por noche vendida.

#### Bloques — cada uno responde una pregunta de dirección

**Rumbo del negocio**

| Bloque | Pregunta |
|---|---|
| Curva de ganancia mensual con línea de tendencia y media móvil de 3 meses | ¿Crecemos, estamos planos o caemos? |
| Ganancia acumulada del año vs mismo período del año anterior | ¿Este año es mejor que el pasado? |
| Estacionalidad: ganancia por mes del año, varios años superpuestos | ¿Esta caída es del negocio o es el mes que siempre cae? |
| Evolución del n° de departamentos activos junto a la ganancia | ¿Crecemos por más unidades o porque cada unidad rinde más? |

**Dónde está la plata**

| Bloque | Pregunta |
|---|---|
| Ranking de departamentos **por GANANCIA** | ¿Cuáles sostienen el negocio? Nunca rankear por percibido: un depto cobrado al 100% por recupero de deuda aparecería primero sin ser el más rentable. |
| Ranking por **ganancia por noche vendida** | ¿Cuál rinde mejor por unidad de uso, más allá del tamaño? |
| Ranking por propietario | ¿Con quién conviene profundizar la relación y con quién no? |
| Concentración: % de ganancia de los top 5 y top 10, e índice de concentración | ¿Cuánto perdemos si se va un propietario? |
| Distribución de la ganancia por departamento (barras ordenadas) | ¿Vivimos de pocos o está repartido? |

**Dónde ajustar**

| Bloque | Pregunta |
|---|---|
| **Ranking de brecha** (más negativa primero) | ¿Dónde estoy dejando de cobrar? Bloque de acción directa. |
| **Cobros de resolución sin comisionar**, acumulado y por departamento | Detectado en los dos archivos de prueba: es plata que se pierde de forma sistemática. |
| Variación mes contra mes por departamento (top subas y bajas) | ¿Qué se cayó y hay que mirar ya? |
| Departamentos por debajo de su promedio histórico | ¿Cuáles están perdiendo tracción de forma sostenida? |
| Departamentos sin movimientos en el período | ¿Alguno dejó de operar sin que nos enteremos? |
| Departamentos con esquema de cobro no ordinario (recupero, comisión especial) | ¿Qué parte del ingreso no es recurrente? |

**Hacia adelante**

| Bloque | Pregunta |
|---|---|
| Ganancia proyectada del mes = percibido a la fecha + programado pendiente | ¿Cómo cierra el mes? |
| Pipeline de programados por mes futuro | ¿Qué hay comprometido para los próximos meses? |
| Tasa de materialización de programados (histórico: cuántos se convirtieron y cuántos se cancelaron) | ¿Cuánto puedo confiar en la proyección? |

#### Métricas operativas derivadas (calculables con los datos que ya entran)

Noches vendidas · tarifa promedio por noche · estadía promedio en noches · n° de reservas · ganancia por reserva · **ocupación aproximada** (noches vendidas ÷ noches del período). La ocupación es una **aproximación**: asume el departamento disponible todo el mes. Etiquetarla como tal en la UI, nunca presentarla como dato firme.

#### Reglas de la pantalla

- Todos los bloques respetan los filtros globales, sin excepción.
- Todo elemento es **clickeable hacia el drill-down**: del ranking al detalle mensual del departamento, y de ahí al movimiento individual con su línea de CSV.
- El mes en curso se marca visualmente como **parcial**, para no leer una caída falsa.
- Nada de gráficos de torta con más de 6 categorías: con ~50 departamentos son ilegibles. Barras horizontales ordenadas.
- Cada número que sea una estimación o dependa de un supuesto (ocupación, proyección, tipo de cambio implícito) lleva un indicador visible que lo aclara. **Un CFO necesita saber qué está mirando, no solo el número.**

### 6.2 Tabla "Departamento × Mes" (vista principal)

**Esta es la vista que pidió Marcos. Tres columnas de números, nada más:**

| Depto | Mes | **GANANCIA** | **PERCIBIDO** | **BRECHA** |
|---|---|---|---|---|
| ARENALES 2 | Jun-26 | 412,30 | 389,50 | −22,80 |
| ARENALES 2 | Jul-26 | 501,10 | 501,10 | 0,00 |

- Pivot: departamentos en filas, meses en columnas (o meses en filas y depto filtrado). Ambas orientaciones si el layout de la app ya soporta un componente de pivot; si no, filas `depto × mes` con agrupación colapsable por departamento.
- Fila y columna de totales. Semáforo en la brecha (verde ≈0, amarillo, rojo).
- Columna secundaria opcional (togglable, apagada por defecto): `Programado` del mes.
- **NO incluir columnas de Coanfitrión / Payouts / N° movimientos / Monto bruto en esta vista.** Ensucian y no es lo que se quiere mirar.

### 6.3 Drill-down de una celda

Al hacer click en una celda (depto + mes) se abre el detalle de movimientos: anuncio, huésped, tipo, código de confirmación, fecha de cobro, check-in/out, noches, monto, limpieza, comisión, ganancia, y **el origen del percibido (coanfitrión / payout)** — que es el único lugar donde aparece el desglose por canal. Fila resaltada cuando es estadía >30 noches prorrateada o cuando es un tipo "extra".

Este drill-down es la herramienta para entender una brecha: por ejemplo un early check-in al que no se le cobró comisión aparece acá como una reserva con ganancia > 0 y percibido = 0.

### 6.4 Vista "Programados"

Pendientes vigentes por departamento y mes, con el diff del último snapshot (nuevos / materializados / cancelados / modificados).

### 6.5 Bandejas de mantenimiento

- **Anuncios sin mapear** → asignar al departamento existente en la app.
- **Cuentas de payout** → listado completo de cuentas detectadas (titular, tipo, número, moneda, N° movim., monto acumulado) con checkbox "es cuenta MTHosting". Es la pantalla que usa Marcos para definir el universo MTH.
- **Payouts sin imputar** → huérfanos al inicio de archivo o con anuncios sin mapear.
- Historial de importaciones con deshacer.

### 6.6 Modo validación / conciliación (construir PRIMERO)

Marcos no va a usar el módulo hasta poder verificar que los números dan bien. **Construí esta pantalla antes que el dashboard**, porque es lo que habilita a confiar en el resto.

Debe permitir, para un departamento y un mes:

1. **Ver el número final junto con todo lo que lo compone**, en una sola pantalla: cada movimiento que suma a GANANCIA y cada uno que suma a PERCIBIDO, con su fecha, código de confirmación, huésped, monto y de qué fila del CSV salió (archivo + número de línea).
2. **Trazabilidad al archivo origen:** cada movimiento muestra de qué CSV y qué línea vino. Sin esto no se puede auditar nada.
3. **Panel de descartes:** cuántas filas se ignoraron por duplicado, por anuncio sin mapear, por cuenta sin clasificar, y por tipo no contemplado — con el detalle descargable. Lo que no se ve es lo que genera desconfianza.
4. **Comparador contra referencia externa:** poder pegar o importar un total conocido (ej. la hoja "Resumen por Depto" de `Cobros_MTHosting_Febrero_2026.xlsx`) y que la pantalla muestre depto por depto el valor calculado, el esperado y la diferencia. Verde si cierra, rojo si no.
5. **Chequeos automáticos** con semáforo global: identidad payout = Σ detalle, suma de partes por departamento = payout total, ningún anuncio sin mapear, ninguna cuenta sin clasificar.

### 6.7 Export

Exportar cualquier vista a Excel replicando el formato de los reportes actuales (`Cobros_MTHosting_Febrero_2026.xlsx`: hoja "Resumen por Depto" + hoja "Detalle").

---

## 7. Referencias en el repo / archivos de apoyo

- `build_cobros_mthostin.py` — script actual que ya implementa parseo, mapeo, prorrateo de estadías largas y detección de multi-pago. **Portar su lógica, no reinventarla.** Ojo: usa un `CUTOFF_DATE` hardcodeado para separar realizados de próximos — en la app eso debe ser dinámico (efectivo vs programado por tabla, no por fecha).
- `anuncio_depto.json` — mapeo anuncio → departamento (semilla de la migración).
- `TABLAS.xlsx` — hoja1: anuncio→depto (col A/B) y depto→propietario (col E/F).
- `Cobros_MTHosting_Febrero_2026.xlsx` — formato objetivo del reporte.
- `airbnb_cobranza_spec_v2.docx` — spec previa de cobranza, revisar antes de definir el modelo.
- Carpetas de muestra: `COBROS DE RESERVAS/` (efectivos, ~45 CSV), `PROXIMOS COBROS/` (programados, 37 CSV).
- **`VALIDACION - KENNEDY 1.xlsx`** y **`VALIDACION - ED TALC (8 unidades).xlsx`** — resultados de la validación previa descrita en el punto 11. Contienen los números esperados contra los que debe cuadrar la implementación.

---

## 8. Criterios de aceptación

1. Importar las ~45 CSV de `COBROS DE RESERVAS/` en cualquier orden produce **exactamente el mismo resultado**; reimportar todo por segunda vez suma **0 filas nuevas**.
2. Un mismo código de confirmación con pagos en meses distintos genera **una fila por pago**, no se colapsa como duplicado.
3. Importar un set de programados y luego uno nuevo deja **solo el nuevo** como vigente, con el diff calculado correctamente.
4. La **GANANCIA** de un departamento cuadra con el reporte manual existente (validar contra `Cobros_MTHosting_Febrero_2026.xlsx`, hoja "Resumen por Depto", tolerancia < $1 por redondeo).
5. **Test de integridad de payouts:** para cada grupo, `Cobrado_payout == Σ Monto de las filas de detalle` (± FX si difiere la moneda). Debe cerrar en ≥ 99% de los grupos; los que no cierran quedan listados.
6. Un archivo con **varios departamentos** (export por propietario) imputa cada fila a su departamento correcto, y un payout que cubre 2+ anuncios se reparte por suma exacta de las filas de cada departamento.
7. **Los fondos en custodia no suman a PERCIBIDO.** Verificar con el caso ARENALES 2 documentado en 5.2: el payout de 327,49 a la cuenta 4343 no debe aparecer como percibido; solo los 87,57 del coanfitrión.
8. Ningún anuncio ni cuenta de payout desconocido se pierde: todos caen en su bandeja y clasificarlos aplica retroactivamente.
9. Cambiar el `% comisión` de un departamento recalcula la GANANCIA sin necesidad de reimportar.
10. Tests unitarios sobre: parser de las 3 variantes de header, parser de números (coma vs punto), dedup, agrupamiento payout→detalle, reparto multi-anuncio, detección de custodia, prorrateo de estadías largas.

---

## 9. Fuera de alcance — etapa 2 de la sección ECONÓMICO

**No construir ahora.** Se listan para que el modelo de datos no las bloquee y para que el dato que hoy ya está disponible quede guardado e imputado correctamente en vez de descartarse:

- **Pagos / giros a propietarios.** Cuánto se cobró en nombre de cada propietario (los *fondos en custodia* del punto 5.2), cuánto se le giró efectivamente y el saldo pendiente por propietario y período. La mitad del dato ya sale de estos CSV; la otra mitad (los giros) requiere una fuente que hoy no existe.
- **Gastos de Airbnb y operativos** por departamento (comisiones de plataforma, limpieza real, mantenimiento, etc.).
- **Resultado por departamento:** ganancia − gastos, que es el número que en definitiva permite decidir si conviene seguir con una unidad.

Requisito concreto para esta entrega: que agregar esas categorías en el futuro sea **insertar filas en `movimiento_economico`**, no rehacer el modelo ni tocar el importador.

---

## 10. Antes de empezar — confirmar con Marcos

1. Si el `% comisión` necesita versionado por fecha desde el día uno o alcanza con el valor actual. *(La evidencia del punto 11 dice que sí hace falta: KENNEDY 1 cambia de esquema en junio 2026.)*
2. Moneda de reporte: ¿USD con el TC implícito de Airbnb, o vistas separadas por moneda?

*(Ya resueltos: Payoneer = cuentas de propietarios; 4343 y sus variantes = MTHosting; existen otras cuentas MTH, así que la clasificación vive en la tabla `cuentas_payout`, nunca hardcodeada.)*

---

## 11. Validación previa ya realizada — usar como banco de pruebas

Antes de escribir esta spec se corrió el motor de cálculo completo sobre dos archivos reales. **Los números de abajo son la referencia contra la cual debe cuadrar la implementación.** Si tu código no reproduce estos totales, el error es tuyo, no de los datos.

### Prueba 1 — KENNEDY 1 (`airbnb_01_2026-05_2026 (ANT).csv`, 152 filas, 1 departamento)

Comisión 20%. Payouts en ARS a cuenta del propietario (no suman a percibido).

| Mes | Reservas | Ganancia | Percibido | Brecha |
|---|---|---|---|---|
| Ene-26 | 9 | 368,20 | 331,96 | −36,24 |
| Feb-26 | 9 | 409,30 | 409,30 | 0,00 |
| Mar-26 | 10 | 453,79 | 450,79 | −3,00 |
| Abr-26 | 11 | 464,88 | 461,70 | −3,18 |
| May-26 | 7 | 246,25 | 239,26 | −6,99 |
| **Total** | **46** | **1.942,43** | **1.893,01** | **−49,42** |

*(La ganancia incluye el AirCover de 6,00 comisionado; con AirCover fuera de la ganancia el total es 1.941,23. Ambos números son correctos según cómo se resuelva la asignación del AirCover — ver 5.1.)*

**39 de las 46 reservas cierran al centavo.** Las 7 restantes son hallazgos reales: una reserva sin ninguna línea de coanfitrión (HM8F5ZH4JQ, 32,22 nunca cobrados), cinco cobros de resolución sin comisionar y un ajuste de resolución que no se reflejó en la comisión.

### Prueba 2 — Deduplicación (`(ANT)` 152 filas vs `(ULT)` 222 filas, mismo departamento)

| Paso | Resultado esperado |
|---|---|
| Importar ANT | 152 insertadas |
| Importar ULT | +70 nuevas, 152 duplicadas |
| Reimportar ULT | **0 nuevas** |
| Base final | 222 filas |

Sobre el histórico completo (5.712 filas, 41 archivos): resultado idéntico en cualquier orden, y reimportar todo agrega 0.

### Prueba 3 — Cambio de esquema (mismo departamento, `(ULT)`)

De enero a mayo la línea de coanfitrión es el **20,0% exacto** en las 49 reservas; desde junio pasa a **80% + limpieza** en las 18 reservas de junio y julio, mientras el payout cae del 80% al 20%. **Es intencional** (acuerdo de recupero de deuda). El sistema debe detectarlo y pedir etiqueta, no reinterpretarlo.

### Prueba 4 — ED TALC (`airbnb_01_2026-05_2026 (28).csv`, 870 filas, **8 departamentos en un solo archivo**)

Es la prueba del reparto de payouts entre departamentos.

| Control | Resultado esperado |
|---|---|
| Grupos de payout | 147, ninguno huérfano |
| Grupos que cubren más de un departamento | 100 |
| Grupos donde `payout == Σ detalle` | **147 / 147** |
| Suma de las partes por departamento | **25.119,88** |
| Suma de todos los payouts | **25.119,88** (diferencia 0,00) |

| | Ene–May 2026 |
|---|---|
| Ganancia | 12.117,44 |
| Percibido | 12.040,27 |
| Brecha | **−77,17** |

La brecha se explica íntegramente: **USD 385 en cobros de resolución nunca comisionados** × 20% = 77,00. Las líneas de coanfitrión dan 20,0% exacto en las 26 comparaciones limpias. Hay además 6 movimientos de AirCover por USD 168 pendientes de asignación.

### Hallazgo de negocio transversal

En los dos departamentos probados, **los cobros de resolución (early/late check-in y extras) nunca se comisionan**. Son USD 97 en cinco meses sobre 9 departamentos de una cartera de ~50. El dashboard debe exponer esto como bloque propio (ver 6.1, "Dónde ajustar"), porque es una fuga sistemática y no un error puntual.
