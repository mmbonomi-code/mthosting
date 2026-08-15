<!-- ------------------------------------------------------------------------
     NOTA DEL PROYECTO — lo de abajo es el handoff tal como llegó, sin tocar.

     Estado de la implementación (15/08/2026):

       [x] Paso 1 — logo, íconos y PWA. Los 11 SVG están en `public/icons`,
           los PNG se generan con `node scripts/generar-iconos.mjs`, y el
           manifest y el favicon ya usan el isotipo.
       [x] Paso 2 — tokens y tipografía, en el `@theme` de `app/globals.css`.
           `docs/identidad/tokens.css` quedó como referencia: el
           `tailwind.config.ts` del handoff es de la versión 3 y este proyecto
           usa la 4, donde el tema vive en el CSS y ese archivo no se lee.
       [x] Paso 3 — badge, botón, tarjeta y tabla, con el mapa de estados en
           `lib/estados.ts`.
       [x] Paso 4 — primera pantalla migrada (Limpiezas / semana).
       [ ] Paso 5 — el resto de las pantallas. Empezar por el armazón
           (`app/(app)/layout.tsx`), que sigue oscuro.
       [ ] Paso 6 — sacar la paleta de fábrica de Tailwind para que no se
           pueda escribir un color a mano.

     Al terminar cada pantalla del paso 5:

         npx next build
         node scripts/verificar-identidad.mjs <los archivos tocados>

     Un token mal escrito no rompe nada —la clase no existe y el elemento
     queda sin pintar—, así que conviene que lo diga una comprobación y no
     el ojo.

     Mientras el paso 5 no esté, las pantallas sin migrar siguen en el tema
     oscuro viejo. Eso es transitorio y esperable, no es que la identidad
     esté mal aplicada.

     Dos cosas que el handoff da por hechas y que este proyecto todavía no
     tiene, para no leerlas como si existieran:
       - El menú lateral de 240px de §8.1: hoy la navegación es una barra
         horizontal arriba.
       - El funcionamiento sin conexión de §10: no hay service worker.
     ------------------------------------------------------------------------ -->

# Handoff: identidad visual MTHosting (PMS interno + comunicación a propietarios)

**Dirección final aprobada: isotipo 2a "Barras" + paleta 4B "Bosque profundo + terracota".**
Todo lo que está en este documento es final. Si algo de este README contradice un archivo HTML del bundle, gana el README.

---

## 1. Overview

MTHosting es una operación de co-hosting en Buenos Aires: administra ~50 departamentos de
alquiler temporario en Airbnb para propietarios terceros. La marca se usa en dos lugares:

1. **Webapp interna (PMS)** — uso diario del equipo: operaciones, gobernanta, personal de
   limpieza (desde el celular, instalada como PWA) y el dueño.
2. **Comunicación con propietarios** — reportes, liquidaciones, propuestas.

**El huésped nunca ve esta marca.** No es una marca de consumidor final.

**Tono:** operativo, confiable, prolijo. Herramienta de trabajo, no lifestyle ni boutique
hotelera. El registro de referencia es software de gestión (Linear, Notion, Stripe), no una
inmobiliaria.

**Idioma de la UI:** español de Argentina (es-AR). Fechas `DD/MM/AAAA`. Montos con punto de
miles y coma decimal: `USD 1.284,50`.

---

## 2. About the design files

**Este bundle contiene una sola dirección: la definitiva.** No hay alternativas, exploraciones ni
variantes adentro. Todo lo que está acá es final y se usa tal cual:

- `tokens.css` — pegar en el proyecto tal cual.
- `tailwind.config.ts` — mergear con el config existente.
- `manifest.webmanifest` — base del manifest de la PWA.
- `logo/*.svg` — assets finales, listos para usar.

No se incluyen prototipos HTML a propósito: las exploraciones previas (otros isotipos, otras
paletas) quedaron descartadas y meterlas acá sólo generaría ambigüedad. **Este README es la única
fuente de verdad.**

Lo que no está definido en este documento — la implementación de las pantallas — hay que
construirlo en el entorno que ya tiene el codebase (Next.js + React + Tailwind, según lo que
exista), usando sus patrones y librerías establecidas. Si todavía no hay entorno definido, elegir
el framework más apropiado e implementar ahí, respetando los tokens y las especificaciones de las
secciones 5 a 10.

## 3. Fidelity

