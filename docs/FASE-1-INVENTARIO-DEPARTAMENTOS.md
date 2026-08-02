# Inventario y distribución de departamentos — detalle completo

Complementa la sección 1 de `FASE-1-ESPECIFICACION.md`. Esa spec menciona las
tablas `distribucion_depto`, `item_catalogo` e `inventario_depto` pero no lista
los campos uno por uno. Acá está el detalle completo, tal como aparece en el
prototipo.

**Todo esto entra en Fase 1** (decisión ya tomada: inventario completo desde el
arranque). La vista de limpieza (Fase 2) consume estos datos para calcular qué
llevar, así que tienen que estar cargados con cantidades reales.

---

## 1. Cómo se modela

Dos tipos de dato distintos, que se tratan diferente:

### 1.1 Distribución (cantidades)

Camas y baños son **cantidades**, no sí/no. Se cargan con un número por tipo.

| Campo | Tipo | Notas |
|---|---|---|
| Habitaciones | int | cantidad |
| Camas King | int | cantidad |
| Camas Queen | int | cantidad |
| Camas Twin | int | cantidad |
| Sillón cama | int | cantidad |
| Baño 1 | texto/bool | existe + detalle (ej: "completo con ducha") |
| Baño 2 | texto/bool | existe + detalle |
| Baño 3 | texto/bool | existe + detalle |

**Total de camas: NO se carga a mano.** Se calcula sumando king + queen +
twin + sillón cama. Es un campo derivado, nunca editable.

**Cantidad de baños:** se deriva de cuántos de baño 1/2/3 están cargados. Se
usa en la vista de limpieza para el pie de baño (uno por baño).

### 1.2 Equipamiento (tiene / no tiene + detalle)

El resto del inventario es **tiene o no tiene**, con un campo de detalle
opcional al lado. En la UI es una casilla que se marca, más un texto libre
opcional (ej: microondas ✓ + "Whirlpool blanco").

Modelo sugerido: un catálogo de ítems (`item_catalogo`) y una tabla que vincula
depto con ítem (`inventario_depto`) con un booleano "tiene" y un texto
"detalle". Así se pueden agregar ítems nuevos sin cambiar el esquema.

---

## 2. Lista completa de ítems de equipamiento

Agrupados como se muestran en la ficha. El grupo es solo para ordenar la UI.

### Climatización
- Aire habitación 1
- Aire habitación 2
- Aire habitación 3
- Aire living
- Calefacción
- Agua caliente

### Cocina
- Cocina
- Heladera
- Microondas
- Pava
- Cafetera
- Tostadora
- Sanguchera
- Hornito eléctrico
- Licuadora

### Lavado
- Lavarropas
- Tender
- Plancha
- Tabla de planchar
- Aspiradora
- Laundry (servicio de lavandería cercano)

### Otros
- TV
- Balcón
- Perchas
- Basura (dónde se tira)
- Secador de pelo
- Frazadas
- Estacionamiento
- Velocidad de wifi

### Edificio (amenities del edificio, no del depto)
- Pileta
- Gimnasio
- Sauna

---

## 3. Cómo se ve en la ficha

En la ficha del departamento (ver prototipo), esto vive en secciones plegables
del acordeón:

- **Ambientes y camas**: ambientes, habitaciones, baños, y las camas por tipo
  con su contador. El total de camas se muestra calculado.
- Un grupo plegable por cada categoría de equipamiento (Climatización, Cocina,
  Lavado, Otros, Edificio), cada uno con un contador "tiene / total" en el
  encabezado.

Cada ítem: casilla marcable + campo de detalle opcional.

---

## 4. Migración desde Ninox — advertencia importante

En Ninox estos campos son **texto libre mezclado**: "MICROONDAS" puede decir
"sí", "1", "Whirlpool blanco" o estar vacío. No se puede migrar
automáticamente a tiene/no-tiene con confianza.

**Requiere revisión manual, departamento por departamento.** Son ~40 campos ×
50+ deptos ≈ 2.000 datos. Es trabajo de una persona sentada un par de días, no
un script. Vale la pena hacerlo bien: la vista de limpieza depende de que estos
datos sean cantidades reales, no notas sueltas. Si se migra a medias, la
pantalla más importante de la Fase 2 muestra datos incompletos y el equipo deja
de confiar en ella.

---

## 5. Para pasarle a Claude Code

> En la ficha de departamento falta el inventario completo. Está detallado en
> `docs/FASE-1-INVENTARIO-DEPARTAMENTOS.md`. Implementá:
> - Distribución con cantidades (habitaciones, camas por tipo con total
>   calculado, baños con detalle).
> - Equipamiento como tiene/no-tiene + detalle opcional, con los ítems y grupos
>   de ese documento.
> - En la ficha, todo en el acordeón de secciones plegables como en el
>   prototipo (`prototipo/MTHosting-Prototipo.html`).
