import type { Config } from "tailwindcss";

/* MTHosting — isotipo 2a "Barras" · paleta 4B "Bosque profundo + terracota"
 * Modo claro únicamente. Todos los pares cumplen WCAG AA.
 * brandAmber vive SOLO dentro del isotipo: no usarlo en la UI.
 */
const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FAF9F7",
        surface: { DEFAULT: "#FFFFFF", alt: "#F2F0EC", hover: "#F5F3EF", selected: "#E4EFE8" },
        border: { DEFAULT: "#E5E1DA", strong: "#CFC9BF", control: "#8C8478" },
        text: { primary: "#1A1815", secondary: "#5C564C", muted: "#6E6A62", inverse: "#FFFFFF", link: "#14532D" },
        primary: { DEFAULT: "#14532D", hover: "#0F4023", active: "#0A2E19", soft: "#E4EFE8", softText: "#0F4325" },
        accent:  { DEFAULT: "#C2410C", hover: "#9A3412", soft: "#FDF0E9", softText: "#9A3412" },
        brandAmber: "#E8A33D",
        neutral: {
          50: "#FAF9F7", 100: "#F2F0EC", 200: "#E5E1DA", 300: "#CFC9BF", 400: "#8C8478",
          500: "#6E6A62", 600: "#5C564C", 700: "#403B34", 800: "#2A2621", 900: "#1A1815",
        },
        success: { DEFAULT: "#0F7A46", soft: "#E6F4EC", text: "#0B5A33" },
        warning: { DEFAULT: "#A16207", soft: "#FBF0D9", text: "#7A4A05" },
        danger:  { DEFAULT: "#B42318", soft: "#FCEBE9", text: "#8A1C13" },
        info:    { DEFAULT: "#1A5FB4", soft: "#E7EFFA", text: "#14498A" },
        estado: {
          reservaConfirmada: { bg: "#E4EFE8", text: "#0F4325" },
          reservaTentativa:  { bg: "#F5F3EF", text: "#5C564C", border: "#8C8478" },
          reservaEnCurso:    { bg: "#E7EFFA", text: "#14498A" },
          reservaFinalizada: { bg: "#F2F0EC", text: "#5C564C" },
          reservaCancelada:  { bg: "#FCEBE9", text: "#8A1C13" },
          limpiezaPendiente:  { bg: "#F2F0EC", text: "#5C564C" },
          limpiezaAsignada:   { bg: "#E7EFFA", text: "#14498A" },
          limpiezaEnProceso:  { bg: "#FDF0E9", text: "#9A3412" },
          limpiezaCompletada: { bg: "#E6F4EC", text: "#0B5A33" },
          reclamoBorrador:     { bg: "#F5F3EF", text: "#5C564C" },
          reclamoPorPresentar: { bg: "#FBF0D9", text: "#7A4A05" },
          reclamoPresentado:   { bg: "#E7EFFA", text: "#14498A" },
          reclamoEscalado:     { bg: "#F1EBFB", text: "#5B21B6" },
          reclamoCobrado:      { bg: "#E6F4EC", text: "#0B5A33" },
          reclamoRechazado:    { bg: "#FCEBE9", text: "#8A1C13" },
          reclamoDescartado:   { bg: "#F2F0EC", text: "#6E6A62" },
        },
        alertaVencimiento: { bg: "#FBE0D1", text: "#7C2D12", dot: "#C2410C", rowBg: "#FDF0E9" },
      },
      fontFamily: {
        sans: ["var(--font-plex-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-plex-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: { sm: "3px", DEFAULT: "4px", lg: "8px" },
      height: { row: "40px", tap: "44px" },
      boxShadow: {
        sm: "0 1px 2px rgba(26,24,21,0.06)",
        md: "0 4px 12px rgba(26,24,21,0.08)",
      },
      transitionDuration: { DEFAULT: "140ms" },
    },
  },
  plugins: [],
};

export default config;