**High-fidelity (hifi) a nivel de sistema.** Colores, tipografía, tamaños, estados y assets son
finales y están validados en contraste: todos los valores de este documento cumplen **WCAG AA**
(≥4,5:1 texto normal, ≥3:1 elementos de UI) y el ratio está indicado en cada par. Tomarlos
literalmente, sin reinterpretar.

Las **pantallas** (sección 8) están especificadas pero no mockeadas pixel a pixel: layout,
medidas, colores y copy están dados; la composición fina queda a criterio de la implementación,
siempre dentro de estos tokens.

---

## 4. Logo

### Concepto
El isotipo "Barras" es un monograma **MT** geométrico: la barra horizontal superior es el travesaño
de la **T**; debajo hay tres columnas — la del medio, más alta, es el asta de la T, y las dos
cortas de los extremos cierran los pies de la **M**. De reojo también lee como un gráfico de
ocupación, lo cual es apropiado para un PMS. No hay casita, ni llave, ni pin de mapa, ni cama.

### Geometría exacta (viewBox `0 0 32 32`)

| Elemento | x | y | w | h | rx | fill |
| --- | --- | --- | --- | --- | --- | --- |
| Tile de fondo | 0 | 0 | 32 | 32 | 7 | `#14532D` |
| Travesaño de la T | 5 | 5.5 | 22 | 4 | 0.5 | `#FFFFFF` |
| Columna izquierda (pie de M) | 5 | 19 | 4.6 | 8 | 0.5 | `#FFFFFF` |
| Columna central (asta de T) | 13.7 | 12 | 4.6 | 15 | 0.5 | `#FFFFFF` |
| Columna derecha (pie de M) | 22.4 | 19 | 4.6 | 8 | 0.5 | `#E8A33D` |

Sin degradados, sin sombras, sin trazos finos. Un solo peso de forma.

### Archivos entregados (`logo/`)

| Archivo | Uso |
| --- | --- |
| `isotipo-color.svg` | Isotipo cuadrado, verde con módulo ámbar. Uso general en pantalla. |
| `isotipo-negro.svg` | Barras en `#1A1815` sin tile. Monocromo sobre fondo claro. |
| `isotipo-blanco.svg` | Barras en blanco sin tile. Monocromo sobre fondo oscuro. |
| `isotipo-tile-negro.svg` | Tile `#1A1815` con barras blancas. Para cuando hace falta el cuadrado en monocromo. |
| `horizontal-color.svg` | Isotipo + "MTHosting". Header de la app, membrete de reportes. |
| `horizontal-negro.svg` / `horizontal-blanco.svg` | Monocromas del logotipo horizontal. |
| `favicon.svg` | Igual al isotipo pero `rx="3"`: a 16px el radio de 7 se come las esquinas. |
| `pwa-icon-512-any.svg` | Ícono `purpose="any"` de la PWA, 512×512. |
| `pwa-icon-512-maskable.svg` | Ícono `purpose="maskable"`: fondo verde a sangre (sin radio) y contenido al 66% centrado, para respetar la zona segura del 40% que recortan Android/iOS. |
| `pwa-icon-monochrome.svg` | Silueta negra para `purpose="monochrome"`. |

### Reglas de uso

- **Zona de resguardo:** 1 módulo (⅕ del alto del isotipo) libre en los cuatro lados.
- **Tamaño mínimo:** 16px el isotipo, 120px de ancho el logotipo horizontal.
- **El ámbar `#E8A33D` vive únicamente dentro del isotipo.** No es un color de UI: no usarlo en
  botones, badges, links ni fondos. En la app, el único acento es `#C2410C`.
- En monocromo la columna ámbar se vuelve del mismo color que el resto (no queda ningún módulo
  diferenciado). Es correcto y esperado.
- El texto "MTHosting" en los SVG horizontales es un elemento `<text>` en IBM Plex Sans 600.
  **Antes de mandar a imprenta o a un tercero, convertirlo a curvas.**
- Nunca rotar, estirar, aplicar sombra, ni cambiar los colores del isotipo.

### El logo en el teléfono (PWA)

El ícono que el equipo de limpieza ve en el home screen del celular es `pwa-icon-512-maskable.svg`
(fondo verde a sangre + barras al 66%). Ese es el requisito explícito: el ícono instalado **es**
este isotipo.

```html
<link rel="icon" href="/icons/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png" />
<link rel="manifest" href="/manifest.webmanifest" />
<meta name="theme-color" content="#14532D" />
```

