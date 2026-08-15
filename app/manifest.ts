import type { MetadataRoute } from "next";

/**
 * Manifest de la PWA (docs/IDENTIDAD-VISUAL.md §4).
 *
 * Lo que ve el equipo de limpieza en el home screen del celular sale de acá.
 * El ícono instalado es el isotipo "Barras", que es el requisito explícito de
 * la identidad.
 *
 * Por qué tantos íconos para lo mismo:
 *  - `any` en SVG: el que usa cualquier navegador que lo acepte, sin pixelar.
 *  - `any` en PNG de 192 y 512: Android todavía los pide.
 *  - `maskable`: Android recorta el ícono con la forma del launcher (círculo,
 *    squircle, gota). Este va con el fondo a sangre y la marca al 66%, para
 *    que el recorte no se coma las barras.
 *  - `monochrome`: la silueta, para los temas monocromos de Android.
 *
 * iOS no lee el manifest para el ícono: lo toma de `apple-touch-icon`, que se
 * declara en app/layout.tsx.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MTHosting",
    short_name: "MTHosting",
    description: "Gestión de alquiler temporario — MTHosting",
    lang: "es-AR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Fondo de la pantalla de arranque y color de la barra de estado.
    background_color: "#FAF9F7",
    theme_color: "#14532D",
    icons: [
      {
        src: "/icons/pwa-icon-512-any.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/pwa-icon-monochrome.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "monochrome",
      },
    ],
  };
}
