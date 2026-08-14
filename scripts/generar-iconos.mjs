/**
 * Genera los PNG del ícono a partir de los SVG de la identidad.
 *
 *   node scripts/generar-iconos.mjs
 *
 * Se corre a mano y solo hace falta si cambia el logo. Los PNG quedan
 * versionados: el que clona el repositorio no tiene que generar nada.
 *
 * Por qué PNG si ya hay SVG: Android los pide en el manifest e iOS todavía
 * no acepta SVG para el ícono del home screen.
 */
import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";

const ICONOS = "public/icons";

/** El fondo del ícono de iOS. Ver la nota de `apple-touch-icon` más abajo. */
const FONDO_APPLE = { r: 255, g: 255, b: 255, alpha: 1 };

const trabajos = [
  {
    desde: "pwa-icon-512-any.svg",
    hasta: "icon-192.png",
    lado: 192,
    nota: "Android, manifest",
  },
  {
    desde: "pwa-icon-512-any.svg",
    hasta: "icon-512.png",
    lado: 512,
    nota: "Android, manifest",
  },
  {
    desde: "pwa-icon-512-maskable.svg",
    hasta: "icon-512-maskable.png",
    lado: 512,
    nota: "Android adaptive: fondo a sangre y marca al 66%",
  },
  {
    // iOS no aplica esquinas redondeadas ni respeta la transparencia: el
    // radio va dibujado en el SVG y lo que queda afuera se aplana sobre un
    // fondo opaco, porque si no iOS lo pinta de negro.
    desde: "pwa-icon-512-any.svg",
    hasta: "apple-touch-icon-180.png",
    lado: 180,
    aplanar: true,
    nota: "iOS, sin transparencia",
  },
];

for (const t of trabajos) {
  const svg = readFileSync(`${ICONOS}/${t.desde}`);
  let img = sharp(svg, { density: 512 }).resize(t.lado, t.lado);
  if (t.aplanar) img = img.flatten({ background: FONDO_APPLE });

  const info = await img.png({ compressionLevel: 9 }).toFile(`${ICONOS}/${t.hasta}`);
  console.log(
    `${t.hasta.padEnd(24)} ${String(info.width).padStart(3)}x${info.height}  ` +
      `${String(Math.round(info.size / 1024)).padStart(3)} KB  ${t.nota}`,
  );
}

// ---------------------------------------------------------------------------
// favicon.ico
//
// El .ico moderno no es más que un PNG adentro de un encabezado de 22 bytes.
// Se arma a mano porque sharp no escribe .ico y no vale la pena una
// dependencia para veintidós bytes.
//
// Va en app/, no en public/: Next.js lo sirve desde ahí en /favicon.ico, que
// es la dirección que los navegadores piden solos aunque no se la declare.
// ---------------------------------------------------------------------------

const LADO = 32;
const png = await sharp(readFileSync(`${ICONOS}/favicon.svg`), { density: 256 })
  .resize(LADO, LADO)
  .png({ compressionLevel: 9 })
  .toBuffer();

const encabezado = Buffer.alloc(22);
encabezado.writeUInt16LE(0, 0); // reservado
encabezado.writeUInt16LE(1, 2); // 1 = ícono
encabezado.writeUInt16LE(1, 4); // cuántas imágenes trae
encabezado.writeUInt8(LADO, 6); // ancho
encabezado.writeUInt8(LADO, 7); // alto
encabezado.writeUInt8(0, 8); // colores de la paleta: 0 = sin paleta
encabezado.writeUInt8(0, 9); // reservado
encabezado.writeUInt16LE(1, 10); // planos
encabezado.writeUInt16LE(32, 12); // bits por píxel
encabezado.writeUInt32LE(png.length, 14); // tamaño de la imagen
encabezado.writeUInt32LE(22, 18); // dónde arranca

writeFileSync("app/favicon.ico", Buffer.concat([encabezado, png]));
console.log(
  `${"favicon.ico".padEnd(24)} ${LADO}x${LADO}   ` +
    `${String(Math.round((22 + png.length) / 1024)).padStart(3)} KB  pestaña del navegador`,
);