Además de los SVG, generar los PNG que iOS todavía exige (iOS ignora `maskable` y **no** aplica
esquinas redondeadas a `apple-touch-icon`, así que ese PNG tiene que llevar el tile con `rx`
proporcional ya dibujado):

| PNG a generar | Desde | Nota |
| --- | --- | --- |
| `icon-192.png`, `icon-512.png` | `pwa-icon-512-any.svg` | Android / manifest |
| `icon-512-maskable.png` | `pwa-icon-512-maskable.svg` | Android adaptive |
| `apple-touch-icon-180.png` | `pwa-icon-512-any.svg` | 180×180, **sin transparencia**, con el radio ya dibujado |

`manifest.webmanifest` incluido en el bundle.

---

## 5. Design tokens

### Marca — paleta 4B

| Token | Hex | Dónde se usa | Contraste |
| --- | --- | --- | --- |
| `--color-primary` | `#14532D` | Botón primario (relleno), ítem activo del menú, anillo de foco, color de link | blanco encima **9,11:1** ✓ |
| `--color-primary-hover` | `#0F4023` | Hover del botón primario | blanco encima **11,81:1** ✓ |
| `--color-primary-active` | `#0A2E19` | Estado pressed | blanco encima **14,81:1** ✓ |
| `--color-primary-soft` | `#E4EFE8` | Fondo de badge "confirmada", fila seleccionada | — |
| `--color-primary-soft-text` | `#0F4325` | Texto sobre `primary-soft` | **9,63:1** ✓ |
| `--color-accent` | `#C2410C` | Punto de alerta, filete de fila que vence, "en proceso" | blanco encima **5,18:1** ✓ · sobre bg **4,92:1** ✓ |
| `--color-accent-hover` | `#9A3412` | Hover del acento; texto sobre `accent-soft` | blanco encima **7,31:1** ✓ |
| `--color-accent-soft` | `#FDF0E9` | Fondo de badge "en proceso", fila que vence | — |
| `--color-brand-mark-amber` | `#E8A33D` | **Solo dentro del isotipo.** Nunca en la UI | vs primario **4,22:1** ✓ UI |

Por qué 4B: el verde es lo bastante oscuro y desaturado como para que, en una tabla de 50
departamentos, el ítem activo del menú se note sin competir con el texto. Es la paleta pensada
para 8 horas de pantalla por día.

### Neutrales cálidos 50–900 — el motor de la app

La app es densa en tablas y listas: los grises importan más que el primario.

| Token | Hex | Dónde se usa | Contraste |
| --- | --- | --- | --- |
| `--color-neutral-50` | `#FAF9F7` | Fondo de la app, detrás de tarjetas y tablas; zebra | base |
| `--color-neutral-100` | `#F2F0EC` | Encabezado de tabla (`thead`), chips inertes | texto 600 encima 6,38:1 ✓ |
| `--color-neutral-200` | `#E5E1DA` | Divisorias de fila, borde de tarjeta (decorativas) | 1,30:1 — no portante |
| `--color-neutral-300` | `#CFC9BF` | Divisoria fuerte, separador de grupo | 1,65:1 — no portante |
| `--color-neutral-400` | `#8C8478` | Borde de input y checkbox, íconos, borde punteado de "tentativa" | 3,69:1 sobre blanco ✓ UI |
| `--color-neutral-500` | `#6E6A62` | Texto atenuado: placeholder, timestamps, ayuda | 5,38:1 blanco · 5,12 bg ✓ |
| `--color-neutral-600` | `#5C564C` | Texto secundario: columnas de apoyo, metadatos | 7,27:1 blanco · 6,90 bg ✓ |
| `--color-neutral-700` | `#403B34` | Encabezado de tabla en negrita | 10,74:1 blanco ✓ |
| `--color-neutral-800` | `#2A2621` | Texto sobre fondos claros teñidos | 14,25:1 blanco ✓ |
| `--color-neutral-900` | `#1A1815` | **Texto principal**, importes, títulos | 17,72:1 blanco · 16,84 bg ✓ |

### Semánticos

