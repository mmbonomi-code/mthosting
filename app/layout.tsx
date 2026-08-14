import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/**
 * IBM Plex (docs/IDENTIDAD-VISUAL.md §7). Elegida por cómo se lee en tablas
 * densas: sostiene 12 y 13px sin cerrarse.
 */
const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

/** Para códigos de reserva e importes en documentos a propietarios. */
const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MTHosting",
  description: "Sistema de gestión operativa de MTHosting",
  manifest: "/manifest.webmanifest",
  // El ícono de la identidad (docs/IDENTIDAD-VISUAL.md §4). El .ico no se
  // declara: Next.js lo publica solo desde app/favicon.ico, para los
  // navegadores que no aceptan SVG.
  icons: {
    icon: { url: "/icons/favicon.svg", type: "image/svg+xml" },
    // iOS no mira el manifest para el ícono del home screen: mira este.
    apple: "/icons/apple-touch-icon-180.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MTHosting",
  },
};

export const viewport: Viewport = {
  // Verde de la marca: es la barra de estado del celular con la app abierta.
  themeColor: "#14532D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-AR"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
