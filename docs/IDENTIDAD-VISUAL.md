# Identidad visual de MTHosting

**Tema oscuro único** (decisión del dueño, 22/09/2026). Isotipo "Barras" y
verde bosque de marca. Toda la app usa el mismo tema, pantalla de ingreso
incluida.

Este documento es la fuente de verdad. El handoff original del modo claro
quedó como antecedente en `docs/identidad/HANDOFF-MODO-CLARO.md`: de ahí
salen el logo, la tipografía y la lógica de color de los estados, que siguen
vigentes. Sus colores claros no.

---

## 1. Principio

La app es una herramienta de trabajo que se usa todo el día, muchas veces
desde el celular en la calle. El oscuro cansa menos la vista y hace que lo
que tiene color (un estado, una alerta, el botón principal) se vea de lejos.
Por eso **el color significa algo**: si una cosa no está avisando nada, es
gris.

## 2. Reglas en el código

1. **Ningún color escrito a mano.** Las pantallas usan tokens, como
   `bg-superficie` o `text-exito-text`. No usan `bg-slate-800` ni
   `text-white`.
   - `app/globals.css` apaga la paleta de fábrica de Tailwind, así que una
     clase de fábrica no pinta nada.
   - `lib/identidad.test.ts` falla si aparece una, o si se usa un token que
     no existe.
2. **Si falta un color, se agrega a `app/globals.css`**, con un comentario
   que diga para qué es. No se resuelve en la pantalla.
3. **Botones, campos, tarjetas y pastillas salen de `lib/ui.ts`** (o de los
   componentes de `app/componentes/`, que la usan). No se copian clases de
   otra pantalla.
4. **El color de un estado sale de `lib/estados.ts`.** Ninguna pantalla
   decide con un `if` qué color lleva "cancelada".

## 3. Tokens (`app/globals.css`)

Los valores son los de la paleta de Tailwind que la app ya usaba, copiados
en oklch. El comentario de cada token dice de qué tono viene.

### Marca

| Token | Uso |
|---|---|
| `primary` `#5FBF87` | Botón principal, enlaces, foco, casilla marcada. Es el verde bosque del isotipo con más luz: 7,9:1 sobre el fondo. |
| `primary-hover` / `primary-active` | Estados del botón. |
| `primary-soft` / `primary-soft-text` | Reserva confirmada. |

### Superficies, de atrás hacia adelante

| Token | Tono | Uso |
|---|---|---|
| `fondo` | slate-900 | Fondo de la app y del menú. |
| `fondo-hundido` | slate-950 | Velo detrás de un modal, recuadro hundido. |
| `superficie` | slate-800 al 40 % | Tarjetas. |
| `superficie-alt` | slate-800 al 60 % | Encabezado de tabla, hover de tarjeta. |
| `elevada` | slate-800 | Campos de formulario, ítem activo del menú, pastilla neutra. |
| `elevada-hover` | slate-700 | Hover sobre lo elevado. |

### Bordes

| Token | Tono | Uso |
|---|---|---|
| `borde` | slate-800 | Tarjetas, separadores. |
| `borde-control` | slate-700 | Campos, botón secundario. |
| `borde-fuerte` | slate-600 | Separación que tiene que notarse. |
| `borde-activo` | slate-400 | Opción elegida en un filtro. |

### Texto, de más a menos presencia

| Token | Tono | Uso |
|---|---|---|
| `tinta` | slate-50 | Títulos, dato principal. |
| `tinta-media` | slate-200 | Dato de apoyo con peso. |
| `tinta-suave` | slate-300 | Cuerpo. |
| `tinta-tenue` | slate-400 | Secundario. |
| `tinta-etiqueta` | slate-500 | Rótulos, "sin datos". |
| `tinta-apagada` | slate-600 | Subrayados, separadores de texto. |
| `tinta-inversa` | slate-900 | Texto sobre `primary` o sobre un relleno claro. |

### Semánticos

Hay seis familias y todas tienen la misma escala. Así una pantalla no tiene
que pensar qué número usar.

| Familia | Color | Significa |
|---|---|---|
| `exito` | emerald | Cerrado bien. |
| `aviso` | amber | Necesita atención. |
| `error` | red | Error, o cerrado mal. |
| `dato` | sky | Esperando a otro, información. |
| `ahora` | orange | Pasando ahora. |
| `excepcion` | violet | Se salió del flujo normal. |

| Sufijo | Tono | Para qué |
|---|---|---|
| `-soft` | 950 | Fondo de pastilla o de recuadro. |
| `-borde` | 800 | Borde de ese recuadro. |
| sin sufijo | 500 | Punto, barra, filete lateral. |
| `-intenso` | 700 | Relleno de un botón con texto claro. |
| `-text` | 300 | Texto sobre `-soft` o sobre el fondo. |
| `-text-fuerte` | 200 | Título dentro de un recuadro. |

La **alerta de vencimiento** tiene su propio trío: `alerta-soft`,
`alerta-text` y `alerta-punto`. Es más saturado que `ahora`, para que salte
en una lista llena.

Todos admiten opacidad: `bg-aviso-soft/40`.

## 4. Logo

- Es el isotipo "Barras", un monograma MT. Va embebido en
  `app/componentes/Logo.tsx`.
- Los SVG y PNG están en `public/icons/`. Los PNG se generan con
  `node scripts/generar-iconos.mjs`.
- **Reglas que no se tocan:** no rotar, no estirar, no sombrear, no cambiar
  los colores.
- **El ámbar `#E8A33D` vive solo adentro del isotipo.** En la interfaz no
  existe como token.