| Rol | base | soft (fondo) | text (sobre soft) | Contraste |
| --- | --- | --- | --- | --- |
| Éxito | `#0F7A46` | `#E6F4EC` | `#0B5A33` | texto/soft **7,33:1** ✓ · base/blanco 5,39 ✓ |
| Advertencia | `#A16207` | `#FBF0D9` | `#7A4A05` | texto/soft **6,61:1** ✓ · base/blanco 4,92 ✓ |
| Error | `#B42318` | `#FCEBE9` | `#8A1C13` | texto/soft **8,07:1** ✓ · blanco/base 6,57 ✓ |
| Info | `#1A5FB4` | `#E7EFFA` | `#14498A` | texto/soft **7,71:1** ✓ · base/blanco 6,29 ✓ |

### Superficies, bordes, texto

| Token | Valor | Dónde se usa |
| --- | --- | --- |
| `--color-bg` | `#FAF9F7` (neutral-50) | Fondo de la app |
| `--color-surface` | `#FFFFFF` | Tarjetas, filas de tabla, modales |
| `--color-surface-alt` | `#F2F0EC` (neutral-100) | `thead`, filas alternas |
| `--color-surface-hover` | `#F5F3EF` | Hover de fila |
| `--color-surface-selected` | `#E4EFE8` (primary-soft) | Fila seleccionada |
| `--color-overlay` | `rgba(26, 24, 21, 0.45)` | Backdrop de modal |
| `--color-border` | `#E5E1DA` | Divisorias, borde de tarjeta |
| `--color-border-strong` | `#CFC9BF` | Divisoria fuerte |
| `--color-border-control` | `#8C8478` | Borde de input, checkbox, radio |
| `--color-focus-ring` | `#14532D` | Anillo de foco (2px, offset 2px) |
| `--color-text-primary` | `#1A1815` | Texto principal |
| `--color-text-secondary` | `#5C564C` | Texto secundario |
| `--color-text-muted` | `#6E6A62` | Texto atenuado |
| `--color-text-inverse` | `#FFFFFF` | Texto sobre primario/acento |
| `--color-text-link` | `#14532D` | Links (9,11:1 ✓) |

### Forma, densidad, elevación

| Token | Valor | Dónde se usa |
| --- | --- | --- |
| `--radius-sm` | `3px` | Badges, inputs, botones |
| `--radius-md` | `4px` | Tarjetas, tablas |
| `--radius-lg` | `8px` | Modales |
| `--row-height` | `40px` | **Densidad media confirmada.** Alto de fila de tabla |
| `--shadow-sm` | `0 1px 2px rgba(26,24,21,0.06)` | Tarjeta apoyada |
| `--shadow-md` | `0 4px 12px rgba(26,24,21,0.08)` | Dropdown, popover |

Escala de espaciado: múltiplos de 4px — `4, 8, 12, 16, 20, 24, 32, 40, 48, 64`.

---

## 6. Colores de estado (badges)

**Estilo del badge:** fondo suave + texto oscuro. `border-radius: 3px`, `font-size: 12px`,
`font-weight: 500`, `padding: 4px 10px`, `display: inline-flex`, `white-space: nowrap`.

**Lógica de color transversal a los tres dominios** — esto es lo importante de respetar al
agregar estados nuevos:

- **gris** = inerte, nadie lo está tocando
- **azul** = en manos de otro, esperando
- **naranja** = pasando ahora, o urgente
- **verde** = cerrado bien
- **rojo** = cerrado mal
- **violeta** = excepción

**Accesibilidad:** "tentativa" y "vence pronto" llevan además una señal **no cromática** (borde
punteado / punto), para no depender solo del color.

### Reservas

| Estado | Token | bg | text | Contraste | Nota |
| --- | --- | --- | --- | --- | --- |
| Confirmada | `--color-estado-reserva-confirmada-*` | `#E4EFE8` | `#0F4325` | **9,63:1** ✓ | Recalibrado al primario 4B |
| Tentativa (iCal) | `--color-estado-reserva-tentativa-*` | `#F5F3EF` | `#5C564C` | **6,56:1** ✓ | + `border: 1px dashed #8C8478` (3,33:1 ✓). Importada por iCal, sin confirmar |
| En curso | `--color-estado-reserva-en-curso-*` | `#E7EFFA` | `#14498A` | **7,71:1** ✓ | Huésped alojado ahora |
| Finalizada | `--color-estado-reserva-finalizada-*` | `#F2F0EC` | `#5C564C` | **6,38:1** ✓ | Estadía terminada y liquidada |
| Cancelada | `--color-estado-reserva-cancelada-*` | `#FCEBE9` | `#8A1C13` | **8,07:1** ✓ | Fila con texto tachado opcional |

### Limpiezas

| Estado | Token | bg | text | Contraste | Nota |
| --- | --- | --- | --- | --- | --- |
| Pendiente | `--color-estado-limpieza-pendiente-*` | `#F2F0EC` | `#5C564C` | **6,38:1** ✓ | Sin asignar |
| Asignada | `--color-estado-limpieza-asignada-*` | `#E7EFFA` | `#14498A` | **7,71:1** ✓ | Tiene persona, no arrancó |
| En proceso | `--color-estado-limpieza-en-proceso-*` | `#FDF0E9` | `#9A3412` | **6,55:1** ✓ | Check-in hecho desde el celular |
| Completada | `--color-estado-limpieza-completada-*` | `#E6F4EC` | `#0B5A33` | **7,33:1** ✓ | Cerrada con fotos subidas |

### Reclamos por daños

El ciclo va de gris a verde/rojo.

| Estado | Token | bg | text | Contraste | Nota |
| --- | --- | --- | --- | --- | --- |
| Borrador | `--color-estado-reclamo-borrador-*` | `#F5F3EF` | `#5C564C` | **6,56:1** ✓ | Cargado, sin evidencia completa |
| Por presentar | `--color-estado-reclamo-por-presentar-*` | `#FBF0D9` | `#7A4A05` | **6,61:1** ✓ | Listo para enviar — corre contra reloj |
| Presentado | `--color-estado-reclamo-presentado-*` | `#E7EFFA` | `#14498A` | **7,71:1** ✓ | Enviado, esperando respuesta |
| Escalado | `--color-estado-reclamo-escalado-*` | `#F1EBFB` | `#5B21B6` | **7,71:1** ✓ | Excepción: mediación / soporte superior |
| Cobrado | `--color-estado-reclamo-cobrado-*` | `#E6F4EC` | `#0B5A33` | **7,33:1** ✓ | Plata acreditada |
| Rechazado | `--color-estado-reclamo-rechazado-*` | `#FCEBE9` | `#8A1C13` | **8,07:1** ✓ | La plataforma dijo que no |
| Descartado | `--color-estado-reclamo-descartado-*` | `#F2F0EC` | `#6E6A62` | **4,73:1** ✓ | Lo bajamos nosotros |

### Alerta de vencimiento (reclamo que vence en < 3 días)

| Token | Valor | Contraste |
| --- | --- | --- |
| `--color-alerta-vencimiento-bg` | `#FBE0D1` | con text **7,44:1** ✓ |
| `--color-alerta-vencimiento-text` | `#7C2D12` | |
| `--color-alerta-vencimiento-dot` | `#C2410C` | 4,92:1 sobre bg ✓ |
| `--color-alerta-vencimiento-row-bg` | `#FDF0E9` | fondo de fila |
| `--color-alerta-vencimiento-row-bar` | `#C2410C` | filete izquierdo 3px |

Badge: `<span>` con punto de 6px `border-radius: 50%` + label, `font-weight: 600`, más saturado
que "en proceso" para que salte en una tabla llena.

**Regla:** la fila puede tomar fondo `#FDF0E9` con filete izquierdo `#C2410C`, **o** el badge de
vencimiento — nunca las dos señales a la vez con el badge en rojo. Una alarma por fila.

---

## 7. Tipografía

**IBM Plex Sans** para toda la UI. **IBM Plex Mono** para IDs, códigos de reserva y montos en
documentos a propietarios. Disponibles en Google Fonts y en `next/font/google`.

Elegida por legibilidad en tablas densas: altura de x generosa y formas abiertas, sostiene 12–13px
sin cerrarse. **Cifras tabulares siempre** (`font-variant-numeric: tabular-nums`), para que los
importes y las fechas alineen columna a columna.

```ts
// app/layout.tsx
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

export const plexSans = IBM_Plex_Sans({
  subsets: ["latin"], weight: ["400","500","600","700"], variable: "--font-plex-sans",
});
export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"], weight: ["400","500"], variable: "--font-plex-mono",
});
```

### Escala