- **Sobre el fondo oscuro se usa el tono `color`:** la baldosa verde, con el
  nombre en el color del texto de alrededor (`className="text-tinta"`).
- **PWA:** el manifest y la barra de estado del celular usan el color del
  fondo (`#0F172B`), así la app se ve continua al abrirla.

## 5. Piezas (`lib/ui.ts`)

| Receta | Qué es |
|---|---|
| `clsBoton(variante, tamaño)` | Variantes: `primario` (verde), `secundario` (contorno), `discreto` (solo texto), `peligro` (rojo, para lo que no tiene vuelta atrás). Tamaños: `chico` (44px en el celular y 36px en el escritorio), `normal` (44px), `grande` (48px, la acción principal en el celular), `icono` (44×44). |
| `clsBotonPrimario` / `clsBotonSecundario` | Atajos de `clsBoton`. |
| `clsEntrada` / `clsAreaTexto` / `clsEtiqueta` | Campos de formulario. El foco pinta el borde de `primary`. |
| `clsTarjeta` | `rounded-xl`, borde y `superficie`. |
| `clsPastilla` | La forma de toda pastilla: redonda, 12px. El color lo pone el estado. |
| `clsEnlace` | Enlace dentro de un texto. |
| `clsTitulo` | Título de pantalla. |

Componentes que las envuelven, en `app/componentes/`:

- `Boton`
- `Badge`: recibe un `Tono` de `lib/estados.ts`.
- `Tarjeta`: tiene `filete` para el borde lateral de color.
- `Tabla`, `Encabezado`, `Th`, `Fila`, `Td`, `SinFilas`: filas de 40px y
  cifras alineadas.

**Radios:** `rounded-lg` (8px) en controles y botones, `rounded-xl` (12px)
en tarjetas y `rounded-full` en pastillas.

## 6. Estados (`lib/estados.ts`)

Un solo mapa `estado → Tono`. La lógica de color es **transversal** a
reservas, limpiezas, reclamos y marcas:

| Color | Significa |
|---|---|
| gris | Inerte, nadie lo está tocando. |
| azul | En manos de otro, esperando. |
| naranja | Pasando ahora. |
| ámbar | Hay que ocuparse (por presentar, late checkout). |
| verde | Cerrado bien. |
| rojo | Cerrado mal. |
| violeta | Excepción. |

Mapas:

- `TONO_RESERVA`, `TONO_LIMPIEZA`, `TONO_RECLAMO`: los estados del ciclo de
  cada dominio.
- `TONO_CAMBIO_CALENDARIO`: lo que el calendario de Airbnb puso en duda.
- `TONO_MARCA`: las señales sueltas del Día y la Semana (tentativa,
  coordinado, late, movido, cancelada, check in/out, fecha a mano).
- `TONO_VENCIMIENTO` y `FILA_VENCE`.

Cada mapa tiene su `ETIQUETA_*` al lado.

**Señales no cromáticas, obligatorias:**

- **Tentativa:** violeta con **borde punteado**.
- **Vence pronto:** lleva un **punto**.

**Una sola alarma por fila:** o se pinta la fila, o va la pastilla de
vencimiento, nunca las dos.

Un estado nuevo elige uno de los roles de arriba, no un color.
`lib/estados.test.ts` controla que la lógica siga siendo la misma en todos
los dominios.

## 7. Tipografía

- **IBM Plex Sans y Plex Mono**, cargadas con next/font en `app/layout.tsx`.
- **Mono** para códigos de reserva, códigos de departamento y claves.
- **`tabular-nums`** en toda columna de números o fechas. Las tablas lo
  llevan por defecto.

| Uso | Estilo |
|---|---|
| Título de pantalla | `text-2xl font-semibold tracking-tight text-tinta` (`clsTitulo`) |
| Título de sección | `text-lg font-semibold` |
| Cuerpo | `text-sm` en el escritorio; en los campos del celular, `text-base` (16px, para que iOS no haga zoom) |
| Rótulo | `text-xs uppercase tracking-wide text-tinta-etiqueta` |
| Pastilla | `text-xs font-medium` |

## 8. Pantallas

### 8.1 Menú

`app/(app)/Sidebar.tsx`:

- **En el escritorio**, 240px fijo a la izquierda. El ítem activo va sobre
  `elevada`.
- **En el celular**, una barra angosta arriba y el menú como panel.
- **Contadores:** `error` para lo crítico y `aviso` para lo pendiente.

### 8.2 Responsive

Check-in/out y limpiezas son **mobile-first**: se usan desde la calle. En
el celular nada tocable baja de **44px** de alto. La importación es solo de
escritorio.

## 9. Interacción

- **Foco:** anillo de 2px en `primary`, con 2px de separación. Nunca el azul
  del navegador (regla global en `globals.css`).
- **Deshabilitado:** 45 % de opacidad y cursor de "no permitido".
- **Transiciones:** de color, 150ms.
- **Error de formulario:** el campo lleva `aria-invalid` y el borde se pinta
  de `error`. El mensaje va en `bg-error-soft text-error-text`.

## 10. Si algún día se retoma el modo claro

El sistema está armado para eso:

- **Las pantallas no nombran colores**, así que un tema claro es otro juego
  de valores para los mismos tokens. No hay que rehacer pantallas.
- **La paleta clara aprobada** (bosque profundo + terracota, neutrales
  cálidos) está en `docs/identidad/HANDOFF-MODO-CLARO.md` y
  `docs/identidad/tokens.css`.