| Rol | Tamaño / peso | line-height | letter-spacing | Uso |
| --- | --- | --- | --- | --- |
| display | 28px / 600 | 1.2 | -0.02em | Título de página, "Liquidación agosto" |
| título | 20px / 600 | 1.3 | -0.01em | Título de sección, nombre de departamento |
| cuerpo | 14px / 400 | 1.55 | 0 | Texto corrido, descripciones |
| tabla | 13px / 400 | 1.4 | 0 | Celdas. `tabular-nums` obligatorio |
| tabla-header | 13px / 600 | 1.4 | 0 | `thead`, color `#403B34` |
| badge | 12px / 500 | 1.3 | 0 | Badges de estado |
| etiqueta | 11px / 500 | 1.4 | 0.08em, `uppercase` | Labels de campo, "PROPIETARIO" |
| mono | 12px / 400 | 1.5 | 0 | IDs, `HMXQ4T2K9B`, `2026-08-14` |

En móvil (vista de limpieza) subir cuerpo a 16px y tabla a 15px. **Ningún target táctil por
debajo de 44px de alto.**

---

## 8. Screens / views

Las tres vistas que el sistema tiene que cubrir. El diseño detallado de cada pantalla **no está
en este bundle todavía** — lo que sigue son las especificaciones de layout y de color que ya
están decididas y que alcanzan para implementarlas.

### 8.1 Tabla de reservas (desktop, operaciones)

- **Propósito:** ver y filtrar las reservas de los ~50 departamentos; entrar al detalle; liquidar.
- **Layout:** sidebar de navegación fija a la izquierda (240px, fondo `#FFFFFF`, ítem activo con
  fondo `#E4EFE8` y texto `#0F4325`); contenido con `padding: 24px 32px` sobre `#FAF9F7`.
  Header de página con título 28/600 y acciones a la derecha.
- **Tabla:** `width: 100%`, `border-collapse: collapse`, dentro de una tarjeta blanca con
  `border: 1px solid #E5E1DA` y `border-radius: 4px`, `overflow: hidden`.
  - `thead`: fondo `#F2F0EC`, texto 13/600 `#403B34`, `padding: 8px 12px`, alineado a la
    izquierda salvo montos (derecha).
  - `tbody tr`: `height: 40px`, `border-bottom: 1px solid #E5E1DA`, zebra impar `#FAF9F7`,
    hover `#F5F3EF`, seleccionada `#E4EFE8`.
  - Columnas: Depto · Huésped · Check-in · Check-out · Noches · Estado (badge) · Neto USD
    (alineado a la derecha, `tabular-nums`).
- **Copy real de ejemplo:** `Ravignani 07`, `Bulnes 12B`, `Gorriti 4A`; `USD 1.284,50`,
  `USD 980,00`, `USD 1.510,00`; fechas `14/08/2026`.
- **Botones:** primario relleno `#14532D` con texto blanco, `height: 34px`, `padding: 0 16px`,
  `radius: 3px`, 12.5/500 — texto "Liquidar". Secundario: fondo blanco, texto `#14532D`,
  `border: 1px solid #14532D` — "Ver detalle".

### 8.2 Limpiezas (móvil, personal de limpieza — PWA)

- **Propósito:** la persona de limpieza ve sus tareas del día, marca inicio, sube fotos, cierra.
- **Layout:** una columna, `padding: 16px`, fondo `#FAF9F7`. Lista de tarjetas blancas
  (`border: 1px solid #E5E1DA`, `radius: 4px`, `padding: 16px`, `gap: 12px` entre tarjetas).
  Cada tarjeta: dirección (16/600), horario de check-out, badge de estado, botón de acción
  full-width `height: 48px`.
- **Targets táctiles: mínimo 44px.** El botón de acción principal, 48px.
- **Modo claro únicamente** (decisión tomada). Si más adelante hace falta modo oscuro, se define
  la escala equivalente entonces — no improvisar.
- Estados: pendiente → asignada → en proceso → completada, con los colores de la sección 6.

### 8.3 Reclamos por daños (desktop)

- **Propósito:** gestionar el ciclo de un reclamo contra la plataforma, con su vencimiento.
- **Layout:** igual que 8.1 (misma tarjeta, mismo `thead`, misma altura de fila).
- Columnas: Depto · Reserva · Monto USD · Estado (badge) · Vence · Acción.
- **Fila que vence en < 3 días:** fondo `#FDF0E9` + `border-left: 3px solid #C2410C`; en la
  columna Vence, el badge de vencimiento con punto. Una sola señal por fila (ver regla en la
  sección 6).
- Ordenar por vencimiento ascendente por defecto: lo que corre contra reloj primero.

---

## 9. Interacciones y comportamiento

- **Hover de fila:** fondo `#F5F3EF`, sin transición o `background-color 120ms ease`.
- **Hover de botón primario:** `#14532D` → `#0F4023`. Pressed: `#0A2E19`.
- **Foco de teclado:** `*:focus-visible { outline: 2px solid #14532D; outline-offset: 2px; }`.
  Nunca dejar el anillo azul del browser.
- **Disabled:** `opacity: 0.45`, `cursor: not-allowed`.
- **Transiciones:** 120–160ms `ease`. Nada más lento — es una herramienta de trabajo.
- **Loading:** skeleton de filas con fondo `#F2F0EC`, altura 40px, sin animación de brillo.
- **Error de formulario:** borde del input `#B42318`, mensaje 12/400 en `#8A1C13` debajo.
- **Toasts:** usar los semánticos de la sección 5; auto-dismiss 5s salvo error.
- **Ordenar/filtrar:** persistir en la URL (query params) para que se pueda compartir una vista.

---

## 10. State management

Nada exótico; lo mínimo que las vistas necesitan:

- **Reservas:** `filtros {estado[], depto[], rangoFechas}`, `orden {campo, dir}`,
  `seleccion: string[]`, `paginacion`. Fuente: sync de iCal + confirmaciones manuales; una
  reserva importada por iCal entra como `tentativa` hasta que alguien la confirma.
- **Limpiezas:** `tareasDelDia`, `tareaActiva`, `fotosSubidas`. La transición
  `asignada → en proceso` la dispara la persona de limpieza desde el celular; `en proceso →
  completada` requiere al menos una foto.
- **Reclamos:** `reclamos`, `orden` (default: vencimiento asc), `diasParaVencer` derivado —
  `< 3` activa la alerta de vencimiento.
- Offline: la vista de limpiezas es la única que necesita funcionar con conexión mala. Cachear la
  lista del día y encolar el cambio de estado + las fotos.

---

## 11. Assets

- `logo/*.svg` — los 11 archivos de la sección 4. Creados para este proyecto, originales.
- `manifest.webmanifest` — manifest de la PWA con los íconos ya declarados.
- **Fuentes:** IBM Plex Sans e IBM Plex Mono, Google Fonts / `next/font/google`. Licencia OFL.
- **Íconos de UI:** no están definidos todavía. Recomendación: **Lucide** — trazo de 1.5px,
  neutral, combina con Plex. Color de ícono `#8C8478` en reposo, `#5C564C` activo.
- **No hay fotografías** en este sistema. Es una herramienta interna: no hace falta imaginería.

## 12. Files

En este bundle:

| Archivo | Qué es |
| --- | --- |
| `README.md` | Este documento. Autosuficiente. |
| `PROMPT-claude-code.md` | Los prompts para arrancar la implementación, en orden. |
| `tokens.css` | Todos los tokens como custom properties, nombrados semánticamente. Producción. |
| `tailwind.config.ts` | El equivalente para Tailwind. Producción. |
| `manifest.webmanifest` | Manifest de la PWA. Producción. |
| `logo/` | Los 11 SVG finales. Producción. |

Eso es todo. Cinco archivos y una carpeta de assets: si algo no está en esta lista, no forma
parte de la entrega.

---

## 13. Checklist de implementación

- [ ] `tokens.css` pegado y `tailwind.config.ts` mergeado.
- [ ] IBM Plex Sans + Mono cargadas por `next/font`, `tabular-nums` global en tablas.
- [ ] `*:focus-visible` con el anillo verde; ningún foco azul del browser en toda la app.
- [ ] Los 11 SVG en `/public/icons`, más los 4 PNG derivados.
- [ ] `manifest.webmanifest` linkeado + `theme-color #14532D` + `apple-touch-icon`.
- [ ] Instalar la PWA en un Android y en un iPhone y confirmar que el ícono del home screen es el
      isotipo, sin recortes raros ni fondo blanco.
- [ ] Los 16 estados implementados como un mapa único `estado → {bg, text, border?, dot?}`, no
      como condicionales sueltos por pantalla.
- [ ] "Tentativa" con borde punteado y "vence pronto" con punto — señal no cromática presente.
- [ ] Fila de tabla a 40px; targets táctiles del móvil ≥44px.
- [ ] El ámbar `#E8A33D` no aparece en ningún lugar de la UI, solo dentro del isotipo.
